import { Connection, PublicKey } from '@solana/web3.js'
import {
  createGraiConnection,
  evmExplorerAccountUrl,
  evmExplorerTokenUrl,
  evmExplorerTxUrl,
  getDefaultGraiSolanaCluster,
  resolveSolanaRpcUrl,
  solscanAccountUrl,
  solscanTokenUrl,
  solscanTxUrl,
} from '../grai/deployments'
import type { SolanaCluster } from '../providers/AppWalletProvider'
import { oftStoreFromMint } from './solana/pdas'

export type GrsChainKind = 'solana' | 'evm'

export type GrsEvmConfig = {
  kind: 'evm'
  chainId: number
  chainName: string
  address: `0x${string}`
}

export type GrsSolanaConfig = {
  kind: 'solana'
  cluster: SolanaCluster
  programId: PublicKey
  mint: PublicKey
  escrow: PublicKey
  oftStore: PublicKey
  rpcUrl: string
}

export type GrsConfig = GrsEvmConfig | GrsSolanaConfig

const EVM_CHAINS = [
  { chainId: 1, chainName: 'Ethereum', envSuffix: 'ETHEREUM' },
  { chainId: 8453, chainName: 'Base', envSuffix: 'BASE' },
  { chainId: 42161, chainName: 'Arbitrum', envSuffix: 'ARBITRUM' },
  { chainId: 11155111, chainName: 'Sepolia', envSuffix: 'SEPOLIA' },
  { chainId: 84532, chainName: 'Base Sepolia', envSuffix: 'BASE_SEPOLIA' },
] as const

/**
 * Devnet spoke defaults — `grindurus-solana/migrations/grs/v1_deploy.md`
 * (paired with Sepolia home `grindurus-evm/script/grs/v2_deploy.md`).
 * Escrow / oft_store derived as `["OftEscrow", mint]` → `["OFT", escrow]`;
 * env `VITE_GRS_*_ESCROW` / `OFT_STORE` still override when set.
 */
const DEVNET_DEFAULTS = {
  programId: 'BGWdAUzjxAZtFzxRTSy88k6r9iYotkhga449vB2tRNTy',
  mint: '6zyHpFEjGZeD7oGoe1VLBydQ3tM1FbKaUrkXXeVmgrs',
} as const

/** Sepolia home OFT — `grindurus-evm/script/grs/v2_deploy.md` */
const SEPOLIA_DEFAULT_TOKEN = '0x2cd392CC10887a258019143a710a5Ce2C5B5d88d' as const

function readEnv(key: string): string | undefined {
  const value = (import.meta.env as Record<string, string | undefined>)[key]
  return value?.trim() || undefined
}

function isAddress(value: string | undefined): value is `0x${string}` {
  return Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value))
}

function tryPubkey(value: string | undefined): PublicKey | null {
  if (!value) return null
  try {
    return new PublicKey(value)
  } catch {
    return null
  }
}

function clusterEnvSuffix(cluster: SolanaCluster): string {
  if (cluster === 'mainnet-beta') return 'MAINNET'
  if (cluster === 'testnet') return 'TESTNET'
  return 'DEVNET'
}

export function resolveGrsEvmConfig(chainId: number): GrsEvmConfig | null {
  const chain = EVM_CHAINS.find((item) => item.chainId === chainId)
  if (!chain) return null

  const address =
    readEnv(`VITE_GRS_${chain.envSuffix}_TOKEN`) ??
    (chain.chainId === 11155111 ? SEPOLIA_DEFAULT_TOKEN : undefined)
  if (!isAddress(address)) return null

  return {
    kind: 'evm',
    chainId: chain.chainId,
    chainName: chain.chainName,
    address,
  }
}

export function listConfiguredGrsChains(): GrsEvmConfig[] {
  return EVM_CHAINS.map((chain) => resolveGrsEvmConfig(chain.chainId)).filter(
    (config): config is GrsEvmConfig => config !== null,
  )
}

