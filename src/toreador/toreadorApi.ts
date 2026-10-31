import type {
  GrinderTableRow,
  GrinderTableSummary,
  GrinderToreadorGroup,
  GrinderToreadorSummary,
} from './grinderTable'
import { summarizeGrinderTableRows } from './grinderTable'
import { caip2NetworksMatch, normalizeCaip2Network } from '../wallets/caip2Network'

type ToreadorTableSummaryWire = {
  activeCount?: number
  totalCount?: number
  totalValueLocked?: number
  /** Legacy alias. */
  tvlUsd?: number
  totalIndexedYield?: number
  /** Legacy alias. */
  indexedYield?: number
  byToreador?: Record<string, ToreadorTableSummaryWire>
}

/** Dev: Vite proxy. Prod: public Toreador host (Traefik ``toreador.${DOMAIN}``). */
const DEFAULT_BASE_DEV = '/toreador-api'
const DEFAULT_BASE_PROD = 'https://toreador.grindurus.xyz'

export function toreadorApiBase(): string {
  const fromEnv = (import.meta.env.VITE_TOREADOR_API_URL || '').trim()
  const fallback = import.meta.env.DEV ? DEFAULT_BASE_DEV : DEFAULT_BASE_PROD
  return (fromEnv || fallback).replace(/\/+$/, '')
}

export type ToreadorTableGroupWire = ToreadorTableSummaryWire & {
  toreadorId?: string
  rows?: unknown[]
}

export type ToreadorGrindersTableResponse = {
  columns?: string[]
  /** Orphan rows (no matching toreador). Preferred rows live under ``toreadors[].rows``. */
  rows?: GrinderTableRow[]
  summary?: ToreadorTableSummaryWire
  boss_count?: number
  bosses?: string[]
  grinder_count?: number
  toreador_count?: number
  /** Per-toreador groups (``toreadorId`` + ``rows``). Legacy: string[] of CAIP-2 ids. */
  toreadors?: Array<ToreadorTableGroupWire | string>
  /** ISO UTC of soonest background yield distribute across returned toreadors. */
  nextDistributeYieldAt?: string | null
  cache?: { hit?: boolean; ttl_sec?: number; age_sec?: number | null }
  detail?: unknown
}

/** Parse ``toreadors[]`` groups; stamp ``toreador`` from ``toreadorId`` when missing. */
export function coerceToreadorGroups(
  body: ToreadorGrindersTableResponse,
): GrinderToreadorGroup[] {
  const out: GrinderToreadorGroup[] = []
  for (const entry of body.toreadors ?? []) {
    if (!entry || typeof entry === 'string') continue
    const toreadorId = typeof entry.toreadorId === 'string' ? entry.toreadorId.trim() : ''
    if (!toreadorId) continue
    const rows = (Array.isArray(entry.rows) ? entry.rows : [])
      .map((raw) => {
        const row = coerceRow(raw)
        if (!row) return null
        return row.toreador ? row : { ...row, toreador: toreadorId }
      })
      .filter((row): row is GrinderTableRow => row != null)
    const stats = coerceToreadorSummary(entry)
    out.push({
      toreadorId,
      rows,
      activeCount: stats?.activeCount ?? rows.filter((r) => r.isActive).length,
      totalCount: stats?.totalCount ?? rows.length,
      totalValueLocked:
        stats?.totalValueLocked ??
        rows.reduce((sum, r) => sum + r.totalValueLocked, 0),
      totalIndexedYield: stats?.totalIndexedYield,
    })
  }
  return out
}

