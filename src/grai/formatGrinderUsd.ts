export function formatGrinderUsdCompactPart(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)
}

export function formatGrinderUsdTotal(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '$0'

  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)

  if (abs >= 1_000_000_000) {
    return `${sign}$${formatGrinderUsdCompactPart(abs / 1_000_000_000)}B`
  }
  if (abs >= 1_000_000) {
    return `${sign}$${formatGrinderUsdCompactPart(abs / 1_000_000)}M`
  }
  if (abs >= 1_000) {
    return `${sign}$${formatGrinderUsdCompactPart(abs / 1_000)}K`
  }

  return `${sign}$${abs.toLocaleString('en-US')}`
}

export function formatGrinderUsdExact(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '$0.00'

  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)

  return `${sign}$${abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatGrinderTooltipAmount(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  const maximumFractionDigits = abs >= 1_000 ? 2 : abs >= 1 ? 4 : 6
  return value.toLocaleString('en-US', { maximumFractionDigits })
}

/** Last whitespace-separated ticker from a formatted amount (``"1.2 WETH"`` → ``WETH``). */
export function tickerFromGrinderAmount(formatted?: string): string | undefined {
  if (!formatted) return undefined
  const parts = formatted.trim().split(/\s+/)
  if (parts.length < 2) return undefined
  const ticker = parts[parts.length - 1]!
  return /^[A-Za-z][A-Za-z0-9.-]*$/.test(ticker) ? ticker : undefined
}

/** Format a token amount for grinders table (optional signed ``+/-`` prefix). */
export function formatGrinderTokenAmount(
  value: number,
  symbol?: string,
  options?: { signed?: boolean },
): string {
  const signed = Boolean(options?.signed)
  if (!Number.isFinite(value)) return '—'
  const asset = symbol?.trim() || ''
  if (signed && value === 0) return asset ? `0 ${asset}` : '0'
  const abs = Math.abs(value)
  const digits = abs >= 1000 ? 0 : abs >= 1 ? 2 : 4
  let num = (signed ? abs : value).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })
  if (signed) num = `${value > 0 ? '+' : '−'}${num}`
  return asset ? `${num} ${asset}` : num
}

export type GrinderTvlBreakdownRow = {
  id: string
  name: string
  balanceQuote: number
  balanceBase: number
  spotPrice: number
  totalValueLocked: number
}

export type GrinderYieldBreakdownRow = {
  id: string
  name: string
  yieldQuote: number
  yieldBase: number
  spotPrice: number
  yieldUsd: number
}
