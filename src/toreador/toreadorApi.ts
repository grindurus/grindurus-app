import type { GrinderTableRow, GrinderTableSummary } from './grinderTable'
import { summarizeGrinderTableRows } from './grinderTable'

/** Dev: Vite proxy. Prod: public Toreador host (Traefik ``toreador.${DOMAIN}``). */
const DEFAULT_BASE_DEV = '/toreador-api'
const DEFAULT_BASE_PROD = 'https://toreador.grindurus.xyz'

export function toreadorApiBase(): string {
  const fromEnv = (import.meta.env.VITE_TOREADOR_API_URL || '').trim()
  const fallback = import.meta.env.DEV ? DEFAULT_BASE_DEV : DEFAULT_BASE_PROD
  return (fromEnv || fallback).replace(/\/+$/, '')
}

export type ToreadorGrindersTableResponse = {
  columns?: string[]
  rows?: GrinderTableRow[]
  summary?: GrinderTableSummary
  boss_count?: number
  bosses?: string[]
  grinder_count?: number
  toreador_count?: number
  toreadors?: string[]
  cache?: { hit?: boolean; ttl_sec?: number; age_sec?: number | null }
  detail?: unknown
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
    tvlUsd: isFiniteNumber(r.tvlUsd) ? r.tvlUsd : 0,
    yieldBase: typeof r.yieldBase === 'string' ? r.yieldBase : '—',
    yieldQuote: typeof r.yieldQuote === 'string' ? r.yieldQuote : '—',
    yieldQuoteValue: isFiniteNumber(r.yieldQuoteValue) ? r.yieldQuoteValue : 0,
    yieldBaseValue: isFiniteNumber(r.yieldBaseValue) ? r.yieldBaseValue : 0,
    yieldUsd: isFiniteNumber(r.yieldUsd) ? r.yieldUsd : 0,
    terminal: typeof r.terminal === 'string' ? r.terminal : undefined,
    network: typeof r.network === 'string' ? r.network : undefined,
    custodianAddress:
      typeof r.custodianAddress === 'string' ? r.custodianAddress : undefined,
    custodianId: isFiniteNumber(r.custodianId) ? r.custodianId : undefined,
    grindersAddress:
      typeof r.grindersAddress === 'string' ? r.grindersAddress : undefined,
    image: typeof r.image === 'string' ? r.image : undefined,
    nftName: typeof r.nftName === 'string' ? r.nftName : undefined,
  }
}

export async function fetchToreadorGrindersTable(options?: {
  refresh?: boolean
  toreador?: string
  signal?: AbortSignal
}): Promise<{ rows: GrinderTableRow[]; summary: GrinderTableSummary; raw: ToreadorGrindersTableResponse }> {
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
  const rows = (Array.isArray(body.rows) ? body.rows : [])
    .map(coerceRow)
    .filter((row): row is GrinderTableRow => row != null)
  const summary =
    body.summary &&
    isFiniteNumber(body.summary.activeCount) &&
    isFiniteNumber(body.summary.totalCount)
      ? body.summary
      : summarizeGrinderTableRows(rows)
  return { rows, summary, raw: body }
}
