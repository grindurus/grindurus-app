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
import { confirmSignatureViaHttp, fetchMintDecimals, parseTokenAmount } from './onchain'
import { lockRemainingAccountMetas } from './buildLockTransaction'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  assetConfigPda,
  escrowPda,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  vaultAtaPda,
} from './pdas'
import { createAssociatedTokenAccountIdempotentInstruction } from './splInstructions'

/** Anchor discriminator for `grai::buyback` */
const BUYBACK_DISCRIMINATOR = Buffer.from([106, 117, 64, 30, 56, 69, 7, 45])

function encodeBuybackInstructionData(amount: bigint, paymentMax: bigint): Buffer {
  const data = Buffer.alloc(24)
  BUYBACK_DISCRIMINATOR.copy(data, 0)
  data.writeBigUInt64LE(amount, 8)
  data.writeBigUInt64LE(paymentMax, 16)
  return data
}

export type BuildBuybackTransactionParams = {
  buyer: PublicKey
  assetMint: PublicKey
  amount: bigint
  /** Max GRAI the buyer will pay (slippage); must be >= on-chain ask. */
  paymentMax: bigint
  connection: Connection
  config: GraiSolanaRuntime
}

export async function buildBuybackTransaction({
  buyer,
  assetMint,
  amount,
  paymentMax,
  connection,
  config,
}: BuildBuybackTransactionParams): Promise<Transaction> {
  if (amount <= 0n) throw new Error('Buyback amount must be greater than zero')
  if (paymentMax <= 0n) throw new Error('Payment max must be greater than zero')

  const programId = config.programId
  const protocol = await fetchGraiProtocol(connection, config.graiMint)
  const graiState = graiStatePda(programId)
  const assetConfig = assetConfigPda(assetMint, programId)
  const vaultAta = vaultAtaPda(assetMint, programId)
  const graiVaultAta = vaultAtaPda(config.graiMint, programId)
  const buyerGraiAta = getAssociatedTokenAddress(config.graiMint, buyer)
  const buyerAssetAta = getAssociatedTokenAddress(assetMint, buyer)
  const escrow = escrowPda(buyer, programId)

  const keys = [
    { pubkey: buyer, isSigner: true, isWritable: true },
    { pubkey: graiState, isSigner: false, isWritable: true },
    { pubkey: config.graiMint, isSigner: false, isWritable: false },
    { pubkey: assetMint, isSigner: false, isWritable: false },
    { pubkey: assetConfig, isSigner: false, isWritable: true },
    { pubkey: vaultAta, isSigner: false, isWritable: true },
    { pubkey: graiVaultAta, isSigner: false, isWritable: true },
    { pubkey: buyerGraiAta, isSigner: false, isWritable: true },
    { pubkey: buyerAssetAta, isSigner: false, isWritable: true },
    { pubkey: escrow, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ...lockRemainingAccountMetas(buyer, protocol.assetMints, programId),
  ]

  const buybackIx = new TransactionInstruction({
    programId,
    keys,
    data: encodeBuybackInstructionData(amount, paymentMax),
  })

  const instructions: TransactionInstruction[] = [
    createAssociatedTokenAccountIdempotentInstruction(
      buyer,
      buyerAssetAta,
      buyer,
      assetMint,
    ),
    buybackIx,
  ]

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  const transaction = new Transaction({
    feePayer: buyer,
    blockhash,
    lastValidBlockHeight,
  })
  transaction.add(...instructions)
  return transaction
}

export type ExecuteBuybackParams = {
  buyer: PublicKey
  assetMint: PublicKey
  amountInput: string
  assetDecimals?: number
  paymentMaxGrai: bigint
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  connection: Connection
  config: GraiSolanaRuntime
}

export async function executeBuyback({
  buyer,
  assetMint,
  amountInput,
  assetDecimals,
  paymentMaxGrai,
  signTransaction,
  connection,
  config,
}: ExecuteBuybackParams): Promise<{ signature: string; amount: bigint }> {
  const decimals = assetDecimals ?? (await fetchMintDecimals(connection, assetMint))
  const amount = parseTokenAmount(amountInput, decimals)
  const transaction = await buildBuybackTransaction({
    buyer,
    assetMint,
    amount,
    paymentMax: paymentMaxGrai,
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
