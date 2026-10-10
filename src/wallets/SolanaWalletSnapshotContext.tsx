import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import { DEFAULT_SOLANA_WALLET, type SolanaWalletSnapshot } from './solanaWalletTypes'

type SolanaWalletSnapshotApi = {
  setSnapshot: (snapshot: SolanaWalletSnapshot) => void
  resetSnapshot: () => void
}

const SolanaWalletSnapshotContext = createContext<SolanaWalletSnapshot>(DEFAULT_SOLANA_WALLET)
const SolanaWalletSnapshotApiContext = createContext<SolanaWalletSnapshotApi | undefined>(undefined)

export function SolanaWalletSnapshotProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<SolanaWalletSnapshot>(DEFAULT_SOLANA_WALLET)

  const api = useMemo<SolanaWalletSnapshotApi>(
    () => ({
      setSnapshot,
      resetSnapshot: () => setSnapshot(DEFAULT_SOLANA_WALLET),
    }),
    [],
  )

  return (
    <SolanaWalletSnapshotApiContext.Provider value={api}>
      <SolanaWalletSnapshotContext.Provider value={snapshot}>{children}</SolanaWalletSnapshotContext.Provider>
    </SolanaWalletSnapshotApiContext.Provider>
  )
}

export function useSolanaWalletSnapshot() {
  return useContext(SolanaWalletSnapshotContext)
}

export function useSolanaWalletSnapshotApi() {
  const api = useContext(SolanaWalletSnapshotApiContext)
  if (!api) {
    throw new Error('useSolanaWalletSnapshotApi must be used within SolanaWalletSnapshotProvider')
  }
  return api
}

export function useResetSolanaWalletSnapshot() {
  const api = useContext(SolanaWalletSnapshotApiContext)
  return useCallback(() => {
    api?.resetSnapshot()
  }, [api])
}
