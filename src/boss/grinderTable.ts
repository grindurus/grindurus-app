import type { BossGrinderAssetMeta } from './bossGrindersBootstrap'
import { resolveLogAssetSymbols } from './bossGrindersBootstrap'
import type { GrinderConfig } from '../grai/grinders'
import { formatRelativeTime } from '../utils/formatRelativeTime'
import { readNumber } from './readNumber'
import type { BossGrinderLogPayload, BossGrinderLogsSnapshot } from './types'
import { BOSS_LOGS_META_KEY } from './types'

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
}

export type GrinderTableSummary = {
  activeCount: number
  totalCount: number
  tvlUsd: number
  yieldUsd: number
}

function readEnvBossId(grinderId: string): string | undefined {
  const value = (import.meta.env as Record<string, string | undefined>)[`VITE_${grinderId.toUpperCase()}_BOSS_ID`]
  return value?.trim() || undefined
}

export function resolveBossGrinderId(config: GrinderConfig, index: number): string {
  const envId = readEnvBossId(config.id)
  if (envId) return envId

  const match = config.id.match(/^grinder(\d+)$/i)
  if (match) return match[1]!

  return String(index + 1)
}

function formatTokenAmount(value: number | undefined, asset: string | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  const maximumFractionDigits = abs >= 1000 ? 0 : abs >= 1 ? 2 : 4
  const formatted = value.toLocaleString('en-US', { maximumFractionDigits })
  return asset ? `${formatted} ${asset}` : formatted
}

function readLogNumber(log: Record<string, unknown>, key: string): number | undefined {
  if (!(key in log)) return undefined
  return readNumber(log[key])
}

function formatYieldAmount(value: number | undefined, asset: string | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value === 0) return asset ? `0 ${asset}` : '0'
  const sign = value > 0 ? '+' : '−'
  const abs = Math.abs(value)
  const maximumFractionDigits = abs >= 1000 ? 0 : abs >= 1 ? 2 : 4
  const formatted = abs.toLocaleString('en-US', { maximumFractionDigits })
  return asset ? `${sign}${formatted} ${asset}` : `${sign}${formatted}`
}

function isLogPayload(value: unknown): value is BossGrinderLogPayload {
  return typeof value === 'object' && value !== null && !('error' in value && Object.keys(value).length === 1)
}

function lastActionLabelFromLog(log: BossGrinderLogPayload): string {
  const status = (log.status ?? '').toUpperCase()
  if (status === 'GRINDING') return 'Grind'
  if (status === 'DISABLED' || status === 'HALTED') return 'Halted'

  const unallocQuote = readNumber(log.unalloc_quote) ?? 0
  const unallocBase = readNumber(log.unalloc_base) ?? 0
  if (unallocQuote > 0 || unallocBase > 0) return 'Allocate'
  return 'Distribute'
}

function isActiveLog(log: BossGrinderLogPayload): boolean {
  return isGrinderStatusLive(log.status) && !log.error
}

export function computeGrinderTvlUsd(
  balanceQuote: number | undefined,
  balanceBase: number | undefined,
  spotPrice: number | undefined,
): number {
  const quote = balanceQuote ?? 0
  const base = balanceBase ?? 0
  const spot = spotPrice ?? 0
  return quote + base * spot
}

export function computeGrinderYieldUsd(
  yieldQuoteValue: number | undefined,
  yieldBaseValue: number | undefined,
  spotPrice: number | undefined,
): number {
  const quote = yieldQuoteValue ?? 0
  const base = yieldBaseValue ?? 0
  const spot = spotPrice ?? 0
  return quote + base * spot
}

