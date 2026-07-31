import { Connection, PublicKey } from '@solana/web3.js'
import {
  createGraiConnection,
  getDefaultGraiSolanaCluster,
  resolveGraiSolanaConfig,
  solscanTxUrl,
} from '../grai/deployments'

export type WalletAddressKind = 'solana' | 'evm' | 'unsupported'

export type LastWalletTxResult = {
  hash: string
  explorerUrl: string
}

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

const BLOCKSCOUT_BASE: Partial<Record<number, string>> = {
  1: 'https://eth.blockscout.com',
  42161: 'https://arbitrum.blockscout.com',
  8453: 'https://base.blockscout.com',
  11155111: 'https://eth-sepolia.blockscout.com',
  84532: 'https://base-sepolia.blockscout.com',
}

const ETHERSCAN_API_BASE: Partial<Record<number, string>> = {
  1: 'https://api.etherscan.io/api',
  42161: 'https://api.arbiscan.io/api',
  8453: 'https://api.basescan.org/api',
  11155111: 'https://api-sepolia.etherscan.io/api',
  84532: 'https://api-sepolia.basescan.org/api',
}

const EVM_TX_EXPLORER_BASE: Partial<Record<number, string>> = {
  1: 'https://etherscan.io/tx',
  42161: 'https://arbiscan.io/tx',
  8453: 'https://basescan.org/tx',
  11155111: 'https://sepolia.etherscan.io/tx',
  84532: 'https://sepolia.basescan.org/tx',
}

function readEnv(key: string): string | undefined {
  const value = (import.meta.env as Record<string, string | undefined>)[key]
  return value?.trim() || undefined
}

function readEnvNumber(key: string): number | undefined {
  const raw = readEnv(key)
  if (!raw) return undefined
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function detectWalletAddressKind(address: string): WalletAddressKind {
  const value = address.trim()
  if (!value) return 'unsupported'
  if (EVM_ADDRESS_RE.test(value)) return 'evm'
  try {
    const key = new PublicKey(value)
    if (PublicKey.isOnCurve(key.toBytes())) return 'solana'
  } catch {
    // not a Solana public key
  }
  return 'unsupported'
}

export function resolveEvmChainIdForTerminal(terminal?: string): number {
  const normalized = terminal?.trim().toLowerCase() ?? ''
  if (normalized === 'cow' || normalized === 'evm_cow_protocol') {
    return readEnvNumber('VITE_GRINDER_COW_CHAIN_ID') ?? 42161
  }
  if (normalized === 'lifi') {
    return readEnvNumber('VITE_GRINDER_LIFI_CHAIN_ID') ?? 1
  }
  return readEnvNumber('VITE_GRINDER_EVM_CHAIN_ID') ?? 42161
}

function evmTxExplorerUrl(chainId: number, hash: string): string | null {
  const base = EVM_TX_EXPLORER_BASE[chainId]
  return base ? `${base}/${hash}` : null
}

function readEvmExplorerApiKey(chainId: number): string | undefined {
  const byChain: Partial<Record<number, string>> = {
    1: 'VITE_ETHERSCAN_API_KEY',
    42161: 'VITE_ARBISCAN_API_KEY',
    8453: 'VITE_BASESCAN_API_KEY',
    11155111: 'VITE_ETHERSCAN_API_KEY',
    84532: 'VITE_BASESCAN_API_KEY',
  }
  const specific = byChain[chainId]
  if (specific) {
    const value = readEnv(specific)
    if (value) return value
  }
  return readEnv('VITE_ETHERSCAN_API_KEY')
}

async function fetchLastEvmTxViaBlockscout(chainId: number, address: string): Promise<string | null> {
  const base = BLOCKSCOUT_BASE[chainId]
  if (!base) return null

  const url = `${base}/api/v2/addresses/${address}/transactions?filter=from`
  const res = await fetch(url)
  if (!res.ok) return null

  const data = (await res.json()) as { items?: Array<{ hash?: string }> }
  const hash = data.items?.[0]?.hash
  return typeof hash === 'string' && hash.length > 0 ? hash : null
}

async function fetchLastEvmTxViaEtherscan(chainId: number, address: string): Promise<string | null> {
  const apiBase = ETHERSCAN_API_BASE[chainId]
  if (!apiBase) return null

  const url = new URL(apiBase)
  url.searchParams.set('module', 'account')
  url.searchParams.set('action', 'txlist')
  url.searchParams.set('address', address)
  url.searchParams.set('page', '1')
  url.searchParams.set('offset', '25')
  url.searchParams.set('sort', 'desc')

  const apiKey = readEvmExplorerApiKey(chainId)
  if (apiKey) url.searchParams.set('apikey', apiKey)

  const res = await fetch(url)
  if (!res.ok) return null

  const data = (await res.json()) as {
    status?: string
    result?: Array<{ hash?: string; from?: string }> | string
  }
  if (data.status !== '1' || !Array.isArray(data.result)) return null

  const normalizedAddress = address.toLowerCase()
  const outgoing = data.result.find((tx) => tx.from?.toLowerCase() === normalizedAddress)
  const hash = outgoing?.hash ?? data.result[0]?.hash
  return typeof hash === 'string' && hash.length > 0 ? hash : null
}

export async function fetchLastSolanaTxSignature(address: string): Promise<string | null> {
  const cluster = getDefaultGraiSolanaCluster()
  const config = resolveGraiSolanaConfig(cluster)
  if (!config) return null

  const connection = createGraiConnection(config)
  const pubkey = new PublicKey(address)
  const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 1 })
  const signature = signatures[0]?.signature
  return signature ?? null
}

