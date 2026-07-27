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
import { NATIVE_MINT } from './knownMints'
import {
  fetchAssetConfigPriceFeed,
  fetchMintDecimals,
  parseTokenAmount,
  confirmSignatureViaHttp,
} from './onchain'
import { resolveSolanaGrindersProgramId } from './solanaAllocateCustody'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  assetConfigPda,
  getAssociatedTokenAddress,
  grindersStatePda,
  TOKEN_PROGRAM_ID,
} from './pdas'
import { createAssociatedTokenAccountIdempotentInstruction } from './splInstructions'

const DEPOSIT_DISCRIMINATOR = Buffer.from([242, 35, 198, 137, 82, 225, 242, 182])
const DEPOSIT_SOL_DISCRIMINATOR = Buffer.from([108, 81, 78, 117, 125, 155, 56, 200])

function encodeDepositInstructionData(amount: bigint, isSol: boolean): Buffer {
  const data = Buffer.alloc(16)
  ;(isSol ? DEPOSIT_SOL_DISCRIMINATOR : DEPOSIT_DISCRIMINATOR).copy(data, 0)
  data.writeBigUInt64LE(amount, 8)
  return data
}

export type BuildMintTransactionParams = {
  minter: PublicKey
  assetMint: PublicKey
  amount: bigint
  connection: Connection
  config: GraiSolanaRuntime
}

/** Builds a `deposit` / `deposit_sol` transaction (legacy name kept for app hooks). */
export async function buildMintTransaction({
  minter,
  assetMint,
  amount,
  connection,
  config,
}: BuildMintTransactionParams): Promise<Transaction> {
  if (amount <= 0n) {
    throw new Error('Amount must be greater than zero')
  }

  const programId = config.programId
  const isSol = assetMint.toBase58() === NATIVE_MINT
  const graiState = graiStatePda(programId)
  const protocol = await fetchGraiProtocol(connection, config.graiMint)
  const grindersProgram = resolveSolanaGrindersProgramId(config.cluster)
  const grindersState = protocol.grinders.equals(PublicKey.default)
    ? grindersStatePda(grindersProgram)
    : protocol.grinders
  const assetConfig = assetConfigPda(assetMint, programId)
  const priceFeed = await fetchAssetConfigPriceFeed(connection, assetConfig)
  const depositorGraiAta = getAssociatedTokenAddress(config.graiMint, minter)
  const depositorAssetAta = getAssociatedTokenAddress(assetMint, minter)
  const grindersAta = getAssociatedTokenAddress(assetMint, grindersState)

  const depositIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: minter, isSigner: true, isWritable: true },
      { pubkey: graiState, isSigner: false, isWritable: true },
      { pubkey: assetMint, isSigner: false, isWritable: false },
      { pubkey: config.graiMint, isSigner: false, isWritable: true },
      { pubkey: assetConfig, isSigner: false, isWritable: false },
      { pubkey: priceFeed, isSigner: false, isWritable: false },
      { pubkey: grindersState, isSigner: false, isWritable: false },
      { pubkey: depositorAssetAta, isSigner: false, isWritable: true },
      { pubkey: grindersAta, isSigner: false, isWritable: true },
      { pubkey: depositorGraiAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: encodeDepositInstructionData(amount, isSol),
  })

  const instructions: TransactionInstruction[] = []

  if (!isSol) {
    const depositorAssetAtaInfo = await connection.getAccountInfo(depositorAssetAta)
    if (!depositorAssetAtaInfo) {
      instructions.push(
        createAssociatedTokenAccountIdempotentInstruction(
          minter,
          depositorAssetAta,
          minter,
          assetMint,
        ),
      )
    }
  } else {
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        minter,
        depositorAssetAta,
        minter,
        assetMint,
      ),
    )
  }

  instructions.push(depositIx)

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  const transaction = new Transaction({
    feePayer: minter,
    blockhash,
    lastValidBlockHeight,
  })
  transaction.add(...instructions)

  return transaction
}

export type ExecuteMintParams = {
  minter: PublicKey
  assetMint: PublicKey
  amountInput: string
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  connection: Connection
  config: GraiSolanaRuntime
}

export async function executeMint({
  minter,
  assetMint,
  amountInput,
  signTransaction,
  connection,
  config,
}: ExecuteMintParams): Promise<{ signature: string; amount: bigint }> {
  const decimals = await fetchMintDecimals(connection, assetMint)
  const amount = parseTokenAmount(amountInput, decimals)
  const transaction = await buildMintTransaction({ minter, assetMint, amount, connection, config })
  const signed = await signTransaction(transaction)
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })
  await confirmSignatureViaHttp(connection, signature, 'confirmed')
  return { signature, amount }
}

export const buildDepositTransaction = buildMintTransaction
export const executeDeposit = executeMint
