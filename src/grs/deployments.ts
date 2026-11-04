import { Connection, PublicKey } from '@solana/web3.js'
import { GRS_EVM, GRS_SOLANA } from '../contracts'
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
import type { SolanaCluster } from '../wallets/AppWalletProvider'
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
  { chainId: 1, chainName: 'Ethereum' },
  { chainId: 8453, chainName: 'Base' },
  { chainId: 42161, chainName: 'Arbitrum' },
  { chainId: 11155111, chainName: 'Sepolia' },
  { chainId: 84532, chainName: 'Base Sepolia' },
] as const

function tryPubkey(value: string | undefined): PublicKey | null {
  if (!value) return null
  try {
    return new PublicKey(value)
  } catch {
    return null
  }
}

export function resolveGrsEvmConfig(chainId: number): GrsEvmConfig | null {
  const chain = EVM_CHAINS.find((item) => item.chainId === chainId)
  if (!chain) return null

  const address = GRS_EVM[chainId]
  if (!address) return null

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

/** Fallback when UI prefs are missing — same as header Mainnet default. */
export function getDefaultGrsSolanaCluster(): SolanaCluster {
  return getDefaultGraiSolanaCluster()
}

export function resolveGrsSolanaConfig(cluster: SolanaCluster = getDefaultGrsSolanaCluster()): GrsSolanaConfig | null {
  const deployment = GRS_SOLANA[cluster]
  if (!deployment) return null

  const mint = tryPubkey(deployment.mint)
  const programId = tryPubkey(deployment.programId)
  if (!mint || !programId) return null

  const derived = oftStoreFromMint(mint, programId)
  const escrow = tryPubkey(deployment.escrow) ?? derived.escrow
  const oftStore = tryPubkey(deployment.oftStore) ?? derived.oftStore

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
  // Wallet Standard derives chain from rpcEndpoint — must contain "devnet" for Devnet.
  const rpcUrl =
    config.cluster === 'devnet' && !/\bdevnet\b/i.test(config.rpcUrl)
      ? resolveSolanaRpcUrl('devnet')
      : config.rpcUrl
  return createGraiConnection({
    kind: 'solana',
    cluster: config.cluster,
    graiMint: config.mint,
    rpcUrl,
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