/** Flatten ``toreadors[].rows`` + top-level orphan ``rows``. */
export function flattenToreadorTableRows(body: ToreadorGrindersTableResponse): unknown[] {
  const grouped: unknown[] = []
  for (const entry of body.toreadors ?? []) {
    if (!entry || typeof entry !== 'object' || typeof entry === 'string') continue
    const toreadorId =
      typeof (entry as ToreadorTableGroupWire).toreadorId === 'string'
        ? (entry as ToreadorTableGroupWire).toreadorId!.trim()
        : ''
    const rows = (entry as ToreadorTableGroupWire).rows
    if (!Array.isArray(rows)) continue
    for (const raw of rows) {
      if (raw && typeof raw === 'object' && toreadorId) {
        const row = raw as Record<string, unknown>
        if (typeof row.toreador !== 'string' || !row.toreador.trim()) {
          grouped.push({ ...row, toreador: toreadorId })
          continue
        }
      }
      grouped.push(raw)
    }
  }
  const orphans = Array.isArray(body.rows) ? body.rows : []
  return [...grouped, ...orphans]
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function coerceRow(raw: unknown): GrinderTableRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = typeof r.id === 'string' ? r.id : null
  if (!id) return null
  const name = typeof r.name === 'string' && r.name.trim() ? r.name : id
  return {
    id,
    name,
    grinderAddress: typeof r.grinderAddress === 'string' ? r.grinderAddress : undefined,
    status: typeof r.status === 'string' ? r.status : undefined,
    isActive: Boolean(r.isActive),
    lastActionLabel: typeof r.lastActionLabel === 'string' ? r.lastActionLabel : '—',
    lastAction: typeof r.lastAction === 'string' ? r.lastAction : '—',
    lastTxHash: typeof r.lastTxHash === 'string' ? r.lastTxHash : undefined,
    base: typeof r.base === 'string' ? r.base : '—',
    quote: typeof r.quote === 'string' ? r.quote : '—',
    balanceQuote: isFiniteNumber(r.balanceQuote) ? r.balanceQuote : 0,
    balanceBase: isFiniteNumber(r.balanceBase) ? r.balanceBase : 0,
    spotPrice: isFiniteNumber(r.spotPrice) ? r.spotPrice : 0,
    totalValueLocked: isFiniteNumber(r.totalValueLocked)
      ? r.totalValueLocked
      : isFiniteNumber(r.tvlUsd)
        ? r.tvlUsd
        : 0,
    yieldBase: isFiniteNumber(r.yieldBase)
      ? r.yieldBase
      : isFiniteNumber(r.yieldBaseValue)
        ? r.yieldBaseValue
        : 0,
    yieldQuote: isFiniteNumber(r.yieldQuote)
      ? r.yieldQuote
      : isFiniteNumber(r.yieldQuoteValue)
        ? r.yieldQuoteValue
        : 0,
    yieldUsd: isFiniteNumber(r.yieldUsd) ? r.yieldUsd : 0,
    terminal: typeof r.terminal === 'string' ? r.terminal : undefined,
    toreador: typeof r.toreador === 'string' ? r.toreador : undefined,
    custodianAddress:
      typeof r.custodianAddress === 'string' ? r.custodianAddress : undefined,
    custodianId: isFiniteNumber(r.custodianId) ? r.custodianId : undefined,
    grindersAddress:
      typeof r.grindersAddress === 'string' ? r.grindersAddress : undefined,
    image: typeof r.image === 'string' ? r.image : undefined,
    nftName: typeof r.nftName === 'string' ? r.nftName : undefined,
    baseSymbol:
      typeof r.baseSymbol === 'string' && r.baseSymbol.trim() && !r.baseSymbol.startsWith('0x')
        ? r.baseSymbol.trim()
        : undefined,
    quoteSymbol:
      typeof r.quoteSymbol === 'string' && r.quoteSymbol.trim() && !r.quoteSymbol.startsWith('0x')
        ? r.quoteSymbol.trim()
        : undefined,
  }
}

