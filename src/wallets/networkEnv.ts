import type { EvmChain, SolanaCluster } from './walletContext'

/** App-wide environment from the header Mainnet / Testnet toggle. */
export type NetworkEnv = 'mainnet' | 'testnet'

export function networkEnvFromSolanaCluster(cluster: SolanaCluster): NetworkEnv {
  return cluster === 'mainnet-beta' ? 'mainnet' : 'testnet'
}

export function networkEnvFromEvmChain(evmChain: EvmChain): NetworkEnv {
  return evmChain === 'sepolia' ? 'testnet' : 'mainnet'
}

/** @deprecated Prefer reading `networkEnv` from WalletContext. */
export function resolveNetworkEnv(input: {
  selectedChainType?: unknown
  evmChain: EvmChain
  solanaCluster: SolanaCluster
  evmChainId?: number | null
  isEvmConnected?: boolean
}): NetworkEnv {
  // Legacy fallback for callers not yet migrated — never trust wallet chainId over prefs.
  void input.selectedChainType
  void input.evmChainId
  void input.isEvmConnected
  return networkEnvFromEvmChain(input.evmChain)
}

/** EVM L1/L2 testnets we surface in Connect Wallet / CA pickers. */
export function isTestnetEvmChainId(chainId: number): boolean {
  return (
    chainId === 11155111 || // Ethereum Sepolia
    chainId === 84532 || // Base Sepolia
    chainId === 421614 || // Arbitrum Sepolia
    chainId === 80002 // Polygon Amoy
  )
}

/** Map a wallet chain id to the app `evmChain` preference (null if unknown). */
export function evmChainFromChainId(chainId: number): EvmChain | null {
  if (chainId === 1) return 'ethereum'
  if (chainId === 8453) return 'base'
  if (chainId === 42161) return 'arbitrum'
  if (chainId === 137) return 'polygon'
  if (chainId === 11155111) return 'sepolia'
  return null
}

/** Mainnet chain to request when connecting an EVM wallet (never Sepolia). */
export function preferredMainnetEvmChain(evmChain: EvmChain): EvmChain {
  return evmChain === 'sepolia' ? 'arbitrum' : evmChain
}

export function isTestnetSolanaCluster(cluster: SolanaCluster): boolean {
  return cluster !== 'mainnet-beta'
}

export function evmChainMatchesNetworkEnv(chainId: number, env: NetworkEnv): boolean {
  return isTestnetEvmChainId(chainId) === (env === 'testnet')
}

export function solanaClusterMatchesNetworkEnv(cluster: SolanaCluster, env: NetworkEnv): boolean {
  return isTestnetSolanaCluster(cluster) === (env === 'testnet')
}

/** Chain id to request when connecting / switching from the header network env. */
export function preferredEvmChainId(evmChain: EvmChain, env: NetworkEnv): number {
  if (env === 'testnet') return 11155111 // Sepolia
  if (evmChain === 'base') return 8453
  if (evmChain === 'arbitrum') return 42161
  if (evmChain === 'polygon') return 137
  return 1 // Ethereum
}

export function preferredSolanaCluster(env: NetworkEnv): 'mainnet-beta' | 'devnet' {
  return env === 'mainnet' ? 'mainnet-beta' : 'devnet'
}

/** Active EVM pref slot for a network env (GRAI mainnet = Arbitrum). */
export function defaultEvmChainForEnv(env: NetworkEnv): EvmChain {
  return env === 'testnet' ? 'sepolia' : 'arbitrum'
}