export async function fetchLastEvmTxHash(address: string, chainId: number): Promise<string | null> {
  const blockscoutHash = await fetchLastEvmTxViaBlockscout(chainId, address)
  if (blockscoutHash) return blockscoutHash
  return fetchLastEvmTxViaEtherscan(chainId, address)
}

const COW_EXPLORER_CHAIN_SLUG: Partial<Record<number, string>> = {
  1: 'eth',
  42161: 'arb1',
  100: 'gno',
}

function readCaip2EvmChainId(network?: string): number | undefined {
  const value = network?.trim()
  if (!value?.startsWith('eip155:')) return undefined
  const parsed = Number.parseInt(value.slice('eip155:'.length), 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function readCaip2SolanaCluster(network?: string): 'mainnet-beta' | 'devnet' | undefined {
  const value = network?.trim()
  if (!value?.startsWith('solana:')) return undefined
  const reference = value.slice('solana:'.length).toLowerCase()
  if (reference === 'mainnet' || reference === 'mainnet-beta') return 'mainnet-beta'
  if (reference === 'devnet') return 'devnet'
  return undefined
}

function isCowTerminal(terminal?: string): boolean {
  const normalized = terminal?.trim().toLowerCase() ?? ''
  return (
    normalized === 'cow' ||
    normalized === 'evm_cow_protocol' ||
    normalized === 'eip155:cow' ||
    normalized.includes(':cow') ||
    normalized.includes('cow')
  )
}

export function resolveGrinderChainId(params: { terminal?: string; network?: string }): number {
  return readCaip2EvmChainId(params.network) ?? resolveEvmChainIdForTerminal(params.terminal)
}

export function resolveGrinderTxExplorerUrl(params: {
  hash: string
  terminal?: string
  network?: string
}): string | null {
  const hash = params.hash.trim()
  if (!hash) return null

  const solanaCluster = readCaip2SolanaCluster(params.network)
  if (solanaCluster) {
    return solscanTxUrl(solanaCluster, hash)
  }

  const normalizedTerminal = params.terminal?.trim().toLowerCase() ?? ''
  if (normalizedTerminal === 'solana' || normalizedTerminal === 'jupiter') {
    const cluster = solanaCluster ?? getDefaultGraiSolanaCluster()
    return solscanTxUrl(cluster, hash)
  }

  const chainId = resolveGrinderChainId(params)
  if (isCowTerminal(params.terminal)) {
    const slug = COW_EXPLORER_CHAIN_SLUG[chainId]
    if (slug) return `https://explorer.cow.fi/${slug}/orders/${hash}`
  }

  return evmTxExplorerUrl(chainId, hash)
}

export async function fetchLastWalletTx(params: {
  address: string
  terminal?: string
  connection?: Connection | null
}): Promise<LastWalletTxResult | null> {
  const address = params.address.trim()
  const kind = detectWalletAddressKind(address)
  if (kind === 'unsupported') return null

  if (kind === 'solana') {
    const signature = await fetchLastSolanaTxSignature(address)
    if (!signature) return null
    const cluster = getDefaultGraiSolanaCluster()
    return {
      hash: signature,
      explorerUrl: solscanTxUrl(cluster, signature),
    }
  }

  const chainId = resolveEvmChainIdForTerminal(params.terminal)
  const hash = await fetchLastEvmTxHash(address, chainId)
  if (!hash) return null

  const explorerUrl = evmTxExplorerUrl(chainId, hash)
  if (!explorerUrl) return null

  return { hash, explorerUrl }
}
