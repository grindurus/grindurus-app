import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { Connection } from '@solana/web3.js'
import { useWalletContext, type EvmChain, type SolanaCluster } from '../wallets/walletContext'
import { useSolanaWallet } from '../wallets/useSolanaWallet'
import { deferAfterPaint } from '../utils/deferAfterPaint'
import { useEvmWallet } from '../wallets/useEvmWallet'
import {
  getDefaultGraiSolanaCluster,
  GraiEvmConfig,
  GraiSolanaConfig,
  GraiSolanaRuntime,
  evmExplorerAccountUrl,
  evmExplorerTokenUrl,
  evmExplorerTxUrl,
  resolveGraiEvmConfig,
  resolveGraiSolanaConfig,
  resolveGraiSolanaRuntime,
  resolveSolanaRpcUrl,
  solscanTokenUrl,
  solscanTxUrl,
  solscanAccountUrl,
} from './deployments'
import { getSharedJsonRpcBatchFetch } from './jsonRpcBatchFetch'
import { GraiSolanaDevnetPin } from './GraiSolanaDevnetPin'

function evmChainToChainId(evmChain: EvmChain): number {
  if (evmChain === 'ethereum') return 1
  if (evmChain === 'base') return 8453
  if (evmChain === 'arbitrum') return 42161
  if (evmChain === 'polygon') return 137
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
  const {
    selectedChainType,
    setSelectedChainType,
    evmChain,
    solanaCluster: appSolanaCluster,
  } = useWalletContext()
  const {
    walletClusterMismatch,
    isConnected: isSolanaConnected,
    connection: walletConnection,
  } = useSolanaWallet()
  const evmWallet = useEvmWallet()

  // Follow the header / Connect Wallet cluster — same as GRS (never ignore Devnet).
  const solanaCluster = appSolanaCluster || getDefaultGraiSolanaCluster()
  const staticSolana = useMemo(() => resolveGraiSolanaConfig(solanaCluster), [solanaCluster])
  // Prefer the wallet-adapter Connection when Solana stack is mounted; otherwise a
  // standalone RPC client so protocol reads still work without loading adapters.
  const connection = useMemo(() => {
    if (!staticSolana) return null
    if (walletConnection) return walletConnection
    return new Connection(resolveSolanaRpcUrl(solanaCluster), {
      commitment: 'confirmed',
      fetch: getSharedJsonRpcBatchFetch(),
    })
  }, [staticSolana, walletConnection, solanaCluster])
  const [solana, setSolana] = useState<GraiSolanaRuntime | null>(null)
  const [isProtocolResolving, setIsProtocolResolving] = useState(() => staticSolana !== null)
  const [protocolError, setProtocolError] = useState<string | null>(null)
  const hasStaticConfig = staticSolana !== null

  // Fill null selection from the connected wallet only — never overwrite an
  // explicit Mainnet/Testnet choice (that fought the header and blanked GRAI).
  useEffect(() => {
    if (selectedChainType !== null) return
    if (evmWallet.isConnected && !isSolanaConnected) {
      setSelectedChainType('evm')
      return
    }
    if (isSolanaConnected && !evmWallet.isConnected && staticSolana) {
      setSelectedChainType('solana')
    }
  }, [
    evmWallet.isConnected,
    isSolanaConnected,
    selectedChainType,
    setSelectedChainType,
    staticSolana,
  ])

  const evm = useMemo(() => {
    if (selectedChainType === 'solana') return null
    // Connected wallet on a configured chain wins for protocol reads when on EVM.
    if (selectedChainType === 'evm' && evmWallet.isConnected) {
      return resolveGraiEvmConfig(evmWallet.chainId) ?? resolveGraiEvmConfig(evmChainToChainId(evmChain))
    }
    if (selectedChainType === 'evm') {
      return resolveGraiEvmConfig(evmChainToChainId(evmChain))
    }
    if (evmWallet.isConnected && !isSolanaConnected) {
      return resolveGraiEvmConfig(evmWallet.chainId) ?? resolveGraiEvmConfig(evmChainToChainId(evmChain))
    }
    return resolveGraiEvmConfig(evmChainToChainId(evmChain))
  }, [evmChain, evmWallet.chainId, evmWallet.isConnected, isSolanaConnected, selectedChainType])

  const chainKind = useMemo((): GraiDeploymentContextValue['chainKind'] => {
    // Explicit selection wins over leftover wallet sessions (Mainnet↔Testnet).
    // Stay on EVM when selected even if Sepolia has no deploy (show notice) —
    // never fall through to Solana with stale 0x assets (crashed the React root).
    if (selectedChainType === 'solana') return staticSolana ? 'solana' : null
    if (selectedChainType === 'evm') return 'evm'
    if (evmWallet.isConnected && !isSolanaConnected) return 'evm'
    if (isSolanaConnected && !evmWallet.isConnected && staticSolana) return 'solana'
    if (evm) return 'evm'
    if (staticSolana) return 'solana'
    return null
  }, [evm, evmWallet.isConnected, isSolanaConnected, selectedChainType, staticSolana])

  // Phantom/Solflare/MetaMask may still be on Mainnet while the app cluster is Devnet.
  const clusterMismatch =
    selectedChainType === 'solana' && isSolanaConnected && walletClusterMismatch

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

  return (
    <GraiDeploymentContext.Provider value={value}>
      <GraiSolanaDevnetPin />
      {children}
    </GraiDeploymentContext.Provider>
  )
}

export function useGraiDeployment() {
  const context = useContext(GraiDeploymentContext)
  if (!context) {
    throw new Error('useGraiDeployment must be used within GraiDeploymentProvider')
  }
  return context
}
