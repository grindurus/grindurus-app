export function isGrinderStatusLive(status?: string): boolean {
  const normalized = status?.trim().toUpperCase()
  return normalized === 'INITIALIZED' || normalized === 'GRINDING'
}

export type GrinderTableRow = {
  id: string
  name: string
  grinderAddress?: string
  status?: string
  isActive: boolean
  lastActionLabel: string
  lastAction: string
  lastTxHash?: string
  base: string
  quote: string
  balanceQuote: number
  balanceBase: number
  spotPrice: number
  totalValueLocked: number
  /** Raw base-asset PnL (frontend formats with ``baseSymbol``). */
  yieldBase: number
  /** Raw quote-asset PnL (frontend formats with ``quoteSymbol``). */
  yieldQuote: number
  /** Row PnL in USD (``yieldQuote + yieldBase × spot``). */
  yieldUsd: number
  terminal?: string
  /** CAIP-2 toreador id (``eip155:42161``) — used for network filter. */
  toreador?: string
  custodianAddress?: string
  custodianId?: number
  /** EVM Grinders ERC-721 contract (for OpenSea / explorer NFT links). */
  grindersAddress?: string
  image?: string
  nftName?: string
  baseSymbol?: string
  quoteSymbol?: string
}

export type GrinderToreadorSummary = {
  activeCount: number
  totalCount: number
  totalValueLocked: number
  totalIndexedYield?: number
}

export type GrinderToreadorGroup = GrinderToreadorSummary & {
  toreadorId: string
  rows: GrinderTableRow[]
}

export type GrinderTableSummary = {
  activeCount: number
  totalCount: number
  totalValueLocked: number
  /** On-chain Grinders ``getIndexedYield().value`` when present (sum across returned toreadors). */
  totalIndexedYield?: number
  /** Per-toreador slice of the same summary fields (keyed by CAIP-2). */
  byToreador?: Record<string, GrinderToreadorSummary>
}

export function summarizeGrinderTableRows(rows: GrinderTableRow[]): GrinderTableSummary {
  const activeCount = rows.filter((row) => row.isActive).length
  const totalValueLocked = rows.reduce((sum, row) => sum + row.totalValueLocked, 0)

  return {
    activeCount,
    totalCount: rows.length,
    totalValueLocked,
  }
}

/** Fallback Indexed Yield from row PnL when on-chain ``totalIndexedYield`` is absent. */
export function sumGrinderRowYieldUsd(rows: GrinderTableRow[]): number {
  return rows.reduce((sum, row) => sum + row.yieldUsd, 0)
}
