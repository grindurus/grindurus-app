import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { Connection } from '@solana/web3.js'
import { useConnection } from '@solana/wallet-adapter-react'
import { useWalletContext, type EvmChain, type SolanaCluster } from '../providers/walletContext'
import { useSolanaWallet } from '../hooks/useSolanaWallet'
import { deferAfterPaint } from '../utils/deferAfterPaint'
import { useEvmWallet } from '../hooks/useEvmWallet'
import {
  getDefaultGraiSolanaCluster,
  GraiEvmConfig,
  GraiSolanaConfig,
  GraiSolanaRuntime,
  evmExplorerAccountUrl,
  evmExplorerTokenUrl,
  evmExplorerTxUrl,
  listConfiguredEvmChains,
  resolveGraiEvmConfig,
  resolveGraiSolanaConfig,
  resolveGraiSolanaRuntime,
  solscanTokenUrl,
  solscanTxUrl,
  solscanAccountUrl,
} from './deployments'

function chainIdToEvmChain(chainId: number): EvmChain | null {
  if (chainId === 1) return 'ethereum'
  if (chainId === 42161) return 'arbitrum'
  if (chainId === 11155111) return 'sepolia'
  return null
}

function evmChainToChainId(evmChain: EvmChain): number {
  if (evmChain === 'ethereum') return 1
  if (evmChain === 'arbitrum') return 42161
  if (evmChain === 'sepolia') return 11155111
  return 8453
}

type GraiDeploymentContextValue = {
  chainKind: 'solana' | 'evm' | null
  solanaCluster: SolanaCluster
  solana: GraiSolanaRuntime | null
  staticSolana: GraiSolanaConfig | null
  evm: GraiEvmConfig | null
  connection: Connection | null
  /** Env vars define a Solana deployment (mint + RPC URL). */
  hasStaticConfig: boolean
  /** On-chain protocol metadata resolved (program id, state PDA). */
  isConfigured: boolean
  isProtocolResolving: boolean
  protocolError: string | null
  clusterMismatch: boolean
  evmChainMismatch: boolean
  solscanTokenUrl: (mint: string) => string
  solscanTxUrl: (signature: string) => string
  solscanAccountUrl: (address: string) => string
  explorerTokenUrl: (address: string) => string | null
  explorerTxUrl: (id: string) => string | null
  explorerAccountUrl: (address: string) => string | null
}

const GraiDeploymentContext = createContext<GraiDeploymentContextValue | undefined>(undefined)

