import { ReactNode, createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import { getDefaultGraiSolanaCluster } from '../grai/deployments'
import { stripBasePath } from '../utils/appPaths'
import { SolanaProvider } from './SolanaProvider'
import { EvmProviderGate } from './EvmProviderGate'
import { EvmWalletSnapshotProvider } from './EvmWalletSnapshotContext'

export type ChainType = 'evm' | 'solana' | null
export type EvmChain = 'ethereum' | 'arbitrum' | 'sepolia'
export type SolanaCluster = 'mainnet-beta' | 'testnet' | 'devnet'

interface WalletContextType {
  selectedChainType: ChainType
  setSelectedChainType: (type: ChainType) => void
  evmChain: EvmChain
  setEvmChain: (chain: EvmChain) => void
  solanaCluster: SolanaCluster
  setSolanaCluster: (cluster: SolanaCluster) => void
  isChainSelectorOpen: boolean
  openChainSelector: () => void
  closeChainSelector: () => void
  disconnect: () => void
  requestEvmStack: () => void
  requestRainbowKit: () => void
  isEvmStackEnabled: boolean
  isEvmStackReady: boolean
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function useWalletContext() {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWalletContext must be used within AppWalletProvider')
  }
  return context
}

interface AppWalletProviderProps {
  children: ReactNode
}

function readIsBacktestRoute(): boolean {
  return stripBasePath(window.location.pathname) === '/backtest'
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
  const [isBacktestRoute, setIsBacktestRoute] = useState(readIsBacktestRoute)
  const [evmStackPinned, setEvmStackPinned] = useState(
    () => localStorage.getItem('selectedChainType') === 'evm' || readIsBacktestRoute(),
  )
  const [rainbowKitEnabled, setRainbowKitEnabled] = useState(false)
  const [isEvmStackReady, setIsEvmStackReady] = useState(false)

  const isEvmStackEnabled =
    evmStackPinned || selectedChainType === 'evm' || isChainSelectorOpen || isBacktestRoute

  useEffect(() => {
    if (!isEvmStackEnabled) {
      setIsEvmStackReady(false)
    }
  }, [isEvmStackEnabled])

  useEffect(() => {
    const syncRoute = () => setIsBacktestRoute(readIsBacktestRoute())
    syncRoute()
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  useEffect(() => {
    if (isBacktestRoute) {
      setEvmStackPinned(true)
    }
  }, [isBacktestRoute])

  useEffect(() => {
    if (selectedChainType) {
      localStorage.setItem('selectedChainType', selectedChainType)
      if (selectedChainType === 'evm') {
        setEvmStackPinned(true)
      }
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

  const requestEvmStack = useCallback(() => {
    setEvmStackPinned(true)
  }, [])

  const requestRainbowKit = useCallback(() => {
    setEvmStackPinned(true)
    setRainbowKitEnabled(true)
  }, [])

  const openChainSelector = useCallback(() => {
    setEvmStackPinned(true)
    setIsChainSelectorOpen(true)
  }, [])

  const closeChainSelector = useCallback(() => {
    setIsChainSelectorOpen(false)
  }, [])

  const disconnect = useCallback(() => {
    setSelectedChainType(null)
    localStorage.removeItem('selectedChainType')
  }, [])

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
      requestEvmStack,
      requestRainbowKit,
      isEvmStackEnabled,
      isEvmStackReady,
    }),
    [
      selectedChainType,
      evmChain,
      solanaCluster,
      isChainSelectorOpen,
      openChainSelector,
      closeChainSelector,
      disconnect,
      requestEvmStack,
      requestRainbowKit,
      isEvmStackEnabled,
      isEvmStackReady,
    ],
  )

  return (
    <WalletContext.Provider value={value}>
      <EvmWalletSnapshotProvider>
        <SolanaProvider>
          <EvmProviderGate
            enabled={isEvmStackEnabled}
            rainbowKitEnabled={rainbowKitEnabled}
            onStackReady={() => setIsEvmStackReady(true)}
          >
            {children}
          </EvmProviderGate>
        </SolanaProvider>
      </EvmWalletSnapshotProvider>
    </WalletContext.Provider>
  )
}
