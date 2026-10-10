import { useSolanaWalletSnapshot } from './SolanaWalletSnapshotContext'

export type { WalletSolanaCluster } from './solanaWalletTypes'

export function useSolanaWallet() {
  return useSolanaWalletSnapshot()
}
