import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '../../grai/pdas'
import { createAssociatedTokenAccountIdempotentInstruction } from '../../grai/splInstructions'
import { formatTokenBalance, parseTokenAmount, confirmSignatureViaHttp } from '../../grai/onchain'
import type { GrsSolanaConfig } from '../deployments'
import { decodeGrsConfig, decodeOftStore, decodeSaleAccount, decodeSaleRegistry, quoteSaleCost } from './layout'
import { isEvmPackedPubkey } from './quoteAssets'
import { resolveGrsSolanaPdas, salePda, vestingPda } from './pdas'
import { GRS_SOLANA_DECIMALS } from './readProtocol'

const IX = {
  buy: Buffer.from('66063d1201daebea', 'hex'),
  vest: Buffer.from('1f7ecca6735db685', 'hex'),
  release: Buffer.from('fdf90fce1c7fc1f1', 'hex'),
  sale: Buffer.from('12e90f1e2595bb91', 'hex'),
} as const

function u64le(value: bigint | number): Buffer {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64LE(BigInt(value))
  return buf
}

function meta(pubkey: PublicKey, isSigner = false, isWritable = false) {
  return { pubkey, isSigner, isWritable }
}

async function sendSigned(
  connection: Connection,
  tx: Transaction,
  feePayer: PublicKey,
  signTransaction: (transaction: Transaction) => Promise<Transaction>,
): Promise<string> {
  const { blockhash } = await connection.getLatestBlockhash('confirmed')
  tx.feePayer = feePayer
  tx.recentBlockhash = blockhash
  const signed = await signTransaction(tx)
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
    maxRetries: 3,
  })
  // HTTP poll — `confirmTransaction` WebSocket hangs on the local /solana-devnet-rpc proxy
  // while Solscan already shows the tx confirmed.
  await confirmSignatureViaHttp(connection, signature, 'confirmed')
  return signature
}

async function loadStore(connection: Connection, config: GrsSolanaConfig) {
  const pdas = resolveGrsSolanaPdas(config)
  const [oftInfo, grsInfo, saleInfo] = await connection.getMultipleAccountsInfo([
    pdas.oftStore,
    pdas.grsConfig,
    pdas.saleRegistry,
  ])
  if (!oftInfo?.data || !grsInfo?.data) throw new Error('GRS Solana accounts not found')
  return {
    pdas,
    oft: decodeOftStore(Buffer.from(oftInfo.data)),
    grs: decodeGrsConfig(Buffer.from(grsInfo.data)),
    sales: saleInfo?.data ? decodeSaleRegistry(Buffer.from(saleInfo.data)) : null,
  }
}

export async function executeSolanaGrsBuy(params: {
  connection: Connection
  config: GrsSolanaConfig
  publicKey: PublicKey
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  saleId: bigint
  amountInput: string
  recipient: string
  decimals?: number
}): Promise<{ signature: string; amount: bigint; cost: bigint; amountLabel: string }> {
  const decimals = params.decimals ?? GRS_SOLANA_DECIMALS
  const amount = parseTokenAmount(params.amountInput, decimals)
  const to = new PublicKey(params.recipient)
  const { pdas, oft } = await loadStore(params.connection, params.config)
  const sale = salePda(params.config.oftStore, params.saleId, params.config.programId)
  const saleInfo = await params.connection.getAccountInfo(sale)
  if (!saleInfo?.data) throw new Error('Unknown or closed sale')
  const row = decodeSaleAccount(Buffer.from(saleInfo.data))
  if (row.grsAmount === 0n || row.assetAmount === 0n) throw new Error('Unknown or closed sale')
  if (isEvmPackedPubkey(row.asset)) {
    throw new Error(
      'This sale is priced in an EVM asset. Re-publish to Solana with USDC/SOL so buyers can pay with SPL.',
    )
  }
  const cost = quoteSaleCost(amount, row.grsAmount, row.assetAmount)
  const payee = row.recipient.equals(PublicKey.default) ? oft.admin : row.recipient
  const destAta = getAssociatedTokenAddress(params.config.mint, to)
  const native = row.asset.equals(PublicKey.default)

  const keys = [
    meta(params.publicKey, true, true),
    meta(pdas.oftStore),
    meta(pdas.grsConfig, false, true),
    meta(sale, false, true),
    meta(payee, false, true),
    meta(to),
    meta(pdas.saleEscrow, false, true),
    meta(destAta, false, true),
    meta(params.config.mint, false, true),
  ]

  if (!native) {
    keys.push(
      meta(row.asset),
      meta(getAssociatedTokenAddress(row.asset, params.publicKey), false, true),
      meta(getAssociatedTokenAddress(row.asset, payee), false, true),
      meta(TOKEN_PROGRAM_ID),
    )
  }

  keys.push(
    meta(TOKEN_PROGRAM_ID),
    meta(ASSOCIATED_TOKEN_PROGRAM_ID),
    meta(SystemProgram.programId),
  )

  const tx = new Transaction()
  if (!(await params.connection.getAccountInfo(destAta))) {
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        params.publicKey,
        destAta,
        to,
        params.config.mint,
      ),
    )
  }
  if (!native) {
    const quoteDest = getAssociatedTokenAddress(row.asset, payee)
    if (!(await params.connection.getAccountInfo(quoteDest))) {
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          params.publicKey,
          quoteDest,
          payee,
          row.asset,
        ),
      )
    }
  }

  tx.add(
    new TransactionInstruction({
      programId: params.config.programId,
      keys,
      data: Buffer.concat([IX.buy, u64le(params.saleId), u64le(amount)]),
    }),
  )

  const signature = await sendSigned(
    params.connection,
    tx,
    params.publicKey,
    params.signTransaction,
  )
  return {
    signature,
    amount,
    cost,
    amountLabel: formatTokenBalance(amount, decimals),
  }
}

