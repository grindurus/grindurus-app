import { lazy, ReactNode, Suspense } from 'react'

const loadSolanaProvider = () =>
  import('./SolanaProvider').then((module) => ({ default: module.SolanaProvider }))

const SolanaProvider = lazy(loadSolanaProvider)

/** Warm the Solana wallet-adapter chunk before Connect Wallet opens the Solana tab. */
export function preloadSolanaProvider(): void {
  void loadSolanaProvider()
}

type LazySolanaShellProps = {
  enabled: boolean
  onReady: () => void
  children: ReactNode
}

/** Loads Solana wallet adapters only when Solana is the active / requested chain. */
export function LazySolanaShell({ enabled, onReady, children }: LazySolanaShellProps) {
  if (!enabled) return <>{children}</>

  return (
    <Suspense fallback={children}>
      <SolanaProvider onReady={onReady}>{children}</SolanaProvider>
    </Suspense>
  )
}
