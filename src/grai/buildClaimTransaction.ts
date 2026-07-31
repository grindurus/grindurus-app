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
import { fetchGraiProtocol } from './fetchGraiProtocol'
import { confirmSignatureViaHttp, parseTokenAmount } from './onchain'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  assetConfigPda,
  escrowPda,
  getAssociatedTokenAddress,
  positionPda,
  TOKEN_PROGRAM_ID,
  vaultAtaPda,
} from './pdas'
import { createAssociatedTokenAccountIdempotentInstruction } from './splInstructions'

/** Anchor `global:claim` discriminator. */
const CLAIM_DISCRIMINATOR = Buffer.from([62, 198, 214, 193, 213, 159, 108, 210])

/** `u64::MAX` — claim the full pending balance (EVM `type(uint256).max`). */
export const CLAIM_AMOUNT_MAX = 0xffff_ffff_ffff_ffffn

function encodeClaimInstructionData(amount: bigint): Buffer {
  const data = Buffer.alloc(16)
  CLAIM_DISCRIMINATOR.copy(data, 0)
  data.writeBigUInt64LE(amount, 8)
  return data
}

export type BuildClaimTransactionParams = {
  holder: PublicKey
  assetMint: PublicKey
  amount: bigint
  connection: Connection
  config: GraiSolanaRuntime
  /** Pays rent for Position / ATA init; defaults to holder. */
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
  const graiState = graiStatePda(programId)
  const escrow = escrowPda(holder, programId)
  const assetConfig = assetConfigPda(assetMint, programId)
  const position = positionPda(holder, assetMint, programId)
  const vaultAta = vaultAtaPda(assetMint, programId)
  const holderAssetAta = getAssociatedTokenAddress(assetMint, holder)

  const claimIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: graiState, isSigner: false, isWritable: false },
      { pubkey: holder, isSigner: false, isWritable: false },
      { pubkey: escrow, isSigner: false, isWritable: false },
      { pubkey: assetMint, isSigner: false, isWritable: false },
      { pubkey: assetConfig, isSigner: false, isWritable: true },
      { pubkey: position, isSigner: false, isWritable: true },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: holderAssetAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: encodeClaimInstructionData(amount),
  })

  const instructions: TransactionInstruction[] = [
    createAssociatedTokenAccountIdempotentInstruction(payer, holderAssetAta, holder, assetMint),
    claimIx,
  ]

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
}: ExecuteClaimParams): Promise<{ signature: string; amount: bigint }> {
  const amount = claimMax ? CLAIM_AMOUNT_MAX : parseTokenAmount(amountInput, assetDecimals)
  const transaction = await buildClaimTransaction({
    holder,
    assetMint,
    amount,
    connection,
    config,
  })
  const signed = await signTransaction(transaction)
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })
  await confirmSignatureViaHttp(connection, signature, 'confirmed')
  return { signature, amount }
}

export type ExecuteClaimAllParams = {
  holder: PublicKey
  /** Asset mints with pending > 0 (caller filters via estimate). */
  assetMints: PublicKey[]
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  connection: Connection
  config: GraiSolanaRuntime
}

/** Claims each listed asset with `u64::MAX` in a single transaction. */
export async function executeClaimAll({
  holder,
  assetMints,
  signTransaction,
  connection,
  config,
}: ExecuteClaimAllParams): Promise<{ signature: string }> {
  if (assetMints.length === 0) {
    throw new Error('No claimable dividends')
  }

  const programId = config.programId
  const graiState = graiStatePda(programId)
  const escrow = escrowPda(holder, programId)
  const instructions: TransactionInstruction[] = []

  for (const assetMint of assetMints) {
    const holderAssetAta = getAssociatedTokenAddress(assetMint, holder)
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(holder, holderAssetAta, holder, assetMint),
    )
    instructions.push(
      new TransactionInstruction({
        programId,
        keys: [
          { pubkey: holder, isSigner: true, isWritable: true },
          { pubkey: graiState, isSigner: false, isWritable: false },
          { pubkey: holder, isSigner: false, isWritable: false },
          { pubkey: escrow, isSigner: false, isWritable: false },
          { pubkey: assetMint, isSigner: false, isWritable: false },
          { pubkey: assetConfigPda(assetMint, programId), isSigner: false, isWritable: true },
          { pubkey: positionPda(holder, assetMint, programId), isSigner: false, isWritable: true },
          { pubkey: vaultAtaPda(assetMint, programId), isSigner: false, isWritable: true },
          { pubkey: holderAssetAta, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ],
        data: encodeClaimInstructionData(CLAIM_AMOUNT_MAX),
      }),
    )
  }

  // Ensure registry still lists these mints (guards stale client lists).
  await fetchGraiProtocol(connection, config.graiMint)

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  const transaction = new Transaction({
    feePayer: holder,
    blockhash,
    lastValidBlockHeight,
  })
  transaction.add(...instructions)

  const signed = await signTransaction(transaction)
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })
  await confirmSignatureViaHttp(connection, signature, 'confirmed')
  return { signature }
}
