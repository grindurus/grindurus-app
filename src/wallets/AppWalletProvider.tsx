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
import { LazySolanaShell, preloadSolanaProvider } from './LazySolanaShell'
import { LazyEvmShell, preloadEvmProvider } from './LazyEvmShell'
import { EvmWalletSnapshotProvider } from './EvmWalletSnapshotContext'
import { SolanaWalletSnapshotProvider } from './SolanaWalletSnapshotContext'
import { ChainSelectorModal } from '../components/ChainSelectorModal'
import { ExclusiveWalletSync } from './ExclusiveWalletSync'
import {
  defaultEvmChainForEnv,
  networkEnvFromEvmChain,
  networkEnvFromSolanaCluster,
  preferredSolanaCluster,
  type NetworkEnv,
} from './networkEnv'

export type { ChainType, EvmChain, SolanaCluster, WalletContextType }
export { useWalletContext }

interface AppWalletProviderProps {
  children: ReactNode
}

function readSavedNetworkEnv(): NetworkEnv {
  const saved = localStorage.getItem('networkEnv')
  if (saved === 'mainnet' || saved === 'testnet') return saved
  // Migrate from legacy solanaCluster preference.
  const cluster = localStorage.getItem('solanaCluster')
  if (cluster && cluster !== 'mainnet-beta') return 'testnet'
  const evm = localStorage.getItem('evmChain')
  if (evm === 'sepolia') return 'testnet'
  return 'mainnet'
}

