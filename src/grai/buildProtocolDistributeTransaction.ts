import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import type { GraiSolanaRuntime } from './deployments'
import { graiStatePda } from './deployments'
import { fetchGraiProtocol } from './fetchGraiProtocol'
import {
  confirmSignatureViaHttp,
  fetchAssetConfigPriceFeed,
  fetchMintDecimals,
  parseTokenAmount,
} from './onchain'
import { NATIVE_MINT } from './knownMints'
import {
  assetConfigPda,
  getAssociatedTokenAddress,
  positionPda,
  TOKEN_PROGRAM_ID,
  vaultAtaPda,
} from './pdas'
import { createAssociatedTokenAccountIdempotentInstruction } from './splInstructions'

/** Anchor discriminator for `grai::distribute` */
const DISTRIBUTE_DISCRIMINATOR = Buffer.from([191, 44, 223, 207, 164, 236, 126, 61])

function encodeDistributeInstructionData(yieldAmount: bigint): Buffer {
  const data = Buffer.alloc(16)
  DISTRIBUTE_DISCRIMINATOR.copy(data, 0)
  data.writeBigUInt64LE(yieldAmount, 8)
  return data
}

function createSyncNativeInstruction(account: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [{ pubkey: account, isSigner: false, isWritable: true }],
    data: Buffer.from([17]),
  })
}

export type BuildProtocolDistributeTransactionParams = {
  custodyWallet: PublicKey
  assetMint: PublicKey
  yieldAmount: bigint
  connection: Connection
  config: GraiSolanaRuntime
  /** Pays for Position init; defaults to custodyWallet. */
  payer?: PublicKey
}

export async function buildProtocolDistributeTransaction({
  custodyWallet,
  assetMint,
  yieldAmount,
  connection,
  config,
  payer,
}: BuildProtocolDistributeTransactionParams): Promise<Transaction> {
  if (yieldAmount <= 0n) {
    throw new Error('Yield amount must be greater than zero')
  }

  const programId = config.programId
  const feePayer = payer ?? custodyWallet
  const isSol = assetMint.toBase58() === NATIVE_MINT
  const graiState = graiStatePda(programId)
  const protocol = await fetchGraiProtocol(connection, config.graiMint)
  const assetConfig = assetConfigPda(assetMint, programId)
  const priceFeed = await fetchAssetConfigPriceFeed(connection, assetConfig)
  const custodyAta = getAssociatedTokenAddress(assetMint, custodyWallet)
  const vaultAta = vaultAtaPda(assetMint, programId)
  const treasuryAta = getAssociatedTokenAddress(assetMint, protocol.treasury)
  const position = positionPda(custodyWallet, assetMint, programId)

  const distributeIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: custodyWallet, isSigner: true, isWritable: true },
      { pubkey: feePayer, isSigner: true, isWritable: true },
      { pubkey: graiState, isSigner: false, isWritable: true },
      { pubkey: assetMint, isSigner: false, isWritable: false },
      { pubkey: assetConfig, isSigner: false, isWritable: true },
      { pubkey: priceFeed, isSigner: false, isWritable: false },
      { pubkey: config.graiMint, isSigner: false, isWritable: false },
      { pubkey: custodyAta, isSigner: false, isWritable: true },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: treasuryAta, isSigner: false, isWritable: true },
      { pubkey: position, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: encodeDistributeInstructionData(yieldAmount),
  })

  const instructions: TransactionInstruction[] = []

  instructions.push(
    createAssociatedTokenAccountIdempotentInstruction(
      feePayer,
      custodyAta,
      custodyWallet,
      assetMint,
    ),
  )

  const treasuryAtaInfo = await connection.getAccountInfo(treasuryAta)
  if (!treasuryAtaInfo) {
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        feePayer,
        treasuryAta,
        protocol.treasury,
        assetMint,
      ),
    )
  }

  if (isSol) {
    let wrapped = 0n
    try {
      const balance = await connection.getTokenAccountBalance(custodyAta)
      wrapped = BigInt(balance.value.amount)
    } catch {
      wrapped = 0n
    }
    if (wrapped < yieldAmount) {
      const shortfall = yieldAmount - wrapped
      instructions.push(
        SystemProgram.transfer({
          fromPubkey: custodyWallet,
          toPubkey: custodyAta,
          lamports: Number(shortfall),
        }),
        createSyncNativeInstruction(custodyAta),
      )
    }
  }

  instructions.push(distributeIx)

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  const transaction = new Transaction({
    feePayer,
    blockhash,
    lastValidBlockHeight,
  })
  transaction.add(...instructions)

  return transaction
}

export type ExecuteProtocolDistributeParams = {
  custodyWallet: PublicKey
  assetMint: PublicKey
  amountInput: string
  assetDecimals?: number
  payer?: PublicKey
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  connection: Connection
  config: GraiSolanaRuntime
}

export async function executeProtocolDistribute({
  custodyWallet,
  assetMint,
  amountInput,
  assetDecimals,
  payer,
  signTransaction,
  connection,
  config,
}: ExecuteProtocolDistributeParams): Promise<{ signature: string; amount: bigint }> {
  const decimals = assetDecimals ?? (await fetchMintDecimals(connection, assetMint))
  const yieldAmount = parseTokenAmount(amountInput, decimals)
  const transaction = await buildProtocolDistributeTransaction({
    custodyWallet,
    assetMint,
    yieldAmount,
    payer,
    connection,
    config,
  })
  const signed = await signTransaction(transaction)
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })
  await confirmSignatureViaHttp(connection, signature, 'confirmed')
  return { signature, amount: yieldAmount }
}
