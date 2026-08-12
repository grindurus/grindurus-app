import { createContext, useContext } from 'react'

export type ChainType = 'evm' | 'solana' | null
export type EvmChain = 'ethereum' | 'arbitrum' | 'sepolia'
export type SolanaCluster = 'mainnet-beta' | 'testnet' | 'devnet'

export interface WalletContextType {
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
  /** Prefetch / warm EVM wallet stack (safe to call on hover). */
  warmEvmStack: () => void
  isEvmStackReady: boolean
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
