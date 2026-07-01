import { ReactNode, Suspense, lazy, useMemo } from 'react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { wagmiConfig } from './evmConfig'
import { EvmWalletPublisher } from './EvmWalletPublisher'

const LazyRainbowKitShell = lazy(() =>
  import('./RainbowKitShell').then((module) => ({ default: module.RainbowKitShell })),
)

const queryClient = new QueryClient()

interface EvmProviderProps {
  children: ReactNode
  rainbowKitEnabled: boolean
  onReady?: () => void
}

export function EvmProvider({ children, rainbowKitEnabled, onReady }: EvmProviderProps) {
  const inner = useMemo(
    () => <EvmWalletPublisher onReady={onReady}>{children}</EvmWalletPublisher>,
    [children, onReady],
  )

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {rainbowKitEnabled ? (
          <Suspense fallback={inner}>
            <LazyRainbowKitShell>{inner}</LazyRainbowKitShell>
          </Suspense>
        ) : (
          inner
        )}
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export { wagmiConfig as config }
