import {
  Connection,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import type { GraiSolanaRuntime } from './deployments'
import { graiStatePda } from './deployments'
import { fetchAccountsByKey } from './accountBatch'
import { fetchGraiProtocol } from './fetchGraiProtocol'
import { confirmSignatureViaHttp, fetchAssetConfigPriceFeed, parseTokenAmount } from './onchain'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  assetConfigPda,
  escrowPda,
  getAssociatedTokenAddress,
  positionPda,
  referrerPda,
  TOKEN_PROGRAM_ID,
  treasuryVaultPda,
  vaultAtaPda,
} from './pdas'
import { claimAffiliateRemainingMetas } from './referralAccounts'
import { createAssociatedTokenAccountIdempotentInstruction } from './splInstructions'

/** Anchor `global:claim` discriminator. */
const CLAIM_DISCRIMINATOR = Buffer.from([62, 198, 214, 193, 213, 159, 108, 210])

/** `u64::MAX` — claim the full pending balance (EVM `type(uint256).max`). */
export const CLAIM_AMOUNT_MAX = 0xffff_ffff_ffff_ffffn

/** Rent-exempt minimum for a standard SPL token account (lamports). */
const ATA_RENT_LAMPORTS = 2_039_280
/** Leave headroom for signature fees + position init. */
const CLAIM_FEE_BUFFER_LAMPORTS = 15_000

function encodeClaimInstructionData(amount: bigint): Buffer {
  const data = Buffer.alloc(16)
  CLAIM_DISCRIMINATOR.copy(data, 0)
  data.writeBigUInt64LE(amount, 8)
  return data
}

function beneficiarOrOwner(protocol: {
  beneficiar: PublicKey
  owner: PublicKey
}): PublicKey {
  return protocol.beneficiar.equals(PublicKey.default) ? protocol.owner : protocol.beneficiar
}

function formatSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(4)
}

async function buildMissingAtaCreateInstructions(
  connection: Connection,
  payer: PublicKey,
  targets: Array<{ ata: PublicKey; owner: PublicKey; mint: PublicKey }>,
): Promise<TransactionInstruction[]> {
  const unique = new Map<string, { ata: PublicKey; owner: PublicKey; mint: PublicKey }>()
  for (const target of targets) {
    unique.set(target.ata.toBase58(), target)
  }
  const list = [...unique.values()]
  const accounts = await fetchAccountsByKey(
    connection,
    list.map((target) => target.ata),
  )
  const instructions: TransactionInstruction[] = []
  for (const target of list) {
    if (accounts.get(target.ata.toBase58())) continue
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        payer,
        target.ata,
        target.owner,
        target.mint,
      ),
    )
  }
  return instructions
}

async function assertPayerCanFundClaim(
  connection: Connection,
  payer: PublicKey,
  ataCreates: number,
): Promise<void> {
  const balance = await connection.getBalance(payer, 'confirmed')
  const need = ataCreates * ATA_RENT_LAMPORTS + CLAIM_FEE_BUFFER_LAMPORTS
  if (balance >= need) return
  throw new Error(
    `Not enough SOL to claim: wallet has ${formatSol(balance)} SOL, need about ${formatSol(need)} SOL to create token accounts (rent). Top up your Solana wallet and try again.`,
  )
}

function claimSimulationErrorMessage(err: unknown, logs: string[] | null | undefined): string {
  const joined = logs?.join('\n') ?? ''
  if (/insufficient lamports/i.test(joined)) {
    const match = joined.match(/insufficient lamports\s+(\d+),\s+need\s+(\d+)/i)
    if (match) {
      const have = Number(match[1])
      const need = Number(match[2])
      return `Not enough SOL to create a token account for claim: have ${formatSol(have)} SOL, need ${formatSol(need)} SOL for rent. Top up your Solana wallet and try again.`
    }
    return 'Not enough SOL to create token accounts for claim. Top up your Solana wallet and try again.'
  }
  const detail = typeof err === 'string' ? err : JSON.stringify(err)
  const tail = logs?.slice(-8).join('\n') ?? ''
  return tail ? `Claim simulation failed: ${detail}\n${tail}` : `Claim simulation failed: ${detail}`
}

