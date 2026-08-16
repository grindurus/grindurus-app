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
import { confirmSignatureViaHttp } from './onchain'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  vaultAtaPda,
} from './pdas'
import { createAssociatedTokenAccountIdempotentInstruction } from './splInstructions'

/** Anchor discriminator for `grai::liquidate` (`sha256("global:liquidate")[0..8]`). */
const LIQUIDATE_DISCRIMINATOR = Buffer.from([223, 179, 226, 125, 48, 46, 39, 74])

export type BuildLiquidateTransactionParams = {
  caller: PublicKey
  connection: Connection
  config: GraiSolanaRuntime
}

/**
 * Builds `liquidate` — open liquidation when Grinders.confirmed + quorum (EVM `liquidate`).
 * Scoops dead GRAI from the vault to the caller. Arm via Grinders `confirm` first.
 */
export async function buildLiquidateTransaction({
  caller,
  connection,
  config,
}: BuildLiquidateTransactionParams): Promise<Transaction> {
  const programId = config.programId
  const protocol = await fetchGraiProtocol(connection, config.graiMint)
  const graiState = graiStatePda(programId)
  const grindersState = protocol.grinders
  if (grindersState.equals(PublicKey.default)) {
    throw new Error('GRAI grinders is unset — call set_grinders before liquidate')
  }
  const graiVaultAta = vaultAtaPda(config.graiMint, programId)
  const callerGraiAta = getAssociatedTokenAddress(config.graiMint, caller)

  const liquidateIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: caller, isSigner: true, isWritable: true },
      { pubkey: graiState, isSigner: false, isWritable: true },
      { pubkey: grindersState, isSigner: false, isWritable: false },
      { pubkey: config.graiMint, isSigner: false, isWritable: false },
      { pubkey: graiVaultAta, isSigner: false, isWritable: true },
      { pubkey: callerGraiAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(LIQUIDATE_DISCRIMINATOR),
  })

  const instructions: TransactionInstruction[] = [
    createAssociatedTokenAccountIdempotentInstruction(
      caller,
      callerGraiAta,
      caller,
      config.graiMint,
    ),
    liquidateIx,
  ]

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  const transaction = new Transaction({
    feePayer: caller,
    blockhash,
    lastValidBlockHeight,
  })
  transaction.add(...instructions)
  return transaction
}

export type ExecuteLiquidateParams = {
  caller: PublicKey
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  connection: Connection
  config: GraiSolanaRuntime
}

export async function executeLiquidate({
  caller,
  signTransaction,
  connection,
  config,
}: ExecuteLiquidateParams): Promise<{ signature: string }> {
  const transaction = await buildLiquidateTransaction({
    caller,
    connection,
    config,
  })
  const signed = await signTransaction(transaction)
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })
  await confirmSignatureViaHttp(connection, signature, 'confirmed')
  return { signature }
}
