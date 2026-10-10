/** Wallet / chain providers and hooks — Solana + EVM in one place. */

export {
  AppWalletProvider,
  useWalletContext,
  type ChainType,
  type EvmChain,
  type SolanaCluster,
  type WalletContextType,
} from './AppWalletProvider'
export { useSolanaWallet, type WalletSolanaCluster } from './useSolanaWallet'
export { useEvmWallet } from './useEvmWallet'
export { useActiveWallet, type ActiveWalletState } from './useActiveWallet'
export { useEvmWalletClient } from './EvmWalletClientContext'
export { wagmiConfig } from './evmConfig'
export { evmHttpTransport } from './evmTransports'
export type { EvmWalletSnapshot } from './evmWalletTypes'
export {
  networkEnvFromSolanaCluster,
  solanaClusterMatchesNetworkEnv,
  evmChainMatchesNetworkEnv,
  preferredEvmChainId,
  preferredSolanaCluster,
  type NetworkEnv,
} from './networkEnv'
export { evmChainIdToCaip2, solanaClusterToCaip2 } from './caip2Network'
export {
  sendWalletTransaction,
  clusterFromRpcEndpoint,
  type SolanaSendTransaction,
} from './sendWalletTransaction'
