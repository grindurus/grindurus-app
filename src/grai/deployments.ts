import { clusterApiUrl, Connection, PublicKey } from '@solana/web3.js'
import type { SolanaCluster } from '../providers/AppWalletProvider'

export type GraiChainKind = 'solana' | 'evm'

export type GraiSolanaConfig = {
  kind: 'solana'
  cluster: SolanaCluster
  programId: PublicKey
  graiMint: PublicKey
  rpcUrl: string
}

export type GraiEvmConfig = {
  kind: 'evm'
  chainId: number
  chainName: string
  graiToken: `0x${string}` | null
  protocolAddress: `0x${string}` | null
}

const DEVNET_DEFAULTS = {
  programId: 'APwEPN6PYrRgEqL2G2CnmhQNouikdKiNdPJ48YX5Y8a8',
  graiMint: '5UjazXW1NqBD1HnW9WfEdjHZUJsjk4prvuabq8GfEn5Q',
} as const

const EVM_CHAINS = [
  { chainId: 1, chainName: 'Ethereum', envSuffix: 'ETHEREUM' },
  { chainId: 8453, chainName: 'Base', envSuffix: 'BASE' },
  { chainId: 42161, chainName: 'Arbitrum', envSuffix: 'ARBITRUM' },
  { chainId: 11155111, chainName: 'Sepolia', envSuffix: 'SEPOLIA' },
  { chainId: 84532, chainName: 'Base Sepolia', envSuffix: 'BASE_SEPOLIA' },
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

/** Target Solana cluster for GRAI protocol (build-time default). */
export function getDefaultGraiSolanaCluster(): SolanaCluster {
  const raw = readEnv('VITE_GRAI_SOLANA_CLUSTER')
  if (raw === 'mainnet-beta' || raw === 'mainnet') return 'mainnet-beta'
  if (raw === 'testnet') return 'testnet'
  if (raw === 'devnet') return 'devnet'
  return 'devnet'
}

function resolveSolanaRpcUrlInternal(cluster: SolanaCluster): string {
  const suffix = clusterEnvSuffix(cluster)
  const graiSpecific = readEnv(`VITE_GRAI_${suffix}_RPC_URL`)
  if (graiSpecific) return graiSpecific

  const solanaSpecific = readEnv(`VITE_SOLANA_${suffix}_RPC_URL`)
  if (solanaSpecific) return solanaSpecific

  const isDefaultCluster = cluster === getDefaultGraiSolanaCluster()
  if (isDefaultCluster) {
    const legacyGrai = readEnv('VITE_GRAI_RPC_URL')
    if (legacyGrai) return legacyGrai
  }

  const solanaRpc = readEnv('VITE_SOLANA_RPC_URL')
  if (solanaRpc && detectClusterFromRpc(solanaRpc) === cluster) return solanaRpc

  return clusterApiUrl(cluster)
}

export function resolveSolanaRpcUrl(cluster: SolanaCluster): string {
  return resolveSolanaRpcUrlInternal(cluster)
}

function resolveSolanaAddresses(cluster: SolanaCluster): { programId?: string; graiMint?: string } {
  const specificProgramId = readEnv(`VITE_GRAI_${clusterEnvSuffix(cluster)}_PROGRAM_ID`)
  const specificMint = readEnv(`VITE_GRAI_${clusterEnvSuffix(cluster)}_MINT`)

  const isDefaultCluster = cluster === getDefaultGraiSolanaCluster()
  const legacyProgramId = isDefaultCluster ? readEnv('VITE_GRAI_PROGRAM_ID') : undefined
  const legacyMint = isDefaultCluster ? readEnv('VITE_GRAI_MINT') : undefined

  if (cluster === 'devnet') {
    return {
      programId: specificProgramId ?? legacyProgramId ?? DEVNET_DEFAULTS.programId,
      graiMint: specificMint ?? legacyMint ?? DEVNET_DEFAULTS.graiMint,
    }
  }

  return {
    programId: specificProgramId ?? legacyProgramId,
    graiMint: specificMint ?? legacyMint,
  }
}

export function resolveGraiSolanaConfig(cluster: SolanaCluster): GraiSolanaConfig | null {
  const { programId, graiMint } = resolveSolanaAddresses(cluster)
  if (!programId || !graiMint) return null

  try {
    return {
      kind: 'solana',
      cluster,
      programId: new PublicKey(programId),
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
  return new Connection(config.rpcUrl, 'confirmed')
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

  const graiToken = readEnv(`VITE_GRAI_${chain.envSuffix}_TOKEN`) as `0x${string}` | undefined
  const protocolAddress = readEnv(`VITE_GRAI_${chain.envSuffix}_PROTOCOL`) as `0x${string}` | undefined

  if (!graiToken && !protocolAddress) return null

  return {
    kind: 'evm',
    chainId,
    chainName: chain.chainName,
    graiToken: graiToken ?? null,
    protocolAddress: protocolAddress ?? null,
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
