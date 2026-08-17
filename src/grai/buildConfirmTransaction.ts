import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import type { GraiSolanaRuntime } from './deployments'
import { fetchGraiProtocol } from './fetchGraiProtocol'
import { confirmSignatureViaHttp } from './onchain'

/** Anchor discriminator for `grinders::confirm` (`sha256("global:confirm")[0..8]`). */
const CONFIRM_DISCRIMINATOR = Buffer.from([174, 1, 15, 213, 3, 190, 131, 0])

export type BuildConfirmTransactionParams = {
  owner: PublicKey
  connection: Connection
  config: GraiSolanaRuntime
}

/**
 * Builds Grinders `confirm` — toggle the owner limb of GRAI 2-of-2 liquidation
 * (EVM `Grinders.confirm`).
 */
export async function buildConfirmTransaction({
  owner,
  connection,
  config,
}: BuildConfirmTransactionParams): Promise<Transaction> {
  const protocol = await fetchGraiProtocol(connection, config.graiMint)
  const grindersState = protocol.grinders
  if (grindersState.equals(PublicKey.default)) {
    throw new Error('GRAI grinders is unset — call set_grinders before confirm')
  }
  const grindersInfo = await connection.getAccountInfo(grindersState)
  if (!grindersInfo) {
    throw new Error('Grinders state account not found')
  }
  const grindersProgram = grindersInfo.owner

  const confirmIx = new TransactionInstruction({
    programId: grindersProgram,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: grindersState, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(CONFIRM_DISCRIMINATOR),
  })

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  const transaction = new Transaction({
    feePayer: owner,
    blockhash,
    lastValidBlockHeight,
  })
  transaction.add(confirmIx)
  return transaction
}

export type ExecuteConfirmParams = {
  owner: PublicKey
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  connection: Connection
  config: GraiSolanaRuntime
}

export async function executeConfirm({
  owner,
  signTransaction,
  connection,
  config,
}: ExecuteConfirmParams): Promise<{ signature: string }> {
  const transaction = await buildConfirmTransaction({
    owner,
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
