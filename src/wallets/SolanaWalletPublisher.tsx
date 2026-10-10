import { ReactNode, useLayoutEffect, useRef } from 'react'
import { useSolanaWalletFromAdapter } from './useSolanaWalletFromAdapter'
import { useSolanaWalletSnapshotApi } from './SolanaWalletSnapshotContext'
import type { SolanaWalletSnapshot } from './solanaWalletTypes'

export function SolanaWalletPublisher({
  children,
  onReady,
}: {
  children: ReactNode
  onReady?: () => void
}) {
  const wallet = useSolanaWalletFromAdapter()
  const api = useSolanaWalletSnapshotApi()
  const readySentRef = useRef(false)

  useLayoutEffect(() => {
    api.setSnapshot(wallet as SolanaWalletSnapshot)
  }, [api, wallet])

  useLayoutEffect(() => {
    return () => {
      api.resetSnapshot()
    }
  }, [api])

  useLayoutEffect(() => {
    if (readySentRef.current) return
    readySentRef.current = true
    onReady?.()
  }, [onReady])

  return <>{children}</>
}
