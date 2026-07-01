import { ReactNode, createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import { ChainSelectorModal } from '../components/ChainSelectorModal'
import { getDefaultGraiSolanaCluster } from '../grai/deployments'
import { SolanaProvider } from './SolanaProvider'
import { EvmProvider } from './EvmProvider'
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
  requestRainbowKit: () => void
  isEvmStackReady: boolean
  pendingWalletConnectOpen: boolean
  clearPendingWalletConnectOpen: () => void
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

  const requestRainbowKit = useCallback(() => {
    setRainbowKitEnabled(true)
    setPendingWalletConnectOpen(true)
  }, [])

  const clearPendingWalletConnectOpen = useCallback(() => {
    setPendingWalletConnectOpen(false)
  }, [])

  const openChainSelector = useCallback(() => {
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
      requestRainbowKit,
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
      isEvmStackReady,
      pendingWalletConnectOpen,
      clearPendingWalletConnectOpen,
    ],
  )

  return (
    <WalletContext.Provider value={value}>
      <EvmWalletSnapshotProvider>
        <SolanaProvider>
          <EvmProvider
            rainbowKitEnabled={rainbowKitEnabled}
            onReady={() => setIsEvmStackReady(true)}
          >
            {children}
          </EvmProvider>
          <ChainSelectorModal isOpen={isChainSelectorOpen} onClose={closeChainSelector} />
        </SolanaProvider>
      </EvmWalletSnapshotProvider>
    </WalletContext.Provider>
  )
}
