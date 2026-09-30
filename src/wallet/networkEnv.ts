import type { EvmChain, SolanaCluster } from '../providers/walletContext'

/** App-wide environment from the header Mainnet / Testnet toggle. */
export type NetworkEnv = 'mainnet' | 'testnet'

export function networkEnvFromSolanaCluster(cluster: SolanaCluster): NetworkEnv {
  return cluster === 'mainnet-beta' ? 'mainnet' : 'testnet'
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
