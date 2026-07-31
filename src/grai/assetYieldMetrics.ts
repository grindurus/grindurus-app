export type GraiAssetYieldMetrics = {
  volatilityPct: number
  projectedAnnualYieldPct: number
}

const METRICS_BY_SYMBOL: Record<string, GraiAssetYieldMetrics> = {
  SOL: { volatilityPct: 78.4, projectedAnnualYieldPct: 53 },
  ETH: { volatilityPct: 65.2, projectedAnnualYieldPct: 50 },
  BTC: { volatilityPct: 48.1, projectedAnnualYieldPct: 42 },
  ARB: { volatilityPct: 91.8, projectedAnnualYieldPct: 65 },
  USDC: { volatilityPct: 0.2, projectedAnnualYieldPct: 51 },
  USDT: { volatilityPct: 0.2, projectedAnnualYieldPct: 51 },
  MATIC: { volatilityPct: 72.5, projectedAnnualYieldPct: 48 },
}

export function lookupGraiAssetYieldMetrics(symbol?: string): GraiAssetYieldMetrics | null {
  if (!symbol) return null
  return METRICS_BY_SYMBOL[symbol.toUpperCase()] ?? null
}

export function formatVolatilityPct(value: number): string {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`
}

export function formatProjectedYieldPct(value: number): string {
  return `+${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`
}