export async function fetchToreadorGrindersTable(options?: {
  refresh?: boolean
  toreador?: string
  signal?: AbortSignal
}): Promise<{
  rows: GrinderTableRow[]
  groups: GrinderToreadorGroup[]
  orphanRows: GrinderTableRow[]
  summary: GrinderTableSummary
  nextDistributeYieldAt: string | null
  raw: ToreadorGrindersTableResponse
}> {
  const params = new URLSearchParams()
  if (options?.refresh) params.set('refresh', '1')
  if (options?.toreador) params.set('toreador', options.toreador)
  const qs = params.toString()
  const url = `${toreadorApiBase()}/table${qs ? `?${qs}` : ''}`
  const res = await fetch(url, {
    signal: options?.signal,
  })
  const text = await res.text()
  let body: ToreadorGrindersTableResponse = {}
  if (text) {
    try {
      body = JSON.parse(text) as ToreadorGrindersTableResponse
    } catch {
      throw new Error(res.ok ? 'Invalid JSON from toreador /table' : text.slice(0, 200))
    }
  }
  if (!res.ok) {
    const detail =
      typeof body.detail === 'string'
        ? body.detail
        : body.detail != null
          ? JSON.stringify(body.detail)
          : text.slice(0, 200) || res.statusText
    throw new Error(`Toreador ${res.status}: ${detail}`)
  }
  const groups = coerceToreadorGroups(body)
  const orphanRows = (Array.isArray(body.rows) ? body.rows : [])
    .map(coerceRow)
    .filter((row): row is GrinderTableRow => row != null)
  const rows = [...groups.flatMap((g) => g.rows), ...orphanRows]
  const byToreadorFromGroups = Object.fromEntries(
    groups.map((g) => [
      g.toreadorId,
      {
        activeCount: g.activeCount,
        totalCount: g.totalCount,
        totalValueLocked: g.totalValueLocked,
        totalIndexedYield: g.totalIndexedYield,
      } satisfies GrinderToreadorSummary,
    ]),
  )
  const summary: GrinderTableSummary =
    body.summary &&
    isFiniteNumber(body.summary.activeCount) &&
    isFiniteNumber(body.summary.totalCount)
      ? {
          activeCount: body.summary.activeCount,
          totalCount: body.summary.totalCount,
          totalValueLocked: isFiniteNumber(body.summary.totalValueLocked)
            ? body.summary.totalValueLocked
            : isFiniteNumber(body.summary.tvlUsd)
              ? body.summary.tvlUsd
              : 0,
          totalIndexedYield: isFiniteNumber(body.summary.totalIndexedYield)
            ? body.summary.totalIndexedYield
            : isFiniteNumber(body.summary.indexedYield)
              ? body.summary.indexedYield
              : undefined,
          byToreador:
            coerceByToreador(body.summary.byToreador) ??
            (Object.keys(byToreadorFromGroups).length > 0 ? byToreadorFromGroups : undefined),
        }
      : summarizeGrinderTableRows(rows)
  const nextDistributeYieldAt =
    typeof body.nextDistributeYieldAt === 'string' && body.nextDistributeYieldAt.trim()
      ? body.nextDistributeYieldAt.trim()
      : null
  return { rows, groups, orphanRows, summary, nextDistributeYieldAt, raw: body }
}

function coerceToreadorSummary(raw: ToreadorTableSummaryWire): GrinderToreadorSummary | null {
  if (!isFiniteNumber(raw.activeCount) || !isFiniteNumber(raw.totalCount)) return null
  return {
    activeCount: raw.activeCount,
    totalCount: raw.totalCount,
    totalValueLocked: isFiniteNumber(raw.totalValueLocked)
      ? raw.totalValueLocked
      : isFiniteNumber(raw.tvlUsd)
        ? raw.tvlUsd
        : 0,
    totalIndexedYield: isFiniteNumber(raw.totalIndexedYield)
      ? raw.totalIndexedYield
      : isFiniteNumber(raw.indexedYield)
        ? raw.indexedYield
        : undefined,
  }
}

function coerceByToreador(
  raw: Record<string, ToreadorTableSummaryWire> | undefined,
): Record<string, GrinderToreadorSummary> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const out: Record<string, GrinderToreadorSummary> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue
    const entry = coerceToreadorSummary(value)
    if (!entry) continue
    out[key] = entry
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** Resolve ``summary.byToreador`` entry for a wallet CAIP-2 (handles solana alias variants). */
export function summaryForCaip2Network(
  summary: GrinderTableSummary,
  networkCaip2?: string | null,
): GrinderToreadorSummary | undefined {
  const by = summary.byToreador
  if (!by || !networkCaip2) return undefined
  const direct = by[networkCaip2]
  if (direct) return direct
  const normalized = normalizeCaip2Network(networkCaip2)
  for (const [key, entry] of Object.entries(by)) {
    if (caip2NetworksMatch(key, networkCaip2) || (normalized && caip2NetworksMatch(key, normalized))) {
      return entry
    }
  }
  return undefined
}
