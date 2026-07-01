import { useEvmWalletSnapshot } from '../providers/EvmWalletSnapshotContext'

export function useEvmWallet() {
  return useEvmWalletSnapshot()
}
