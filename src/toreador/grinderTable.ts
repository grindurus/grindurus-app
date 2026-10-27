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
  tvlUsd: number
  yieldBase: string
  yieldQuote: string
  yieldQuoteValue: number
  yieldBaseValue: number
  yieldUsd: number
  terminal?: string
  network?: string
  custodianAddress?: string
  custodianId?: number
  /** EVM Grinders ERC-721 contract (for OpenSea / explorer NFT links). */
  grindersAddress?: string
  image?: string
  nftName?: string
}

export type GrinderTableSummary = {
  activeCount: number
  totalCount: number
  tvlUsd: number
  yieldUsd: number
}

export function summarizeGrinderTableRows(rows: GrinderTableRow[]): GrinderTableSummary {
  const activeCount = rows.filter((row) => row.isActive).length
  const tvlUsd = rows.reduce((sum, row) => sum + row.tvlUsd, 0)
  const yieldUsd = rows.reduce((sum, row) => sum + row.yieldUsd, 0)

  return {
    activeCount,
    totalCount: rows.length,
    tvlUsd,
    yieldUsd,
  }
}