export function formatGrinderTerminalLabel(terminal: string | undefined): string {
  const value = terminal?.trim()
  if (!value) return '—'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function resolveGrinderNetworkLabel(rows: Array<{ terminal?: string }>): string {
  const terminals = new Set(
    rows.map((row) => row.terminal?.trim().toLowerCase()).filter((value): value is string => Boolean(value)),
  )
  if (terminals.size === 0) return '—'
  if (terminals.size === 1) return formatGrinderTerminalLabel([...terminals][0])
  return 'Mixed'
}

export function mapBossLogToGrinderRow(
  bossId: string,
  payload: BossGrinderLogPayload | { error?: string } | undefined,
  assetMeta?: BossGrinderAssetMeta,
): GrinderTableRow {
  const fallbackName = `Grinder ${bossId}`

  if (!payload || !isLogPayload(payload)) {
    return {
      id: bossId,
      name: fallbackName,
      isActive: false,
      lastActionLabel: '—',
      lastAction: '—',
      base: '—',
      quote: '—',
      balanceQuote: 0,
      balanceBase: 0,
      spotPrice: 0,
      tvlUsd: 0,
      yieldBase: '—',
      yieldQuote: '—',
      yieldQuoteValue: 0,
      yieldBaseValue: 0,
      yieldUsd: 0,
    }
  }

  const log = payload
  const logRecord = log as Record<string, unknown>
  const { baseAsset, quoteAsset } = resolveLogAssetSymbols(log, assetMeta)
  const balanceBase = readLogNumber(logRecord, 'balance_base')
  const balanceQuote = readLogNumber(logRecord, 'balance_quote')
  const spotPrice = readLogNumber(logRecord, 'spot_price')
  const pnlBase = readLogNumber(logRecord, 'pnl_base')
  const pnlQuote = readLogNumber(logRecord, 'pnl_quote')

  return {
    id: bossId,
    name: log.grinder_name?.trim() || fallbackName,
    grinderAddress: log.grinder_address?.trim() || undefined,
    status: log.status?.trim() || undefined,
    isActive: isActiveLog(log),
    lastActionLabel: lastActionLabelFromLog(log),
    lastAction: formatRelativeTime(log.time),
    lastTxHash: (() => {
      const hash = log.last_tx_hash?.trim()
      if (!hash || hash.toLowerCase() === '0x') return undefined
      return hash
    })(),
    base: formatTokenAmount(balanceBase, baseAsset),
    quote: formatTokenAmount(balanceQuote, quoteAsset),
    balanceQuote: balanceQuote ?? 0,
    balanceBase: balanceBase ?? 0,
    spotPrice: spotPrice ?? 0,
    tvlUsd: computeGrinderTvlUsd(balanceQuote, balanceBase, spotPrice),
    yieldBase: formatYieldAmount(pnlBase, baseAsset),
    yieldQuote: formatYieldAmount(pnlQuote, quoteAsset),
    yieldQuoteValue: pnlQuote ?? 0,
    yieldBaseValue: pnlBase ?? 0,
    yieldUsd: computeGrinderYieldUsd(pnlQuote, pnlBase, spotPrice),
    terminal: log.terminal?.trim() || undefined,
    network: log.network?.trim() || undefined,
  }
}

function sortBossGrinderIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => {
    const scopeA = a.includes(':') ? a.slice(0, a.lastIndexOf(':')) : ''
    const scopeB = b.includes(':') ? b.slice(0, b.lastIndexOf(':')) : ''
    if (scopeA !== scopeB) return scopeA.localeCompare(scopeB)

    const idA = a.includes(':') ? a.slice(a.lastIndexOf(':') + 1) : a
    const idB = b.includes(':') ? b.slice(b.lastIndexOf(':') + 1) : b
    const na = Number.parseInt(idA, 10)
    const nb = Number.parseInt(idB, 10)
    if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb
    return idA.localeCompare(idB)
  })
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

export function buildGrinderTableFromBossLogs(
  snapshot: BossGrinderLogsSnapshot,
  assetMeta: Record<string, BossGrinderAssetMeta> = {},
): { rows: GrinderTableRow[]; summary: GrinderTableSummary } {
  const rows = sortBossGrinderIds(Object.keys(snapshot).filter((id) => id !== BOSS_LOGS_META_KEY)).map((bossId) =>
    mapBossLogToGrinderRow(bossId, snapshot[bossId], assetMeta[bossId]),
  )

  return {
    rows,
    summary: summarizeGrinderTableRows(rows),
  }
}
