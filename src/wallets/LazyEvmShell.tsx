import { lazy, ReactNode, Suspense, useEffect, useState } from 'react'

const loadEvmProvider = () =>
  import('./EvmProvider').then((module) => ({ default: module.EvmProvider }))

const EvmProvider = lazy(loadEvmProvider)

/** Warm the wagmi / RainbowKit chunk before Connect Wallet opens. */
export function preloadEvmProvider(): void {
  void loadEvmProvider()
}

type LazyEvmShellProps = {
  enabled: boolean
  rainbowKitEnabled: boolean
  onReady: () => void
  children: ReactNode
}

/** Loads wagmi / RainbowKit only when EVM wallet or backtest is needed. */
export function LazyEvmShell({ enabled, rainbowKitEnabled, onReady, children }: LazyEvmShellProps) {
  // Sticky: once mounted, keep the provider so enable/disable does not remount
  // the app tree into a blank Suspense flash.
  const [everEnabled, setEverEnabled] = useState(enabled)
  useEffect(() => {
    if (enabled) setEverEnabled(true)
  }, [enabled])

  if (!everEnabled) return <>{children}</>

  // Keep the app tree visible while the wagmi chunk loads. Pages must not call
  // wagmi hooks directly — use snapshot / EvmWalletClientContext instead.
  return (
    <Suspense fallback={children}>
      <EvmProvider rainbowKitEnabled={rainbowKitEnabled} onReady={onReady}>
        {children}
      </EvmProvider>
    </Suspense>
  )
}
