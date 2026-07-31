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
  escrowPda,
  getAssociatedTokenAddress,
  grindersStatePda,
  TOKEN_PROGRAM_ID,
  vaultAtaPda,
} from './pdas'
import { createAssociatedTokenAccountIdempotentInstruction } from './splInstructions'
import { lockRemainingAccountMetas } from './buildLockTransaction'

const DEPOSIT_DISCRIMINATOR = Buffer.from([242, 35, 198, 137, 82, 225, 242, 182])
const DEPOSIT_SOL_DISCRIMINATOR = Buffer.from([108, 81, 78, 117, 125, 155, 56, 200])

/** Anchor args: `amount: u64` + `lock: bool`. */
function encodeDepositInstructionData(amount: bigint, lock: boolean, isSol: boolean): Buffer {
  const data = Buffer.alloc(17)
  ;(isSol ? DEPOSIT_SOL_DISCRIMINATOR : DEPOSIT_DISCRIMINATOR).copy(data, 0)
  data.writeBigUInt64LE(amount, 8)
  data.writeUInt8(lock ? 1 : 0, 16)
  return data
}

export type BuildMintTransactionParams = {
  minter: PublicKey
  assetMint: PublicKey
  amount: bigint
  connection: Connection
  config: GraiSolanaRuntime
  /** Escrow minted GRAI in the same tx (EVM `deposit(..., lock)`). Default false. */
  lock?: boolean
}

/** Builds a `deposit` / `deposit_sol` transaction (legacy name kept for app hooks). */
export async function buildMintTransaction({
  minter,
  assetMint,
  amount,
  connection,
  config,
  lock = false,
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
  const escrow = escrowPda(minter, programId)
  const graiVaultAta = vaultAtaPda(config.graiMint, programId)

  const keys = [
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
    { pubkey: escrow, isSigner: false, isWritable: true },
    { pubkey: graiVaultAta, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ]

  if (lock) {
    keys.push(...lockRemainingAccountMetas(minter, protocol.assetMints, programId))
  }

  const depositIx = new TransactionInstruction({
    programId,
    keys,
    data: encodeDepositInstructionData(amount, lock, isSol),
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

  const depositorGraiAtaInfo = await connection.getAccountInfo(depositorGraiAta)
  if (!depositorGraiAtaInfo) {
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        minter,
        depositorGraiAta,
        minter,
        config.graiMint,
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
  lock?: boolean
}

export async function executeMint({
  minter,
  assetMint,
  amountInput,
  signTransaction,
  connection,
  config,
  lock = false,
}: ExecuteMintParams): Promise<{ signature: string; amount: bigint }> {
  const decimals = await fetchMintDecimals(connection, assetMint)
  const amount = parseTokenAmount(amountInput, decimals)
  const transaction = await buildMintTransaction({
    minter,
    assetMint,
    amount,
    connection,
    config,
    lock,
  })
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
