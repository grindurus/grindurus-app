import { ReactNode, useEffect } from 'react'
import { useEvmWalletFromWagmi } from '../hooks/useEvmWalletFromWagmi'
import { useEvmWalletSnapshotApi } from './EvmWalletSnapshotContext'

export function EvmWalletPublisher({ children, onReady }: { children: ReactNode; onReady?: () => void }) {
  const wallet = useEvmWalletFromWagmi()
  const api = useEvmWalletSnapshotApi()

  useEffect(() => {
    api.setSnapshot(wallet)
  }, [api, wallet])

  useEffect(() => {
    onReady?.()
  }, [onReady])

  return <>{children}</>
}