export function getDefaultGrsSolanaCluster(): SolanaCluster {
  const raw = readEnv('VITE_GRS_SOLANA_CLUSTER') ?? readEnv('VITE_GRAI_SOLANA_CLUSTER')
  if (raw === 'mainnet-beta' || raw === 'mainnet') return 'mainnet-beta'
  if (raw === 'testnet') return 'testnet'
  if (raw === 'devnet') return 'devnet'
  return getDefaultGraiSolanaCluster()
}

export function resolveGrsSolanaConfig(cluster: SolanaCluster = getDefaultGrsSolanaCluster()): GrsSolanaConfig | null {
  const suffix = clusterEnvSuffix(cluster)
  const mint =
    tryPubkey(readEnv(`VITE_GRS_${suffix}_MINT`)) ??
    tryPubkey(readEnv('VITE_GRS_SOLANA_MINT')) ??
    (cluster === 'devnet' ? tryPubkey(DEVNET_DEFAULTS.mint) : null)
  if (!mint) return null

  const programId =
    tryPubkey(readEnv(`VITE_GRS_${suffix}_PROGRAM_ID`)) ??
    tryPubkey(readEnv('VITE_GRS_PROGRAM_ID')) ??
    tryPubkey(DEVNET_DEFAULTS.programId)
  if (!programId) return null

  const derived = oftStoreFromMint(mint, programId)
  const escrow =
    tryPubkey(readEnv(`VITE_GRS_${suffix}_ESCROW`)) ??
    tryPubkey(readEnv('VITE_GRS_ESCROW')) ??
    derived.escrow
  const oftStore =
    tryPubkey(readEnv(`VITE_GRS_${suffix}_OFT_STORE`)) ??
    tryPubkey(readEnv('VITE_GRS_OFT_STORE')) ??
    derived.oftStore

  return {
    kind: 'solana',
    cluster,
    programId,
    mint,
    escrow,
    oftStore,
    rpcUrl: resolveSolanaRpcUrl(cluster),
  }
}

export function createGrsSolanaConnection(config: GrsSolanaConfig): Connection {
  return createGraiConnection({
    kind: 'solana',
    cluster: config.cluster,
    graiMint: config.mint,
    rpcUrl: config.rpcUrl,
  })
}

export function isGrsConfiguredAnywhere(): boolean {
  return listConfiguredGrsChains().length > 0 || resolveGrsSolanaConfig() !== null
}

export function resolveGrsHomeChain(
  snapshot: { home: boolean; homeChain: GrsEvmConfig | null } | null,
  config: GrsEvmConfig | null,
  configuredChains: GrsEvmConfig[] = listConfiguredGrsChains(),
): GrsEvmConfig | null {
  if (snapshot?.home && config) return config
  if (snapshot?.homeChain) return snapshot.homeChain
  return (
    configuredChains.find((item) => item.chainId === 11155111) ??
    configuredChains.find((item) => item.chainId === 1) ??
    configuredChains[0] ??
    null
  )
}

export function grsExplorerTokenUrl(config: GrsConfig): string | null {
  if (config.kind === 'solana') return solscanTokenUrl(config.cluster, config.mint.toBase58())
  return evmExplorerTokenUrl(config.chainId, config.address)
}

export function grsExplorerTxUrl(
  config: GrsConfig | { kind: 'evm'; chainId: number } | number,
  hash: string,
): string | null {
  if (typeof config === 'number') return evmExplorerTxUrl(config, hash)
  if (config.kind === 'solana') return solscanTxUrl(config.cluster, hash)
  return evmExplorerTxUrl(config.chainId, hash)
}

/** LayerZero message tracker for OFT / OApp sends (source tx hash). */
export function layerZeroScanTxUrl(hash: string, testnet: boolean): string {
  const host = testnet ? 'https://testnet.layerzeroscan.com' : 'https://layerzeroscan.com'
  const id = hash.startsWith('0x') || hash.startsWith('0X') ? hash : `0x${hash}`
  return `${host}/tx/${id}`
}

export function grsExplorerAccountUrl(config: GrsConfig, address: string): string | null {
  if (config.kind === 'solana') return solscanAccountUrl(config.cluster, address)
  return evmExplorerAccountUrl(config.chainId, address)
}

export { evmExplorerTokenUrl, evmExplorerTxUrl, evmExplorerAccountUrl }
