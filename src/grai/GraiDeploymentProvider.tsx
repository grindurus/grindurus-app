import { createContext, ReactNode, useContext, useEffect, useMemo } from 'react'
import { Connection } from '@solana/web3.js'
import { useWalletContext, type SolanaCluster } from '../providers/AppWalletProvider'
import { useSolanaWallet } from '../hooks/useSolanaWallet'
import { clearGraiStateCache } from './graiStateCache'
import {
  createGraiConnection,
  getDefaultGraiSolanaCluster,
  GraiEvmConfig,
  GraiSolanaConfig,
  resolveGraiEvmConfig,
  resolveGraiSolanaConfig,
  solscanTokenUrl,
  solscanTxUrl,
  solscanAccountUrl,
} from './deployments'

type GraiDeploymentContextValue = {
  chainKind: 'solana' | 'evm' | null
  solanaCluster: SolanaCluster
  solana: GraiSolanaConfig | null
  evm: GraiEvmConfig | null
  connection: Connection | null
  isConfigured: boolean
  clusterMismatch: boolean
  solscanTokenUrl: (mint: string) => string
  solscanTxUrl: (signature: string) => string
  solscanAccountUrl: (address: string) => string
}

const GraiDeploymentContext = createContext<GraiDeploymentContextValue | undefined>(undefined)

export function GraiDeploymentProvider({ children }: { children: ReactNode }) {
  const { selectedChainType, evmChain } = useWalletContext()
  const { cluster: walletCluster, isConnected } = useSolanaWallet()

  const solanaCluster = getDefaultGraiSolanaCluster()
  const solana = useMemo(() => resolveGraiSolanaConfig(solanaCluster), [solanaCluster])
  const connection = useMemo(() => (solana ? createGraiConnection(solana) : null), [solana])

  const evm = useMemo(() => {
    if (selectedChainType !== 'evm') return null
    const chainId =
      evmChain === 'ethereum'
        ? 1
        : evmChain === 'arbitrum'
          ? 42161
          : evmChain === 'sepolia'
            ? 11155111
            : 8453
    return resolveGraiEvmConfig(chainId)
  }, [evmChain, selectedChainType])

  const chainKind = useMemo((): GraiDeploymentContextValue['chainKind'] => {
    if (selectedChainType === 'solana' && solana) return 'solana'
    if (selectedChainType === 'evm' && evm) return 'evm'
    if (solana) return 'solana'
    return null
  }, [evm, selectedChainType, solana])

  const clusterMismatch =
    selectedChainType === 'solana' && isConnected && walletCluster !== null && walletCluster !== solanaCluster

  useEffect(() => {
    clearGraiStateCache()
  }, [solana?.programId.toBase58(), solanaCluster])

  const value = useMemo<GraiDeploymentContextValue>(
    () => ({
      chainKind,
      solanaCluster,
      solana,
      evm,
      connection,
      isConfigured: chainKind === 'solana' ? solana !== null : chainKind === 'evm' ? evm !== null : false,
      clusterMismatch,
      solscanTokenUrl: (mint: string) => solscanTokenUrl(solanaCluster, mint),
      solscanTxUrl: (signature: string) => solscanTxUrl(solanaCluster, signature),
      solscanAccountUrl: (address: string) => solscanAccountUrl(solanaCluster, address),
    }),
    [chainKind, clusterMismatch, connection, evm, solana, solanaCluster],
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
