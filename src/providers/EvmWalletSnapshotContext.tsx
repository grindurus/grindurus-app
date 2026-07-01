import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import { DEFAULT_EVM_WALLET, type EvmWalletSnapshot } from './evmWalletTypes'

type EvmWalletSnapshotApi = {
  setSnapshot: (snapshot: EvmWalletSnapshot) => void
  resetSnapshot: () => void
}

const EvmWalletSnapshotContext = createContext<EvmWalletSnapshot>(DEFAULT_EVM_WALLET)
const EvmWalletSnapshotApiContext = createContext<EvmWalletSnapshotApi | undefined>(undefined)

export function EvmWalletSnapshotProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<EvmWalletSnapshot>(DEFAULT_EVM_WALLET)

  const api = useMemo<EvmWalletSnapshotApi>(
    () => ({
      setSnapshot,
      resetSnapshot: () => setSnapshot(DEFAULT_EVM_WALLET),
    }),
    [],
  )

  return (
    <EvmWalletSnapshotApiContext.Provider value={api}>
      <EvmWalletSnapshotContext.Provider value={snapshot}>{children}</EvmWalletSnapshotContext.Provider>
    </EvmWalletSnapshotApiContext.Provider>
  )
}

export function useEvmWalletSnapshot() {
  return useContext(EvmWalletSnapshotContext)
}

export function useEvmWalletSnapshotApi() {
  const api = useContext(EvmWalletSnapshotApiContext)
  if (!api) {
    throw new Error('useEvmWalletSnapshotApi must be used within EvmWalletSnapshotProvider')
  }
  return api
}

export function useResetEvmWalletSnapshot() {
  const api = useContext(EvmWalletSnapshotApiContext)
  return useCallback(() => {
    api?.resetSnapshot()
  }, [api])
}
