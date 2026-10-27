export type GraiAssetYieldMetrics = {
  volatilityPct: number
  projectedAnnualYieldPct: number
}

const METRICS_BY_SYMBOL: Record<string, GraiAssetYieldMetrics> = {
  SOL: { volatilityPct: 78.4, projectedAnnualYieldPct: 53 },
  ETH: { volatilityPct: 65.2, projectedAnnualYieldPct: 50 },
  WETH: { volatilityPct: 65.2, projectedAnnualYieldPct: 50 },
  BTC: { volatilityPct: 48.1, projectedAnnualYieldPct: 42 },
  WBTC: { volatilityPct: 48.1, projectedAnnualYieldPct: 42 },
  ARB: { volatilityPct: 91.8, projectedAnnualYieldPct: 65 },
  USDC: { volatilityPct: 0.2, projectedAnnualYieldPct: 51 },
  USDT: { volatilityPct: 0.2, projectedAnnualYieldPct: 51 },
  DAI: { volatilityPct: 0.2, projectedAnnualYieldPct: 51 },
  MATIC: { volatilityPct: 72.5, projectedAnnualYieldPct: 48 },
  POL: { volatilityPct: 72.5, projectedAnnualYieldPct: 48 },
}

/** Wrapped / rebranded tickers → canonical metrics key. */
const SYMBOL_ALIASES: Record<string, string> = {
  WETH: 'ETH',
  WBTC: 'BTC',
  POL: 'MATIC',
}

/** Used when the selected asset has no row yet — still show APR with wallet disconnected. */
const DEFAULT_ASSET_YIELD_METRICS: GraiAssetYieldMetrics = {
  volatilityPct: 55,
  projectedAnnualYieldPct: 48,
}

export function lookupGraiAssetYieldMetrics(symbol?: string): GraiAssetYieldMetrics | null {
  if (!symbol) return DEFAULT_ASSET_YIELD_METRICS
  const normalized = symbol.toUpperCase()
  const aliased = SYMBOL_ALIASES[normalized] ?? normalized
  return (
    METRICS_BY_SYMBOL[normalized] ??
    METRICS_BY_SYMBOL[aliased] ??
    DEFAULT_ASSET_YIELD_METRICS
  )
}

export function formatVolatilityPct(value: number): string {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`
}

export function formatProjectedYieldPct(value: number): string {
  return `+${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`
}
