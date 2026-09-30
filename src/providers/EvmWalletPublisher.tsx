import { ReactNode, useLayoutEffect, useRef } from 'react'
import { useEvmWalletFromWagmi } from '../hooks/useEvmWalletFromWagmi'
import { useEvmWalletSnapshotApi } from './EvmWalletSnapshotContext'
import { EvmWalletClientPublisher } from './EvmWalletClientContext'

export function EvmWalletPublisher({ children, onReady }: { children: ReactNode; onReady?: () => void }) {
  const wallet = useEvmWalletFromWagmi()
  const api = useEvmWalletSnapshotApi()
  const readySentRef = useRef(false)

  // Publish before paint so header network switches use a fresh switchToChainAsync.
  useLayoutEffect(() => {
    api.setSnapshot(wallet)
  }, [api, wallet])

  useLayoutEffect(() => {
    if (readySentRef.current) return
    readySentRef.current = true
    onReady?.()
  }, [onReady])

  return <EvmWalletClientPublisher>{children}</EvmWalletClientPublisher>
}
