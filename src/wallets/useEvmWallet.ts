import { useEvmWalletSnapshot } from './EvmWalletSnapshotContext'

export function useEvmWallet() {
  return useEvmWalletSnapshot()
}
