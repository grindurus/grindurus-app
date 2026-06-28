import { formatTokenBalance } from './onchain'

export function formatVaultBalanceDisplay(
  raw: bigint,
  decimals: number,
  maxFractionDigits = decimals,
): string {
  if (raw <= 0n) return '0'

  const normalized = formatTokenBalance(raw, decimals, maxFractionDigits)
  const [wholePart, fractionPart] = normalized.split('.')
  const wholeFormatted = Number(wholePart).toLocaleString()
  return fractionPart ? `${wholeFormatted}.${fractionPart}` : wholeFormatted
}
