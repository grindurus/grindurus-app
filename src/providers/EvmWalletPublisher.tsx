import { ReactNode, useEffect, useRef } from 'react'
import { useEvmWalletFromWagmi } from '../hooks/useEvmWalletFromWagmi'
import { useEvmWalletSnapshotApi } from './EvmWalletSnapshotContext'

export function EvmWalletPublisher({ children, onReady }: { children: ReactNode; onReady?: () => void }) {
  const wallet = useEvmWalletFromWagmi()
  const api = useEvmWalletSnapshotApi()
  const readySentRef = useRef(false)

  // Defer snapshot writes so Wagmi's <Hydrate> never sees a sibling/parent setState mid-render
  // (common when connecting MetaMask before an account is restored).
  useEffect(() => {
    let cancelled = false
    const publish = () => {
      if (!cancelled) api.setSnapshot(wallet)
    }
    const timer = window.setTimeout(publish, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [api, wallet])

  useEffect(() => {
    if (readySentRef.current) return
    readySentRef.current = true
    const timer = window.setTimeout(() => onReady?.(), 0)
    return () => window.clearTimeout(timer)
  }, [onReady])

  return <>{children}</>
}
