import type { Connection, PublicKey, Transaction } from '@solana/web3.js'
import type { SolanaCluster } from '../providers/AppWalletProvider'
import {
  sendWalletTransaction,
  type SolanaSendTransaction,
} from '../solana/sendWalletTransaction'

export type GraiWalletSend = {
  connection: Connection
  transaction: Transaction
  feePayer: PublicKey
  cluster: SolanaCluster
  action: string
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  sendTransaction?: SolanaSendTransaction | null
}

/**
 * Same path as GRS: prefer wallet `sendTransaction` so Wallet Standard passes
 * `chain` (MetaMask defaults to mainnet when chain is omitted).
 */
export function signAndSendGraiTx(params: GraiWalletSend): Promise<string> {
  return sendWalletTransaction({
    connection: params.connection,
    transaction: params.transaction,
    feePayer: params.feePayer,
    expectedCluster: params.cluster,
    action: params.action,
    sendTransaction: params.sendTransaction,
    signTransaction: params.signTransaction,
  })
}
