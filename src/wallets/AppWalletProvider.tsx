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
import { LazySolanaShell, preloadSolanaProvider } from './LazySolanaShell'
import { LazyEvmShell, preloadEvmProvider } from './LazyEvmShell'
import { EvmWalletSnapshotProvider } from './EvmWalletSnapshotContext'
import { SolanaWalletSnapshotProvider } from './SolanaWalletSnapshotContext'
import { ChainSelectorModal } from '../components/ChainSelectorModal'
import { ExclusiveWalletSync } from './ExclusiveWalletSync'

export type { ChainType, EvmChain, SolanaCluster, WalletContextType }
export { useWalletContext }

interface AppWalletProviderProps {
  children: ReactNode
}

/** Routes that require the EVM stack even before a wallet is selected. */
function pathNeedsEvmStack(pathname: string): boolean {
  const path = stripBasePath(pathname)
  return path === '/backtest'
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
  const initialPathNeedsEvm =
    typeof window !== 'undefined' && pathNeedsEvmStack(window.location.pathname)
  const initialSelectedChain =
    typeof window !== 'undefined' ? localStorage.getItem('selectedChainType') : null
  // No wallet selected → both stacks eager (no "Initializing…" in the modal).
  // Connected → only the active chain's stack (XOR below).
  const [evmStackRequested, setEvmStackRequested] = useState(
    () => initialPathNeedsEvm || initialSelectedChain !== 'solana',
  )
  const [solanaStackRequested, setSolanaStackRequested] = useState(
    () => initialSelectedChain !== 'evm',
  )
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

  // Keep stacks warm once requested. Tearing down EVM while Solana is connected
  // (and vice versa) emptied connector lists after disconnect until a full remount.
  useEffect(() => {
    if (selectedChainType === 'solana') {
      setSolanaStackRequested(true)
      setRainbowKitEnabled(false)
      setPendingWalletConnectOpen(false)
    } else if (selectedChainType === 'evm') {
      setEvmStackRequested(true)
    } else {
      setEvmStackRequested(true)
      setSolanaStackRequested(true)
    }
  }, [selectedChainType])

  const warmEvmStack = useCallback(() => {
    // Do not tear down Solana here — unmounting LazySolanaShell remounts the app
    // tree. XOR teardown stays on selectedChainType below.
    setEvmStackRequested(true)
    preloadEvmProvider()
  }, [])

  const warmSolanaStack = useCallback(() => {
    // Same: warming a tab must not unmount the other stack (that remounted the
    // chain-selector modal and snapped the Solana tab back to EVM).
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
    // Always warm both — Connect Wallet must list EVM + Solana options even
    // after disconnecting one chain (XOR teardown used to leave the other empty).
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

  const pathWantsEvm =
    typeof window !== 'undefined' && pathNeedsEvmStack(window.location.pathname)

  // Disconnected → both stacks always mounted (no lazy gate in Connect Wallet).
  // Connected → honor stack requests / selection (XOR tears the other down).
  const disconnected = selectedChainType == null
  const needsEvmStack =
    pathWantsEvm ||
    disconnected ||
    evmStackRequested ||
    rainbowKitEnabled ||
    selectedChainType === 'evm'

  const needsSolanaStack =
    disconnected || solanaStackRequested || selectedChainType === 'solana'

  const handleEvmStackReady = useCallback(() => {
    setIsEvmStackReady(true)
  }, [])

  const handleSolanaStackReady = useCallback(() => {
    setIsSolanaStackReady(true)
  }, [])

  useEffect(() => {
    if (!needsEvmStack) setIsEvmStackReady(false)
  }, [needsEvmStack])

  useEffect(() => {
    if (!needsSolanaStack) setIsSolanaStackReady(false)
  }, [needsSolanaStack])

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
      warmSolanaStack,
      isEvmStackReady,
      isSolanaStackReady,
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
