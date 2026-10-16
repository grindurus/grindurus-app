import { useLocation } from 'react-router-dom'
import type { SolanaCluster } from '../wallets/AppWalletProvider'
import {
  getDefaultGraiSolanaCluster,
  resolveGraiEvmConfig,
  resolveGraiSolanaConfig,
} from './deployments'

/** GRAI product routes that need a live protocol deployment for txs. */
export function shouldGateGraiNetworks(pathname: string): boolean {
  return pathname.startsWith('/grai') || pathname.startsWith('/affiliate')
}

export function isGraiEvmChainConfigured(chainId: number): boolean {
  return resolveGraiEvmConfig(chainId) !== null
}

export function isGraiSolanaClusterConfigured(cluster: SolanaCluster): boolean {
  return resolveGraiSolanaConfig(cluster) !== null
}

/**
 * Prefer the env default (usually Devnet); fall back to any cluster with a GRAI mint.
 * Used to pin the header Solana selector on GRAI / Affiliates.
 */
export function preferredGraiSolanaCluster(): SolanaCluster {
  const preferred = getDefaultGraiSolanaCluster()
  const normalized = preferred === 'testnet' ? 'devnet' : preferred
  if (isGraiSolanaClusterConfigured(normalized)) return normalized
  if (isGraiSolanaClusterConfigured('devnet')) return 'devnet'
  if (isGraiSolanaClusterConfigured('mainnet-beta')) return 'mainnet-beta'
  return 'devnet'
}

/** When true, hide/disable networks without a GRAI deployment (Backtest etc. stay open). */
export function useGraiNetworkGating(): boolean {
  const { pathname } = useLocation()
  return shouldGateGraiNetworks(pathname)
}

export const GRAI_NETWORK_UNAVAILABLE_HINT = 'GRAI is not deployed on this network'
