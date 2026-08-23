import type { Connection } from '@solana/web3.js'
import { Connection as SolanaConnection } from '@solana/web3.js'
import {
  createGrsSolanaConnection,
  getDefaultGrsSolanaCluster,
  listConfiguredGrsChains,
  resolveGrsEvmConfig,
  resolveGrsHomeChain,
  resolveGrsSolanaConfig,
  type GrsConfig,
  type GrsEvmConfig,
  type GrsSolanaConfig,
} from './deployments'
import { fetchGrsSnapshot, type GrsSale } from './evm/readProtocol'
import { fetchSolanaGrsSnapshot, GRS_SOLANA_DECIMALS } from './solana/readProtocol'
import type { SolanaCluster } from '../providers/AppWalletProvider'

export type GrsSaleBookRow = GrsSale & {
  /** Stable key across chains (ids collide: Solana #5 vs Sepolia #5). */
  key: string
  networkLabel: string
  decimals: number
  config: GrsConfig
}

export type GrsSaleBookMode = 'solana' | 'evm'

function solanaNetworkLabel(config: GrsSolanaConfig): string {
  return config.cluster === 'mainnet-beta' ? 'Solana' : `Solana ${config.cluster}`
}

/** Prefer GRS Devnet spoke — sales are published there regardless of Phantom mainnet RPC. */
export function resolveGrsSolanaConfigPreferringDevnet(
  preferred?: SolanaCluster | null,
): GrsSolanaConfig | null {
  const order: SolanaCluster[] = ['devnet']
  if (preferred && preferred !== 'devnet') order.push(preferred)
  const fallback = getDefaultGrsSolanaCluster()
  if (!order.includes(fallback)) order.push(fallback)
  for (const cluster of order) {
    const config = resolveGrsSolanaConfig(cluster)
    if (config) return config
  }
  return null
}

async function fetchSolanaSaleBookOnce(
  config: GrsSolanaConfig,
  connection: Connection,
): Promise<GrsSaleBookRow[]> {
  const snap = await fetchSolanaGrsSnapshot(connection, config, null)
  const label = solanaNetworkLabel(config)
  return snap.sales.map((sale) => ({
    ...sale,
    key: `solana:${config.cluster}:${sale.id.toString()}`,
    networkLabel: label,
    decimals: snap.decimals ?? GRS_SOLANA_DECIMALS,
    config,
  }))
}

export async function fetchSolanaSaleBook(
  config: GrsSolanaConfig,
  connection?: Connection | null,
): Promise<GrsSaleBookRow[]> {
  const primary = connection ?? createGrsSolanaConnection(config)
  try {
    return await fetchSolanaSaleBookOnce(config, primary)
  } catch (firstError) {
    const fallbacks: Connection[] = []
    if (connection) fallbacks.push(createGrsSolanaConnection(config))
    if (config.cluster === 'devnet') {
      fallbacks.push(new SolanaConnection('https://api.devnet.solana.com', 'confirmed'))
    }
    let lastError: unknown = firstError
    for (const next of fallbacks) {
      try {
        return await fetchSolanaSaleBookOnce(config, next)
      } catch (error) {
        lastError = error
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Failed to load Solana GRS sales')
  }
}

export async function fetchEvmSaleBook(config: GrsEvmConfig): Promise<GrsSaleBookRow[]> {
  const snap = await fetchGrsSnapshot(config)
  return snap.sales.map((sale) => ({
    ...sale,
    key: `evm:${config.chainId}:${sale.id.toString()}`,
    networkLabel: config.chainName,
    decimals: snap.decimals,
    config,
  }))
}

function resolveEvmBookConfig(pageConfig: GrsConfig | null): GrsEvmConfig | null {
  if (pageConfig?.kind === 'evm') return pageConfig
  return (
    resolveGrsHomeChain(null, null, listConfiguredGrsChains()) ??
    listConfiguredGrsChains()[0] ??
    null
  )
}

/**
 * Token-sale catalog for one wallet surface:
 * - `solana` → spoke OFT sales only
 * - `evm` → sales on the selected EVM CA only (not mixed with Solana)
 */
export async function fetchAllOpenGrsSaleBooks(params: {
  pageConfig: GrsConfig | null
  solanaCluster?: SolanaCluster | null
  mode: GrsSaleBookMode
  solanaConnection?: Connection | null
}): Promise<{
  rows: GrsSaleBookRow[]
  tokenSalesRemaining: bigint | null
  tokenSalesSpent: bigint | null
  tokenSalesCap: bigint | null
  tokenSalesDecimals: number | null
  solanaError: string | null
}> {
  let rows: GrsSaleBookRow[] = []
  let solanaError: string | null = null

  if (params.mode === 'solana') {
    const solana = resolveGrsSolanaConfigPreferringDevnet(params.solanaCluster)
    if (!solana) {
      solanaError = 'Solana GRS is not configured (set VITE_GRS_DEVNET_MINT)'
    } else {
      try {
        rows = await fetchSolanaSaleBook(solana, params.solanaConnection)
      } catch (error) {
        solanaError = error instanceof Error ? error.message : 'Failed to load Solana sales'
        rows = []
      }
    }
  } else {
    const evm = resolveEvmBookConfig(params.pageConfig)
    if (evm) {
      rows = await fetchEvmSaleBook(evm).catch(() => [])
    }
  }

  let tokenSalesRemaining: bigint | null = null
  let tokenSalesSpent: bigint | null = null
  let tokenSalesCap: bigint | null = null
  let tokenSalesDecimals: number | null = null
  // Inventory meter always from EVM home TokenSales bucket when available.
  const home =
    resolveGrsHomeChain(null, null, listConfiguredGrsChains()) ??
    resolveGrsEvmConfig(11155111) ??
    resolveEvmBookConfig(params.pageConfig)
  if (home) {
    try {
      const snap = await fetchGrsSnapshot(home)
      tokenSalesRemaining = snap.tokenSalesRemaining
      tokenSalesSpent = snap.tokenSalesSpent
      tokenSalesCap = snap.tokenSalesCap
      tokenSalesDecimals = snap.tokenSalesDecimals ?? snap.decimals
    } catch {
      /* ignore */
    }
  }

  return {
    rows,
    tokenSalesRemaining,
    tokenSalesSpent,
    tokenSalesCap,
    tokenSalesDecimals,
    solanaError,
  }
}