export type BuildClaimTransactionParams = {
  holder: PublicKey
  assetMint: PublicKey
  amount: bigint
  connection: Connection
  config: GraiSolanaRuntime
  /** Pays rent for Position / ATA init and receives claim tip; defaults to holder. */
  payer?: PublicKey
}

export async function buildClaimTransaction({
  holder,
  assetMint,
  amount,
  connection,
  config,
  payer = holder,
}: BuildClaimTransactionParams): Promise<Transaction> {
  if (amount <= 0n) throw new Error('Amount must be greater than zero')

  const programId = config.programId
  const protocol = await fetchGraiProtocol(connection, config.graiMint)
  const graiState = graiStatePda(programId)
  const escrow = escrowPda(holder, programId)
  const assetConfig = assetConfigPda(assetMint, programId)
  const priceFeed = await fetchAssetConfigPriceFeed(connection, assetConfig)
  const position = positionPda(holder, assetMint, programId)
  const vaultAta = vaultAtaPda(assetMint, programId)
  const treasuryVault = treasuryVaultPda(assetMint, programId)
  const holderAssetAta = getAssociatedTokenAddress(assetMint, holder)
  const tipAssetAta = getAssociatedTokenAddress(assetMint, payer)
  const feeRecipient = beneficiarOrOwner(protocol)
  const beneficiarAta = getAssociatedTokenAddress(assetMint, feeRecipient)
  const holderReferrer = referrerPda(holder, programId)
  const affiliateRemaining = await claimAffiliateRemainingMetas(
    connection,
    holder,
    assetMint,
    programId,
    protocol.affiliateLevels,
  )

  const claimIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: graiState, isSigner: false, isWritable: false },
      { pubkey: holder, isSigner: false, isWritable: false },
      { pubkey: escrow, isSigner: false, isWritable: false },
      { pubkey: assetMint, isSigner: false, isWritable: false },
      { pubkey: assetConfig, isSigner: false, isWritable: true },
      { pubkey: priceFeed, isSigner: false, isWritable: false },
      { pubkey: position, isSigner: false, isWritable: true },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: treasuryVault, isSigner: false, isWritable: true },
      { pubkey: holderAssetAta, isSigner: false, isWritable: true },
      { pubkey: tipAssetAta, isSigner: false, isWritable: true },
      { pubkey: beneficiarAta, isSigner: false, isWritable: true },
      { pubkey: holderReferrer, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ...affiliateRemaining,
    ],
    data: encodeClaimInstructionData(amount),
  })

  const ataTargets = [
    { ata: holderAssetAta, owner: holder, mint: assetMint },
    { ata: beneficiarAta, owner: feeRecipient, mint: assetMint },
  ]
  if (!tipAssetAta.equals(holderAssetAta)) {
    ataTargets.push({ ata: tipAssetAta, owner: payer, mint: assetMint })
  }

  const ataCreates = await buildMissingAtaCreateInstructions(connection, payer, ataTargets)
  await assertPayerCanFundClaim(connection, payer, ataCreates.length)

  const instructions: TransactionInstruction[] = [...ataCreates, claimIx]

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  const transaction = new Transaction({
    feePayer: payer,
    blockhash,
    lastValidBlockHeight,
  })
  transaction.add(...instructions)
  return transaction
}

export type ExecuteClaimParams = {
  holder: PublicKey
  assetMint: PublicKey
  amountInput: string
  assetDecimals: number
  /** When true, claim full pending (`u64::MAX`) regardless of amountInput. */
  claimMax?: boolean
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  connection: Connection
  config: GraiSolanaRuntime
  /** Connected wallet that pays fees / receives tip. Defaults to `holder`. */
  payer?: PublicKey
}

