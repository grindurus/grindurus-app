import { formatVaultBalanceDisplay } from '../grai/formatVaultBalance'
import type { GraiAssetVaultBalances } from '../grai/fetchVaultBalances'
import { USD_SCALE } from '../grai/tokenomics'

export function formatVaultUsdLabel(usdRaw: bigint): string {
  if (usdRaw <= 0n) return '$0'
  return `$${formatVaultBalanceDisplay(usdRaw, USD_SCALE, 2)}`
}

export function vaultBalanceUsdRaw(
  amountRaw: bigint,
  vault: GraiAssetVaultBalances | undefined,
): bigint {
  if (!vault || amountRaw <= 0n) return 0n
  if (vault.juniorRaw > 0n && vault.juniorUsdRaw > 0n) {
    return (vault.juniorUsdRaw * amountRaw) / vault.juniorRaw
  }
  if (vault.seniorRaw > 0n && vault.seniorUsdRaw > 0n) {
    return (vault.seniorUsdRaw * amountRaw) / vault.seniorRaw
  }
  if (vault.allocatedRaw > 0n && vault.allocatedUsdRaw > 0n) {
    return (vault.allocatedUsdRaw * amountRaw) / vault.allocatedRaw
  }
  return 0n
}

export function VaultBalanceTableValue({
  amount,
  usdRaw,
  isLoading,
}: {
  amount: string
  usdRaw: bigint
  isLoading: boolean
}) {
  if (isLoading) return <>…</>

  const usdLabel = formatVaultUsdLabel(usdRaw)

  return (
    <span className="grai-balance-table-value-stack">
      <span className="grai-balance-table-value-amount">{amount}</span>
      {amount !== '—' ? (
        <span className="grai-balance-table-value-usd">{usdLabel}</span>
      ) : null}
    </span>
  )
}
