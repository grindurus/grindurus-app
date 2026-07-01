import { ComponentType, ReactNode, useCallback, useEffect, useState } from 'react'
import { useResetEvmWalletSnapshot } from './EvmWalletSnapshotContext'

type LoadedEvmProviderProps = {
  children: ReactNode
  rainbowKitEnabled: boolean
  onReady?: () => void
}

interface EvmProviderGateProps {
  enabled: boolean
  rainbowKitEnabled: boolean
  onStackReady?: () => void
  children: ReactNode
}

export function EvmProviderGate({
  enabled,
  rainbowKitEnabled,
  onStackReady,
  children,
}: EvmProviderGateProps) {
  const [LoadedProvider, setLoadedProvider] = useState<ComponentType<LoadedEvmProviderProps> | null>(
    null,
  )
  const resetEvmWalletSnapshot = useResetEvmWalletSnapshot()

  const handleReady = useCallback(() => {
    onStackReady?.()
  }, [onStackReady])

  useEffect(() => {
    if (!enabled) {
      setLoadedProvider(null)
      resetEvmWalletSnapshot()
      return
    }

    let cancelled = false
    void import('./EvmProvider').then((module) => {
      if (!cancelled) {
        setLoadedProvider(() => module.EvmProvider)
      }
    })

    return () => {
      cancelled = true
    }
  }, [enabled, resetEvmWalletSnapshot])

  if (!enabled || !LoadedProvider) {
    return <>{children}</>
  }

  return (
    <LoadedProvider rainbowKitEnabled={rainbowKitEnabled} onReady={handleReady}>
      {children}
    </LoadedProvider>
  )
}
