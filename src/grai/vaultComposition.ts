import type { GraiAsset } from './knownMints'
import type { GraiAssetVaultBalances } from './fetchVaultBalances'
import { formatVaultBalanceDisplay } from './formatVaultBalance'
import type { DocumentChartTheme } from '../chart/grindurusChartTheme'

const ASSET_CHART_COLORS: Record<DocumentChartTheme, readonly string[]> = {
  dark: ['#ff69b4', '#7dffb2', '#7dd3fc', '#ffb347', '#c084fc', '#f472b6', '#34d399'],
  light: ['#e91e8c', '#059669', '#0369a1', '#ea580c', '#9333ea', '#db2777', '#0d9488'],
}

export function getAssetChartColors(theme: DocumentChartTheme) {
  return ASSET_CHART_COLORS[theme]
}

export function navSharePct(assetNavUsdRaw: bigint, totalNavUsdRaw: bigint): number {
  if (totalNavUsdRaw <= 0n || assetNavUsdRaw <= 0n) return 0
  return Number((assetNavUsdRaw * 10000n) / totalNavUsdRaw) / 100
}

export function buildVaultCompositionRows(
  mintAssets: GraiAsset[],
  vaultBalances: Record<string, GraiAssetVaultBalances>,
  valueKey: 'seniorUsdRaw' | 'juniorUsdRaw' | 'allocatedUsdRaw',
  chartColors: readonly string[],
) {
  if (mintAssets.length === 0) return []

  const rows = mintAssets.map((asset, index) => {
    const vault = vaultBalances[asset.mint]
    return {
      asset,
      color: chartColors[index % chartColors.length],
      senior: vault ? formatVaultBalanceDisplay(vault.seniorRaw, vault.decimals) : '—',
      junior: vault ? formatVaultBalanceDisplay(vault.juniorRaw, vault.decimals) : '—',
      allocated: vault ? formatVaultBalanceDisplay(vault.allocatedRaw, vault.decimals) : '—',
      seniorUsdRaw: vault?.seniorUsdRaw ?? 0n,
      juniorUsdRaw: vault?.juniorUsdRaw ?? 0n,
      allocatedUsdRaw: vault?.allocatedUsdRaw ?? 0n,
      valueUsdRaw: vault?.[valueKey] ?? 0n,
    }
  })
  const totalUsdRaw = rows.reduce((sum, row) => sum + row.valueUsdRaw, 0n)

  return rows.map((row) => ({
    ...row,
    pct: navSharePct(row.valueUsdRaw, totalUsdRaw),
    navUsdRaw: row.valueUsdRaw,
  }))
}
