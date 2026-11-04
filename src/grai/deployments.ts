import { clusterApiUrl, Connection, PublicKey } from '@solana/web3.js'
import { GRAI_EVM, GRAI_SOLANA } from '../contracts'
import type { SolanaCluster } from '../wallets/AppWalletProvider'
import { fetchGraiProtocol } from './fetchGraiProtocol'
import { getSharedJsonRpcBatchFetch } from './jsonRpcBatchFetch'

export type GraiSolanaConfig = {
  kind: 'solana'
  cluster: SolanaCluster
  graiMint: PublicKey
  rpcUrl: string
}

/** On-chain resolved GRAI deployment (program id discovered from mint). */
export type GraiSolanaRuntime = GraiSolanaConfig & {
  programId: PublicKey
  graiState: PublicKey
}

export type GraiEvmConfig = {
  kind: 'evm'
  chainId: number
  chainName: string
  graiToken: `0x${string}` | null
  protocolAddress: `0x${string}` | null
}

const EVM_CHAINS = [
  { chainId: 1, chainName: 'Ethereum' },
  { chainId: 8453, chainName: 'Base' },
  { chainId: 42161, chainName: 'Arbitrum' },
  { chainId: 11155111, chainName: 'Sepolia' },
  { chainId: 84532, chainName: 'Base Sepolia' },
] as const

function readEnv(key: string): string | undefined {
  const value = (import.meta.env as Record<string, string | undefined>)[key]
  return value?.trim() || undefined
}

function clusterEnvSuffix(cluster: SolanaCluster): string {
  if (cluster === 'mainnet-beta') return 'MAINNET'
  if (cluster === 'testnet') return 'TESTNET'
  return 'DEVNET'
}

function detectClusterFromRpc(rpc: string): SolanaCluster | null {
  const endpoint = rpc.toLowerCase()
  if (endpoint.includes('devnet')) return 'devnet'
  if (endpoint.includes('testnet')) return 'testnet'
  if (endpoint.includes('mainnet')) return 'mainnet-beta'
  return null
}

/**
 * Fallback Solana cluster when UI prefs are not available yet.
 * Runtime selection is the header Mainnet/Testnet toggle (`preferredSolanaCluster`).
 */
export function getDefaultGraiSolanaCluster(): SolanaCluster {
  return 'mainnet-beta'
}

function devnetRpcProxyUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/solana-devnet-rpc`
  }
  return 'http://localhost:3001/solana-devnet-rpc'
}

function resolveSolanaRpcUrlInternal(cluster: SolanaCluster): string {
  const suffix = clusterEnvSuffix(cluster)
  const specific = readEnv(`VITE_SOLANA_${suffix}_RPC_URL`)
  if (specific) {
    const detected = detectClusterFromRpc(specific)
    if (!detected || detected === cluster) return specific
  }

  const solanaRpc = readEnv('VITE_SOLANA_RPC_URL')
  if (solanaRpc && detectClusterFromRpc(solanaRpc) === cluster) return solanaRpc

  // Local dev: proxy to official devnet RPC (api.devnet.solana.com TLS cert is expired).
  // Path must contain "devnet" so Wallet Standard getChainForEndpoint → solana:devnet.
  if (import.meta.env.DEV && cluster === 'devnet') {
    return devnetRpcProxyUrl()
  }

  return clusterApiUrl(cluster)
}

export function resolveSolanaRpcUrl(cluster: SolanaCluster): string {
  const url = resolveSolanaRpcUrlInternal(cluster)
  if (cluster === 'devnet' && !/\bdevnet\b/i.test(url)) {
    return import.meta.env.DEV ? devnetRpcProxyUrl() : clusterApiUrl('devnet')
  }
  if (cluster === 'mainnet-beta' && /\bdevnet\b/i.test(url)) {
    return clusterApiUrl('mainnet-beta')
  }
  return url
}

function resolveGraiMintAddress(cluster: SolanaCluster): string | undefined {
  const deployment = GRAI_SOLANA[cluster]
  return deployment?.mint?.trim() || undefined
}

export function resolveGraiSolanaConfig(cluster: SolanaCluster): GraiSolanaConfig | null {
  const graiMint = resolveGraiMintAddress(cluster)
  if (!graiMint) return null

  try {
    return {
      kind: 'solana',
      cluster,
      graiMint: new PublicKey(graiMint),
      rpcUrl: resolveSolanaRpcUrlInternal(cluster),
    }
  } catch {
    return null
  }
}

export function getGraiSolanaConfigOrThrow(cluster = getDefaultGraiSolanaCluster()): GraiSolanaConfig {
  const config = resolveGraiSolanaConfig(cluster)
  if (!config) {
    throw new Error(`GRAI is not configured for Solana ${cluster}`)
  }
  return config
}

export function createGraiConnection(config: GraiSolanaConfig): Connection {
  return new Connection(config.rpcUrl, {
    commitment: 'confirmed',
    fetch: getSharedJsonRpcBatchFetch(),
  })
}

export async function resolveGraiSolanaRuntime(
  connection: Connection,
  config: GraiSolanaConfig,
): Promise<GraiSolanaRuntime> {
  const protocol = await fetchGraiProtocol(connection, config.graiMint)
  return {
    ...config,
    programId: protocol.programId,
    graiState: protocol.graiState,
  }
}

export function graiStatePda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('protocol')], programId)[0]
}

export function solscanClusterParam(cluster: SolanaCluster): string | null {
  if (cluster === 'devnet') return 'devnet'
  if (cluster === 'testnet') return 'testnet'
  return null
}

export function solscanTokenUrl(cluster: SolanaCluster, mint: string): string {
  const param = solscanClusterParam(cluster)
  const base = `https://solscan.io/token/${mint}`
  return param ? `${base}?cluster=${param}` : base
}

