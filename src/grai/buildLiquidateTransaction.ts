import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import type { GraiSolanaRuntime } from './deployments'
import { graiStatePda } from './deployments'
import { fetchGraiProtocol } from './fetchGraiProtocol'
import { confirmSignatureViaHttp } from './onchain'
import { assetConfigPda, TOKEN_PROGRAM_ID } from './pdas'

/** Anchor discriminator for `grai::liquidate` (`sha256("global:liquidate")[0..8]`). */
const LIQUIDATE_DISCRIMINATOR = Buffer.from([223, 179, 226, 125, 48, 46, 39, 74])

export type BuildLiquidateTransactionParams = {
  caller: PublicKey
  connection: Connection
  config: GraiSolanaRuntime
}

/**
 * Builds `liquidate` — owner confirm toggle and/or open liquidation (EVM `liquidate`).
 * Remaining: one writable `AssetConfig` per listed mint (required when opening).
 */
export async function buildLiquidateTransaction({
  caller,
  connection,
  config,
}: BuildLiquidateTransactionParams): Promise<Transaction> {
  const programId = config.programId
  const protocol = await fetchGraiProtocol(connection, config.graiMint)
  const graiState = graiStatePda(programId)

  const keys = [
    { pubkey: caller, isSigner: true, isWritable: false },
    { pubkey: graiState, isSigner: false, isWritable: true },
    { pubkey: config.graiMint, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ...protocol.assetMints.map((mint) => ({
      pubkey: assetConfigPda(mint, programId),
      isSigner: false,
      isWritable: true,
    })),
  ]

  const liquidateIx = new TransactionInstruction({
    programId,
    keys,
    data: Buffer.from(LIQUIDATE_DISCRIMINATOR),
  })

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  const transaction = new Transaction({
    feePayer: caller,
    blockhash,
    lastValidBlockHeight,
  })
  transaction.add(liquidateIx)
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