export async function executeClaim({
  holder,
  assetMint,
  amountInput,
  assetDecimals,
  claimMax = false,
  signTransaction,
  connection,
  config,
  payer = holder,
}: ExecuteClaimParams): Promise<{ signature: string; amount: bigint }> {
  const amount = claimMax ? CLAIM_AMOUNT_MAX : parseTokenAmount(amountInput, assetDecimals)
  const transaction = await buildClaimTransaction({
    holder,
    assetMint,
    amount,
    connection,
    config,
    payer,
  })
  const signature = await signAndSendClaimTransaction(connection, transaction, signTransaction)
  return { signature, amount }
}

export type ExecuteClaimAllParams = {
  holder: PublicKey
  /**
   * Mints with pending > 0. Prefer these over the full registry — Solana `claim_all`
   * with every listed mint + ATA creates routinely exceeds tx size / account limits.
   */
  assetMints?: PublicKey[]
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  connection: Connection
  config: GraiSolanaRuntime
  /** Connected wallet that pays fees / receives tip. Defaults to `holder`. */
  payer?: PublicKey
}

const MAX_TX_ACCOUNTS = 48
const MAX_TX_BYTES = 1100

function countUniqueAccounts(instructions: TransactionInstruction[]): number {
  const keys = new Set<string>()
  for (const ix of instructions) {
    keys.add(ix.programId.toBase58())
    for (const meta of ix.keys) keys.add(meta.pubkey.toBase58())
  }
  return keys.size
}

function serializedTxSize(feePayer: PublicKey, instructions: TransactionInstruction[]): number {
  const tx = new Transaction({ feePayer })
  tx.recentBlockhash = PublicKey.default.toBase58()
  tx.add(...instructions)
  // Unsigned wire size is a lower bound; leave headroom via MAX_TX_BYTES.
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).length
}

async function signAndSendClaimTransaction(
  connection: Connection,
  transaction: Transaction,
  signTransaction: (transaction: Transaction) => Promise<Transaction>,
): Promise<string> {
  const simulation = await connection.simulateTransaction(transaction)
  if (simulation.value.err) {
    throw new Error(claimSimulationErrorMessage(simulation.value.err, simulation.value.logs))
  }

  let signed: Transaction
  try {
    signed = await signTransaction(transaction)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/unexpected error/i.test(message)) {
      throw new Error(
        'Wallet could not sign the claim transaction. Check that the connected wallet is the fee payer and try again.',
      )
    }
    throw error
  }

  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })
  await confirmSignatureViaHttp(connection, signature, 'confirmed')
  return signature
}

/**
 * Claim all pending dividends for a locker.
 *
 * Uses per-asset `claim` instructions (not Solana `claim_all`) so third-party claims
 * keep the connected wallet as fee payer / tip recipient, and so large registries
 * do not blow past Solana account / size limits.
 */
export async function executeClaimAll({
  holder,
  assetMints: pendingMints,
  signTransaction,
  connection,
  config,
  payer = holder,
}: ExecuteClaimAllParams): Promise<{ signature: string }> {
  let mints = pendingMints ?? []
  if (mints.length === 0) {
    throw new Error('No claimable dividends')
  }

  const batches: TransactionInstruction[][] = []
  let current: TransactionInstruction[] = []

  for (const assetMint of mints) {
    const nextTx = await buildClaimTransaction({
      holder,
      assetMint,
      amount: CLAIM_AMOUNT_MAX,
      connection,
      config,
      payer,
    })
    const nextIxs = nextTx.instructions
    const merged = [...current, ...nextIxs]
    const fits =
      current.length === 0 ||
      (countUniqueAccounts(merged) <= MAX_TX_ACCOUNTS &&
        serializedTxSize(payer, merged) <= MAX_TX_BYTES)

    if (!fits) {
      batches.push(current)
      current = nextIxs
    } else {
      current = merged
    }
  }
  if (current.length > 0) batches.push(current)

  let signature = ''
  for (const instructions of batches) {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
    const transaction = new Transaction({
      feePayer: payer,
      blockhash,
      lastValidBlockHeight,
    })
    transaction.add(...instructions)
    signature = await signAndSendClaimTransaction(connection, transaction, signTransaction)
  }

  if (!signature) throw new Error('No claimable dividends')
  return { signature }
}