export function AppWalletProvider({ children }: AppWalletProviderProps) {
  const [selectedChainType, setSelectedChainType] = useState<ChainType>(() => {
    const saved = localStorage.getItem('selectedChainType')
    return (saved as ChainType) || null
  })

  const [networkEnv, setNetworkEnvState] = useState<NetworkEnv>(readSavedNetworkEnv)

  const [evmChain, setEvmChain] = useState<EvmChain>(() => {
    const saved = localStorage.getItem('evmChain')
    if (saved === 'ethereum' || saved === 'base' || saved === 'arbitrum' || saved === 'polygon' || saved === 'sepolia') {
      return saved
    }
    return defaultEvmChainForEnv(readSavedNetworkEnv())
  })

  const [solanaCluster, setSolanaCluster] = useState<SolanaCluster>(() => {
    const saved = localStorage.getItem('solanaCluster')
    const cluster = (saved as SolanaCluster) || getDefaultGraiSolanaCluster()
    return cluster === 'testnet' ? 'devnet' : cluster
  })

  const [isChainSelectorOpen, setIsChainSelectorOpen] = useState(false)
  // Both stacks stay warm — toggling XOR used to remount the whole app tree.
  const [evmStackRequested, setEvmStackRequested] = useState(true)
  const [solanaStackRequested, setSolanaStackRequested] = useState(true)
  const [rainbowKitEnabled, setRainbowKitEnabled] = useState(false)
  const [isEvmStackReady, setIsEvmStackReady] = useState(false)
  const [isSolanaStackReady, setIsSolanaStackReady] = useState(false)
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

  useEffect(() => {
    localStorage.setItem('networkEnv', networkEnv)
  }, [networkEnv])

  /**
   * Sole writer for the Mainnet / Testnet toggle. Applies matching chain prefs
   * atomically — never inferred from wallet chainId, never remounts stacks.
   */
  const setNetworkEnv = useCallback((env: NetworkEnv) => {
    setNetworkEnvState(env)
    setEvmChain(defaultEvmChainForEnv(env))
    setSolanaCluster(preferredSolanaCluster(env))
  }, [])

  /** Keep `networkEnv` aligned when a picker sets EVM chain directly. */
  const setEvmChainSynced = useCallback((chain: EvmChain) => {
    const env = networkEnvFromEvmChain(chain)
    setEvmChain(chain)
    setNetworkEnvState(env)
    setSolanaCluster(preferredSolanaCluster(env))
  }, [])

  /** Keep `networkEnv` aligned when a picker sets Solana cluster directly. */
  const setSolanaClusterSynced = useCallback((cluster: SolanaCluster) => {
    const normalized = cluster === 'testnet' ? 'devnet' : cluster
    const env = networkEnvFromSolanaCluster(normalized)
    setSolanaCluster(normalized)
    setNetworkEnvState(env)
    setEvmChain(defaultEvmChainForEnv(env))
  }, [])

  const warmEvmStack = useCallback(() => {
    setEvmStackRequested(true)
    preloadEvmProvider()
  }, [])

  const warmSolanaStack = useCallback(() => {
    setRainbowKitEnabled(false)
    setPendingWalletConnectOpen(false)
    setSolanaStackRequested(true)
    preloadSolanaProvider()
  }, [])

  const requestRainbowKit = useCallback(() => {
    setEvmStackRequested(true)
    setRainbowKitEnabled(true)
    setPendingWalletConnectOpen(true)
    preloadEvmProvider()
  }, [])

  const clearPendingWalletConnectOpen = useCallback(() => {
    setPendingWalletConnectOpen(false)
  }, [])

  const openChainSelector = useCallback(() => {
    warmEvmStack()
    warmSolanaStack()
    setIsChainSelectorOpen(true)
  }, [warmEvmStack, warmSolanaStack])

  const closeChainSelector = useCallback(() => {
    setIsChainSelectorOpen(false)
  }, [])

  const disconnect = useCallback(() => {
    setSelectedChainType(null)
    localStorage.removeItem('selectedChainType')
    setEvmStackRequested(true)
    setSolanaStackRequested(true)
    setRainbowKitEnabled(false)
  }, [])

  // Always keep both stacks mounted after first paint — prevents Suspense remount flashes.
  const needsEvmStack = evmStackRequested || rainbowKitEnabled
  const needsSolanaStack = solanaStackRequested

  const handleEvmStackReady = useCallback(() => {
    setIsEvmStackReady(true)
  }, [])

  const handleSolanaStackReady = useCallback(() => {
    setIsSolanaStackReady(true)
  }, [])

  const value = useMemo<WalletContextType>(
    () => ({
      selectedChainType,
      setSelectedChainType,
      evmChain,
      setEvmChain: setEvmChainSynced,
      solanaCluster,
      setSolanaCluster: setSolanaClusterSynced,
      networkEnv,
      setNetworkEnv,
      isChainSelectorOpen,
      openChainSelector,
      closeChainSelector,
      disconnect,
      requestRainbowKit,
      warmEvmStack,
      warmSolanaStack,
      isEvmStackReady,
      isSolanaStackReady,
      pendingWalletConnectOpen,
      clearPendingWalletConnectOpen,
    }),
    [
      selectedChainType,
      setSelectedChainType,
      evmChain,
      setEvmChainSynced,
      solanaCluster,
      setSolanaClusterSynced,
      networkEnv,
      setNetworkEnv,
      isChainSelectorOpen,
      openChainSelector,
      closeChainSelector,
      disconnect,
      requestRainbowKit,
      warmEvmStack,
      warmSolanaStack,
      isEvmStackReady,
      isSolanaStackReady,
      pendingWalletConnectOpen,
      clearPendingWalletConnectOpen,
    ],
  )

  return (
    <WalletContext.Provider value={value}>
      <EvmWalletSnapshotProvider>
        <SolanaWalletSnapshotProvider>
          <LazySolanaShell enabled={needsSolanaStack} onReady={handleSolanaStackReady}>
            <LazyEvmShell
              enabled={needsEvmStack}
              rainbowKitEnabled={rainbowKitEnabled}
              onReady={handleEvmStackReady}
            >
              <ExclusiveWalletSync />
              {children}
            </LazyEvmShell>
          </LazySolanaShell>
          {/* Outside lazy shells so stack mount/unmount does not remount the modal. */}
          <ChainSelectorModal isOpen={isChainSelectorOpen} onClose={closeChainSelector} />
        </SolanaWalletSnapshotProvider>
      </EvmWalletSnapshotProvider>
    </WalletContext.Provider>
  )
}
