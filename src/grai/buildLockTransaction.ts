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
  assetConfigPda,
  escrowPda,
  getAssociatedTokenAddress,
  positionPda,
  TOKEN_PROGRAM_ID,
  vaultAtaPda,
} from './pdas'
import { createAssociatedTokenAccountIdempotentInstruction } from './splInstructions'

const LOCK_DISCRIMINATOR = Buffer.from([21, 19, 208, 43, 237, 62, 255, 87])
const UNLOCK_DISCRIMINATOR = Buffer.from([101, 155, 40, 21, 158, 189, 56, 203])

type AccountMetaInput = {
  pubkey: PublicKey
  isSigner: boolean
  isWritable: boolean
}

/** Remaining pairs `[asset_config, position]` per listed mint — for `lock` / `deposit(..., lock)`. */
export function lockRemainingAccountMetas(
  user: PublicKey,
  assetMints: PublicKey[],
  programId: PublicKey,
): AccountMetaInput[] {
  const keys: AccountMetaInput[] = []
  for (const mint of assetMints) {
    keys.push({
      pubkey: assetConfigPda(mint, programId),
      isSigner: false,
      isWritable: false,
    })
    keys.push({
      pubkey: positionPda(user, mint, programId),
      isSigner: false,
      isWritable: true,
    })
  }
  return keys
}

/** Remaining quads `[asset_config, position, vault_ata, holder_ata]` for `unlock`. */
export function unlockRemainingAccountMetas(
  user: PublicKey,
  assetMints: PublicKey[],
  programId: PublicKey,
): AccountMetaInput[] {
  const keys: AccountMetaInput[] = []
  for (const mint of assetMints) {
    keys.push({
      pubkey: assetConfigPda(mint, programId),
      isSigner: false,
      isWritable: true,
    })
    keys.push({
      pubkey: positionPda(user, mint, programId),
      isSigner: false,
      isWritable: true,
    })
    keys.push({
      pubkey: vaultAtaPda(mint, programId),
      isSigner: false,
      isWritable: true,
    })
    keys.push({
      pubkey: getAssociatedTokenAddress(mint, user),
      isSigner: false,
      isWritable: true,
    })
  }
  return keys
}

function encodeAmountInstructionData(discriminator: Buffer, amount: bigint): Buffer {
  const data = Buffer.alloc(16)
  discriminator.copy(data, 0)
  data.writeBigUInt64LE(amount, 8)
  return data
}

export type BuildLockTransactionParams = {
  locker: PublicKey
  amount: bigint
  connection: Connection
  config: GraiSolanaRuntime
}

export async function buildLockTransaction({
  locker,
  amount,
  connection,
  config,
}: BuildLockTransactionParams): Promise<Transaction> {
  if (amount <= 0n) throw new Error('Amount must be greater than zero')

  const programId = config.programId
  const protocol = await fetchGraiProtocol(connection, config.graiMint)
  const graiState = graiStatePda(programId)
  const escrow = escrowPda(locker, programId)
  const lockerGraiAta = getAssociatedTokenAddress(config.graiMint, locker)
  const graiVaultAta = vaultAtaPda(config.graiMint, programId)

  const lockIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: locker, isSigner: true, isWritable: true },
      { pubkey: graiState, isSigner: false, isWritable: true },
      { pubkey: config.graiMint, isSigner: false, isWritable: false },
      { pubkey: escrow, isSigner: false, isWritable: true },
      { pubkey: lockerGraiAta, isSigner: false, isWritable: true },
      { pubkey: graiVaultAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ...lockRemainingAccountMetas(locker, protocol.assetMints, programId),
    ],
    data: encodeAmountInstructionData(LOCK_DISCRIMINATOR, amount),
  })

  const instructions: TransactionInstruction[] = []
  const lockerGraiAtaInfo = await connection.getAccountInfo(lockerGraiAta)
  if (!lockerGraiAtaInfo) {
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        locker,
        lockerGraiAta,
        locker,
        config.graiMint,
      ),
    )
  }
  instructions.push(lockIx)

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  const transaction = new Transaction({
    feePayer: locker,
    blockhash,
    lastValidBlockHeight,
  })
  transaction.add(...instructions)
  return transaction
}

export type ExecuteLockParams = {
  locker: PublicKey
  amountInput: string
  graiDecimals: number
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  connection: Connection
  config: GraiSolanaRuntime
}

export async function executeLock({
  locker,
  amountInput,
  graiDecimals,
  signTransaction,
  connection,
  config,
}: ExecuteLockParams): Promise<{ signature: string; amount: bigint }> {
  const amount = parseTokenAmount(amountInput, graiDecimals)
  const transaction = await buildLockTransaction({ locker, amount, connection, config })
  const signed = await signTransaction(transaction)
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })
  await confirmSignatureViaHttp(connection, signature, 'confirmed')
  return { signature, amount }
}

export type BuildUnlockTransactionParams = {
  account: PublicKey
  amount: bigint
  connection: Connection
  config: GraiSolanaRuntime
}

export async function buildUnlockTransaction({
  account,
  amount,
  connection,
  config,
}: BuildUnlockTransactionParams): Promise<Transaction> {
  if (amount <= 0n) throw new Error('Amount must be greater than zero')

  const programId = config.programId
  const protocol = await fetchGraiProtocol(connection, config.graiMint)
  const graiState = graiStatePda(programId)
  const escrow = escrowPda(account, programId)
  const accountGraiAta = getAssociatedTokenAddress(config.graiMint, account)
  const graiVaultAta = vaultAtaPda(config.graiMint, programId)

  const unlockIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: account, isSigner: true, isWritable: true },
      { pubkey: graiState, isSigner: false, isWritable: true },
      { pubkey: config.graiMint, isSigner: false, isWritable: false },
      { pubkey: escrow, isSigner: false, isWritable: true },
      { pubkey: accountGraiAta, isSigner: false, isWritable: true },
      { pubkey: graiVaultAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ...unlockRemainingAccountMetas(account, protocol.assetMints, programId),
    ],
    data: encodeAmountInstructionData(UNLOCK_DISCRIMINATOR, amount),
  })

  const instructions: TransactionInstruction[] = []
  const accountGraiAtaInfo = await connection.getAccountInfo(accountGraiAta)
  if (!accountGraiAtaInfo) {
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        account,
        accountGraiAta,
        account,
        config.graiMint,
      ),
    )
  }
  instructions.push(unlockIx)

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  const transaction = new Transaction({
    feePayer: account,
    blockhash,
    lastValidBlockHeight,
  })
  transaction.add(...instructions)
  return transaction
}

export type ExecuteUnlockParams = {
  account: PublicKey
  amountInput: string
  graiDecimals: number
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  connection: Connection
  config: GraiSolanaRuntime
}

export async function executeUnlock({
  account,
  amountInput,
  graiDecimals,
  signTransaction,
  connection,
  config,
}: ExecuteUnlockParams): Promise<{ signature: string; amount: bigint }> {
  const amount = parseTokenAmount(amountInput, graiDecimals)
  const transaction = await buildUnlockTransaction({ account, amount, connection, config })
  const signed = await signTransaction(transaction)
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })
  await confirmSignatureViaHttp(connection, signature, 'confirmed')
  return { signature, amount }
}
