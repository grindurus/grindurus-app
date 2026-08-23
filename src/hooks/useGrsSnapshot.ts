import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEvmWallet } from './useEvmWallet'
import { useSolanaWallet } from './useSolanaWallet'
import { useWalletContext } from '../providers/AppWalletProvider'
import {
  createGrsSolanaConnection,
  getDefaultGrsSolanaCluster,
  listConfiguredGrsChains,
  resolveGrsEvmConfig,
  type GrsChainKind,
  type GrsConfig,
  type GrsEvmConfig,
  type GrsSolanaConfig,
} from '../grs/deployments'
import { fetchGrsSnapshot, type GrsSnapshot } from '../grs/evm/readProtocol'
import { fetchSolanaGrsSnapshot } from '../grs/solana/readProtocol'
import { resolveGrsSolanaConfigPreferringDevnet } from '../grs/fetchSalesBooks'

function contextChainId(evmChain: 'ethereum' | 'arbitrum' | 'sepolia'): number {
  if (evmChain === 'ethereum') return 1
  if (evmChain === 'arbitrum') return 42161
  return 11155111
}

export function useGrsSnapshot() {
  const evmWallet = useEvmWallet()
  const solanaWallet = useSolanaWallet()
  const { selectedChainType, setSelectedChainType, evmChain, solanaCluster } = useWalletContext()
  const wasSolanaConnected = useRef(solanaWallet.isConnected)

  const solanaConfigured = useMemo(
    () => Boolean(resolveGrsSolanaConfigPreferringDevnet(solanaCluster ?? getDefaultGrsSolanaCluster())),
    [solanaCluster],
  )
  const evmConfigured = listConfiguredGrsChains().length > 0

  // Connecting Solana should surface the spoke sale book (CA + snapshot), not stay stuck on a
  // persisted EVM selection from localStorage.
  useEffect(() => {
    const connected = solanaWallet.isConnected
    const justConnected = connected && !wasSolanaConnected.current
    wasSolanaConnected.current = connected
    if (!justConnected || !solanaConfigured) return
    if (selectedChainType !== 'solana') setSelectedChainType('solana')
  }, [selectedChainType, setSelectedChainType, solanaConfigured, solanaWallet.isConnected])

  // Solana-only session: don't keep reading Sepolia while the wallet that can buy is Solana.
  useEffect(() => {
    if (!solanaConfigured || !solanaWallet.isConnected) return
    if (evmWallet.isConnected) return
    if (selectedChainType === 'evm') setSelectedChainType('solana')
  }, [
    evmWallet.isConnected,
    selectedChainType,
    setSelectedChainType,
    solanaConfigured,
    solanaWallet.isConnected,
  ])

  const chainKind: GrsChainKind | null = useMemo(() => {
    // Solana wallet connected → spoke book (Token Sale / buy). CA can still switch later.
    if (solanaWallet.isConnected && solanaConfigured) return 'solana'
    if (selectedChainType === 'solana' && solanaConfigured) return 'solana'
    if (selectedChainType === 'evm' && evmConfigured) return 'evm'
    if (evmWallet.isConnected && evmConfigured) return 'evm'
    if (solanaConfigured) return 'solana'
    if (evmConfigured) return 'evm'
    return null
  }, [
    evmConfigured,
    evmWallet.isConnected,
    selectedChainType,
    solanaConfigured,
    solanaWallet.isConnected,
  ])

  const chainId = useMemo(() => {
    if (selectedChainType === 'evm' && evmWallet.isConnected && evmWallet.chainId) {
      return evmWallet.chainId
    }
    if (selectedChainType === 'evm') return contextChainId(evmChain)
    const configured = listConfiguredGrsChains()
    return configured[0]?.chainId ?? contextChainId(evmChain)
  }, [evmChain, evmWallet.chainId, evmWallet.isConnected, selectedChainType])

  const evmConfig = useMemo(() => resolveGrsEvmConfig(chainId), [chainId])
  const solanaConfig = useMemo(
    () => resolveGrsSolanaConfigPreferringDevnet(solanaCluster ?? getDefaultGrsSolanaCluster()),
    [solanaCluster],
  )

  const config: GrsConfig | null =
    chainKind === 'solana' ? solanaConfig : chainKind === 'evm' ? evmConfig : evmConfig ?? solanaConfig

  const owner =
    chainKind === 'solana'
      ? solanaWallet.address || undefined
      : evmWallet.isConnected
        ? (evmWallet.address as `0x${string}` | undefined)
        : undefined

  const [snapshot, setSnapshot] = useState<GrsSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const refresh = useCallback(() => {
    setReloadToken((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!config) {
      setSnapshot(null)
      setError(null)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    const load =
      config.kind === 'solana'
        ? fetchSolanaGrsSnapshot(createGrsSolanaConnection(config), config, owner ?? null)
        : fetchGrsSnapshot(config, owner as `0x${string}` | undefined)

    void load
      .then((next) => {
        if (!cancelled) {
          setSnapshot(next)
          setError(null)
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setSnapshot(null)
          setError(loadError instanceof Error ? loadError.message : 'Failed to load GRS')
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [config, owner, reloadToken])

  return {
    chainKind: config?.kind ?? chainKind,
    chainId,
    config,
    evmConfig,
    solanaConfig,
    snapshot,
    isLoading,
    error,
    refresh,
    configuredChains: listConfiguredGrsChains(),
    owner,
  }
}

export type { GrsEvmConfig, GrsSolanaConfig, GrsConfig, GrsChainKind }
