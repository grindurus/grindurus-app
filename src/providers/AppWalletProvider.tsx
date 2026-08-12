import { ReactNode, useState, useCallback, useEffect, useMemo } from 'react'
import {
  WalletContext,
  useWalletContext,
  type ChainType,
  type EvmChain,
  type SolanaCluster,
  type WalletContextType,
} from './walletContext'
import { getDefaultGraiSolanaCluster } from '../grai/deployments'
import { stripBasePath } from '../utils/appPaths'
import { SolanaProvider } from './SolanaProvider'
import { LazyEvmShell, preloadEvmProvider } from './LazyEvmShell'
import { EvmWalletSnapshotProvider } from './EvmWalletSnapshotContext'
import { ChainSelectorModal } from '../components/ChainSelectorModal'

export type { ChainType, EvmChain, SolanaCluster, WalletContextType }
export { useWalletContext }

interface AppWalletProviderProps {
  children: ReactNode
}

function pathNeedsEvmStack(pathname: string): boolean {
  const path = stripBasePath(pathname)
  return path === '/grai' || path.startsWith('/grai/') || path === '/backtest'
}

export function AppWalletProvider({ children }: AppWalletProviderProps) {
  const [selectedChainType, setSelectedChainType] = useState<ChainType>(() => {
    const saved = localStorage.getItem('selectedChainType')
    return (saved as ChainType) || null
  })

  const [evmChain, setEvmChain] = useState<EvmChain>(() => {
    const saved = localStorage.getItem('evmChain')
    return (saved as EvmChain) || 'ethereum'
  })

  const [solanaCluster, setSolanaCluster] = useState<SolanaCluster>(() => {
    const saved = localStorage.getItem('solanaCluster')
    const cluster = (saved as SolanaCluster) || getDefaultGraiSolanaCluster()
    return cluster === 'testnet' ? 'devnet' : cluster
  })

  const [isChainSelectorOpen, setIsChainSelectorOpen] = useState(false)
  const [evmStackRequested, setEvmStackRequested] = useState(
    () =>
      typeof window !== 'undefined' &&
      (pathNeedsEvmStack(window.location.pathname) ||
        localStorage.getItem('selectedChainType') === 'evm'),
  )
  const [rainbowKitEnabled, setRainbowKitEnabled] = useState(false)
  const [isEvmStackReady, setIsEvmStackReady] = useState(false)
  const [pendingWalletConnectOpen, setPendingWalletConnectOpen] = useState(false)

  useEffect(() => {
    if (selectedChainType) {
      localStorage.setItem('selectedChainType', selectedChainType)
    } else {
      localStorage.removeItem('selectedChainType')
    }
  }, [selectedChainType])

  useEffect(() => {
    localStorage.setItem('evmChain', evmChain)
  }, [evmChain])

  useEffect(() => {
    if (solanaCluster === 'testnet') {
      setSolanaCluster('devnet')
    }
  }, [solanaCluster])

  useEffect(() => {
    localStorage.setItem('solanaCluster', solanaCluster)
  }, [solanaCluster])

  const warmEvmStack = useCallback(() => {
    preloadEvmProvider()
    setEvmStackRequested(true)
  }, [])

  // Prefetch wagmi chunk on idle so Connect Wallet is not blocked on first open.
  useEffect(() => {
    if (evmStackRequested) {
      preloadEvmProvider()
      return
    }

    const warm = () => {
      preloadEvmProvider()
      setEvmStackRequested(true)
    }

    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(warm, { timeout: 2000 })
      return () => window.cancelIdleCallback(idleId)
    }

    const timeoutId = window.setTimeout(warm, 1200)
    return () => window.clearTimeout(timeoutId)
  }, [evmStackRequested])

  const requestRainbowKit = useCallback(() => {
    setRainbowKitEnabled(true)
    setPendingWalletConnectOpen(true)
  }, [])

  const clearPendingWalletConnectOpen = useCallback(() => {
    setPendingWalletConnectOpen(false)
  }, [])

  const openChainSelector = useCallback(() => {
    warmEvmStack()
    setIsChainSelectorOpen(true)
  }, [warmEvmStack])

  const closeChainSelector = useCallback(() => {
    setIsChainSelectorOpen(false)
  }, [])

  const disconnect = useCallback(() => {
    setSelectedChainType(null)
    localStorage.removeItem('selectedChainType')
  }, [])

  const needsEvmStack =
    evmStackRequested ||
    rainbowKitEnabled ||
    selectedChainType === 'evm' ||
    isChainSelectorOpen ||
    pathNeedsEvmStack(typeof window !== 'undefined' ? window.location.pathname : '')

  const handleEvmStackReady = useCallback(() => {
    setIsEvmStackReady(true)
  }, [])

  useEffect(() => {
    if (!needsEvmStack) setIsEvmStackReady(false)
  }, [needsEvmStack])

  const value = useMemo<WalletContextType>(
    () => ({
      selectedChainType,
      setSelectedChainType,
      evmChain,
      setEvmChain,
      solanaCluster,
      setSolanaCluster,
      isChainSelectorOpen,
      openChainSelector,
      closeChainSelector,
      disconnect,
      requestRainbowKit,
      warmEvmStack,
      isEvmStackReady,
      pendingWalletConnectOpen,
      clearPendingWalletConnectOpen,
    }),
    [
      selectedChainType,
      evmChain,
      solanaCluster,
      isChainSelectorOpen,
      openChainSelector,
      closeChainSelector,
      disconnect,
      requestRainbowKit,
      warmEvmStack,
      isEvmStackReady,
      pendingWalletConnectOpen,
      clearPendingWalletConnectOpen,
    ],
  )

  return (
    <WalletContext.Provider value={value}>
      <EvmWalletSnapshotProvider>
        <SolanaProvider>
          <LazyEvmShell
            enabled={needsEvmStack}
            rainbowKitEnabled={rainbowKitEnabled}
            onReady={handleEvmStackReady}
          >
            {children}
          </LazyEvmShell>
          <ChainSelectorModal isOpen={isChainSelectorOpen} onClose={closeChainSelector} />
        </SolanaProvider>
      </EvmWalletSnapshotProvider>
    </WalletContext.Provider>
  )
}
