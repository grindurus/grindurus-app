import { createContext, useContext } from 'react'
import type { NetworkEnv } from './networkEnv'

export type ChainType = 'evm' | 'solana' | null
export type EvmChain = 'ethereum' | 'base' | 'arbitrum' | 'polygon' | 'sepolia'
export type SolanaCluster = 'mainnet-beta' | 'testnet' | 'devnet'

export interface WalletContextType {
  selectedChainType: ChainType
  setSelectedChainType: (type: ChainType) => void
  evmChain: EvmChain
  setEvmChain: (chain: EvmChain) => void
  solanaCluster: SolanaCluster
  setSolanaCluster: (cluster: SolanaCluster) => void
  /**
   * Header Mainnet / Testnet preference — sole source of truth for the toggle,
   * banners, and chain filters. Never inferred from wallet chainId.
   */
  networkEnv: NetworkEnv
  setNetworkEnv: (env: NetworkEnv) => void
  isChainSelectorOpen: boolean
  openChainSelector: () => void
  closeChainSelector: () => void
  disconnect: () => void
  requestRainbowKit: () => void
  /** Prefetch / warm EVM wallet stack (safe to call on hover / EVM tab). */
  warmEvmStack: () => void
  /** Prefetch / warm Solana wallet stack (safe to call on Solana tab). */
  warmSolanaStack: () => void
  isEvmStackReady: boolean
  isSolanaStackReady: boolean
  pendingWalletConnectOpen: boolean
  clearPendingWalletConnectOpen: () => void
}

export const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function useWalletContext() {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWalletContext must be used within AppWalletProvider')
  }
  return context
}