export async function executeSolanaGrsVest(params: {
  connection: Connection
  config: GrsSolanaConfig
  publicKey: PublicKey
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  amountInput: string
  beneficiary: string
  cliffSeconds: number
  durationSeconds: number
  decimals?: number
}): Promise<{ signature: string; amount: bigint; amountLabel: string; id: bigint }> {
  const decimals = params.decimals ?? GRS_SOLANA_DECIMALS
  const amount = parseTokenAmount(params.amountInput, decimals)
  const to = new PublicKey(params.beneficiary)
  const { pdas, grs } = await loadStore(params.connection, params.config)
  const id = grs.vestingCount + 1n
  const vesting = vestingPda(params.config.oftStore, id, params.config.programId)
  const source = getAssociatedTokenAddress(params.config.mint, params.publicKey)

  const tx = new Transaction().add(
    new TransactionInstruction({
      programId: params.config.programId,
      keys: [
        meta(params.publicKey, true, true),
        meta(pdas.oftStore),
        meta(pdas.grsConfig, false, true),
        meta(vesting, false, true),
        meta(pdas.vestEscrow, false, true),
        meta(source, false, true),
        meta(params.config.mint, false, true),
        meta(TOKEN_PROGRAM_ID),
        meta(SystemProgram.programId),
      ],
      data: Buffer.concat([
        IX.vest,
        u64le(id),
        to.toBuffer(),
        u64le(amount),
        u64le(0),
        u64le(params.cliffSeconds),
        u64le(params.durationSeconds),
      ]),
    }),
  )

  const signature = await sendSigned(
    params.connection,
    tx,
    params.publicKey,
    params.signTransaction,
  )
  return { signature, amount, amountLabel: formatTokenBalance(amount, decimals), id }
}

export async function executeSolanaGrsRelease(params: {
  connection: Connection
  config: GrsSolanaConfig
  publicKey: PublicKey
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  vestingId: bigint
}): Promise<{ signature: string }> {
  const { pdas } = await loadStore(params.connection, params.config)
  const vesting = vestingPda(params.config.oftStore, params.vestingId, params.config.programId)
  const vestingInfo = await params.connection.getAccountInfo(vesting)
  if (!vestingInfo?.data) throw new Error('Vesting not found')
  const beneficiary = new PublicKey(Buffer.from(vestingInfo.data).subarray(80, 112))
  const dest = getAssociatedTokenAddress(params.config.mint, beneficiary)

  const tx = new Transaction().add(
    new TransactionInstruction({
      programId: params.config.programId,
      keys: [
        meta(params.publicKey, true, true),
        meta(pdas.oftStore),
        meta(pdas.grsConfig),
        meta(vesting, false, true),
        meta(pdas.vestEscrow, false, true),
        meta(beneficiary),
        meta(dest, false, true),
        meta(params.config.mint, false, true),
        meta(TOKEN_PROGRAM_ID),
        meta(ASSOCIATED_TOKEN_PROGRAM_ID),
        meta(SystemProgram.programId),
      ],
      data: Buffer.from(IX.release),
    }),
  )

  const signature = await sendSigned(
    params.connection,
    tx,
    params.publicKey,
    params.signTransaction,
  )
  return { signature }
}

export async function executeSolanaGrsSale(params: {
  connection: Connection
  config: GrsSolanaConfig
  publicKey: PublicKey
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  asset: PublicKey
  assetAmount: bigint
  grsAmount: bigint
  recipient: PublicKey
}): Promise<{ signature: string }> {
  const { pdas, grs, oft, sales } = await loadStore(params.connection, params.config)
  if (!grs.home) throw new Error('Solana GRS is a spoke — list sales on the EVM home chain (Sepolia)')
  if (!oft.admin.equals(params.publicKey)) throw new Error('Only the GRS admin can list sales')
  const nextId = (sales?.saleCount ?? 0n) + 1n
  const sale = salePda(params.config.oftStore, nextId, params.config.programId)

  const tx = new Transaction().add(
    new TransactionInstruction({
      programId: params.config.programId,
      keys: [
        meta(params.publicKey, true, true),
        meta(pdas.oftStore),
        meta(pdas.grsConfig),
        meta(pdas.saleRegistry, false, true),
        meta(sale, false, true),
        meta(pdas.saleEscrow, false, true),
        meta(params.config.mint),
        meta(TOKEN_PROGRAM_ID),
        meta(SystemProgram.programId),
      ],
      data: Buffer.concat([
        IX.sale,
        u64le(nextId),
        params.asset.toBuffer(),
        u64le(params.assetAmount),
        u64le(params.grsAmount),
        params.recipient.toBuffer(),
      ]),
    }),
  )

  const signature = await sendSigned(
    params.connection,
    tx,
    params.publicKey,
    params.signTransaction,
  )
  return { signature }
}