export function solscanTxUrl(cluster: SolanaCluster, signature: string): string {
  const param = solscanClusterParam(cluster)
  const base = `https://solscan.io/tx/${signature}`
  return param ? `${base}?cluster=${param}` : base
}

export function solscanAccountUrl(cluster: SolanaCluster, address: string): string {
  const param = solscanClusterParam(cluster)
  const base = `https://solscan.io/account/${address}`
  return param ? `${base}?cluster=${param}` : base
}

export function resolveGraiEvmConfig(chainId: number): GraiEvmConfig | null {
  const chain = EVM_CHAINS.find((item) => item.chainId === chainId)
  if (!chain) return null

  // Unified proxy = token + protocol (`src/contracts.ts`).
  const unified = GRAI_EVM[chainId]
  if (!unified) return null

  return {
    kind: 'evm',
    chainId,
    chainName: chain.chainName,
    graiToken: unified,
    protocolAddress: unified,
  }
}

export function listConfiguredEvmChains(): GraiEvmConfig[] {
  return EVM_CHAINS.map((chain) => resolveGraiEvmConfig(chain.chainId)).filter(
    (config): config is GraiEvmConfig => config !== null,
  )
}

export function evmExplorerTokenUrl(chainId: number, token: string): string | null {
  if (chainId === 1) return `https://etherscan.io/token/${token}`
  if (chainId === 8453) return `https://basescan.org/token/${token}`
  if (chainId === 42161) return `https://arbiscan.io/token/${token}`
  if (chainId === 11155111) return `https://sepolia.etherscan.io/token/${token}`
  if (chainId === 84532) return `https://sepolia.basescan.org/token/${token}`
  return null
}

export function evmExplorerTxUrl(chainId: number, hash: string): string | null {
  if (chainId === 1) return `https://etherscan.io/tx/${hash}`
  if (chainId === 8453) return `https://basescan.org/tx/${hash}`
  if (chainId === 42161) return `https://arbiscan.io/tx/${hash}`
  if (chainId === 11155111) return `https://sepolia.etherscan.io/tx/${hash}`
  if (chainId === 84532) return `https://sepolia.basescan.org/tx/${hash}`
  return null
}

export function evmExplorerAccountUrl(chainId: number, address: string): string | null {
  if (chainId === 1) return `https://etherscan.io/address/${address}`
  if (chainId === 8453) return `https://basescan.org/address/${address}`
  if (chainId === 42161) return `https://arbiscan.io/address/${address}`
  if (chainId === 11155111) return `https://sepolia.etherscan.io/address/${address}`
  if (chainId === 84532) return `https://sepolia.basescan.org/address/${address}`
  return null
}