export function GraiDeploymentProvider({ children }: { children: ReactNode }) {
  const { selectedChainType, setSelectedChainType, evmChain, setEvmChain } = useWalletContext()
  const { cluster: walletCluster, isConnected: isSolanaConnected } = useSolanaWallet()
  const evmWallet = useEvmWallet()
  const { connection: walletConnection } = useConnection()

  const solanaCluster = getDefaultGraiSolanaCluster()
  const staticSolana = useMemo(() => resolveGraiSolanaConfig(solanaCluster), [solanaCluster])
  const connection = useMemo(
    () => (staticSolana ? walletConnection : null),
    [staticSolana, walletConnection],
  )
  const [solana, setSolana] = useState<GraiSolanaRuntime | null>(null)
  const [isProtocolResolving, setIsProtocolResolving] = useState(() => staticSolana !== null)
  const [protocolError, setProtocolError] = useState<string | null>(null)
  const hasStaticConfig = staticSolana !== null

  // Keep selectedChainType aligned with the only live wallet family.
  useEffect(() => {
    if (evmWallet.isConnected && !isSolanaConnected) {
      if (selectedChainType !== 'evm') setSelectedChainType('evm')
      const walletConfig =
        resolveGraiEvmConfig(evmWallet.chainId) ?? listConfiguredEvmChains()[0] ?? null
      const mapped = walletConfig ? chainIdToEvmChain(walletConfig.chainId) : null
      if (mapped && mapped !== evmChain) setEvmChain(mapped)
      return
    }
    if (isSolanaConnected && !evmWallet.isConnected && staticSolana) {
      if (selectedChainType !== 'solana') setSelectedChainType('solana')
    }
  }, [
    evmChain,
    evmWallet.chainId,
    evmWallet.isConnected,
    isSolanaConnected,
    selectedChainType,
    setEvmChain,
    setSelectedChainType,
    staticSolana,
  ])

  const evm = useMemo(() => {
    // Connected EVM wallet wins over a stale Solana selection (e.g. after GRS).
    if (evmWallet.isConnected && !isSolanaConnected) {
      return (
        resolveGraiEvmConfig(evmWallet.chainId) ?? listConfiguredEvmChains()[0] ?? null
      )
    }
    if (selectedChainType === 'solana') return null
    if (selectedChainType === 'evm') {
      return resolveGraiEvmConfig(evmChainToChainId(evmChain))
    }
    return null
  }, [evmChain, evmWallet.chainId, evmWallet.isConnected, isSolanaConnected, selectedChainType])

  const chainKind = useMemo((): GraiDeploymentContextValue['chainKind'] => {
    // Prefer the wallet that is actually connected so Claim / Mint show the action button.
    if (evmWallet.isConnected && !isSolanaConnected) {
      return evm ? 'evm' : null
    }
    if (isSolanaConnected && !evmWallet.isConnected && staticSolana) return 'solana'
    if (selectedChainType === 'solana' && staticSolana) return 'solana'
    if (selectedChainType === 'evm' && evm) return 'evm'
    if (evm) return 'evm'
    if (staticSolana) return 'solana'
    return null
  }, [evm, evmWallet.isConnected, isSolanaConnected, selectedChainType, staticSolana])

  const clusterMismatch =
    selectedChainType === 'solana' && isSolanaConnected && walletCluster !== null && walletCluster !== solanaCluster

  const evmChainMismatch =
    selectedChainType === 'evm' &&
    evmWallet.isConnected &&
    evm !== null &&
    evmWallet.chainId !== evm.chainId

  useEffect(() => {
    if (!connection || !staticSolana) {
      setSolana(null)
      setProtocolError(null)
      setIsProtocolResolving(false)
      return
    }

    let cancelled = false
    setIsProtocolResolving(true)
    setProtocolError(null)

    const cancelDefer = deferAfterPaint(() => {
      if (cancelled) return

      void resolveGraiSolanaRuntime(connection, staticSolana)
        .then((runtime) => {
          if (!cancelled) {
            setSolana(runtime)
            setProtocolError(null)
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setSolana(null)
            setProtocolError(error instanceof Error ? error.message : 'Failed to resolve GRAI protocol')
          }
        })
        .finally(() => {
          if (!cancelled) setIsProtocolResolving(false)
        })
    })

    return () => {
      cancelled = true
      cancelDefer()
    }
  }, [connection, staticSolana])

  const value = useMemo<GraiDeploymentContextValue>(
    () => ({
      chainKind,
      solanaCluster,
      solana,
      staticSolana,
      evm,
      connection,
      hasStaticConfig,
      isConfigured: chainKind === 'solana' ? solana !== null : chainKind === 'evm' ? evm !== null : false,
      isProtocolResolving,
      protocolError,
      clusterMismatch,
      evmChainMismatch,
      solscanTokenUrl: (mint: string) => solscanTokenUrl(solanaCluster, mint),
      solscanTxUrl: (signature: string) => solscanTxUrl(solanaCluster, signature),
      solscanAccountUrl: (address: string) => solscanAccountUrl(solanaCluster, address),
      explorerTokenUrl: (address: string) => {
        if (chainKind === 'evm' && evm) return evmExplorerTokenUrl(evm.chainId, address)
        if (chainKind === 'solana') return solscanTokenUrl(solanaCluster, address)
        return null
      },
      explorerTxUrl: (id: string) => {
        if (chainKind === 'evm' && evm) return evmExplorerTxUrl(evm.chainId, id)
        if (chainKind === 'solana') return solscanTxUrl(solanaCluster, id)
        return null
      },
      explorerAccountUrl: (address: string) => {
        if (chainKind === 'evm' && evm) return evmExplorerAccountUrl(evm.chainId, address)
        if (chainKind === 'solana') return solscanAccountUrl(solanaCluster, address)
        return null
      },
    }),
    [
      chainKind,
      clusterMismatch,
      evmChainMismatch,
      connection,
      evm,
      hasStaticConfig,
      isProtocolResolving,
      protocolError,
      solana,
      solanaCluster,
      staticSolana,
    ],
  )

  return <GraiDeploymentContext.Provider value={value}>{children}</GraiDeploymentContext.Provider>
}

export function useGraiDeployment() {
  const context = useContext(GraiDeploymentContext)
  if (!context) {
    throw new Error('useGraiDeployment must be used within GraiDeploymentProvider')
  }
  return context
}
