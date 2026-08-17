import { lazy, ReactNode, Suspense } from 'react'

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
  if (!enabled) return <>{children}</>

  return (
    <Suspense fallback={children}>
      <EvmProvider rainbowKitEnabled={rainbowKitEnabled} onReady={onReady}>
        {children}
      </EvmProvider>
    </Suspense>
  )
}
