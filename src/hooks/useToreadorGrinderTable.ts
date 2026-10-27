import { useCallback, useEffect, useRef, useState } from 'react'
import type { GrinderTableRow, GrinderTableSummary } from '../toreador/grinderTable'
import { summarizeGrinderTableRows } from '../toreador/grinderTable'
import { fetchToreadorGrindersTable } from '../toreador/toreadorApi'
import { deferAfterPaint } from '../utils/deferAfterPaint'

const POLL_MS = 15_000

type UseToreadorGrinderTableResult = {
  rows: GrinderTableRow[]
  summary: GrinderTableSummary
  isConnected: boolean
  isBootstrapped: boolean
  isToreadorReachable: boolean | null
  isLive: boolean
  isToreadorUnavailable: boolean
  isRefreshing: boolean
  error: string | null
  refresh: () => Promise<void>
}

const EMPTY_SUMMARY: GrinderTableSummary = {
  activeCount: 0,
  totalCount: 0,
  tvlUsd: 0,
  yieldUsd: 0,
}

/** GRAI grinders table via Toreador ``GET /table``. */
export function useToreadorGrinderTable(): UseToreadorGrinderTableResult {
  const [rows, setRows] = useState<GrinderTableRow[]>([])
  const [summary, setSummary] = useState<GrinderTableSummary>(EMPTY_SUMMARY)
  const [isConnected, setIsConnected] = useState(false)
  const [isBootstrapped, setIsBootstrapped] = useState(false)
  const [isToreadorReachable, setIsToreadorReachable] = useState<boolean | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inflightRef = useRef(false)

  const load = useCallback(async (opts?: { refresh?: boolean; signal?: AbortSignal }) => {
    if (inflightRef.current) return
    inflightRef.current = true
    try {
      const { rows: nextRows, summary: nextSummary } = await fetchToreadorGrindersTable({
        refresh: opts?.refresh,
        signal: opts?.signal,
      })
      setRows(nextRows)
      setSummary(nextSummary ?? summarizeGrinderTableRows(nextRows))
      setIsConnected(true)
      setIsToreadorReachable(true)
      setError(null)
    } catch (err) {
      if (opts?.signal?.aborted) return
      setIsConnected(false)
      setIsToreadorReachable(false)
      setError(err instanceof Error ? err.message : 'Toreador grinders table failed')
    } finally {
      inflightRef.current = false
      setIsBootstrapped(true)
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    let pollTimer: ReturnType<typeof setInterval> | undefined

    const cancelDefer = deferAfterPaint(() => {
      // First paint bypasses Toreador TTL cache so custodian/NFT fields are fresh.
      void load({ refresh: true, signal: ac.signal })
      pollTimer = setInterval(() => {
        void load({ signal: ac.signal })
      }, POLL_MS)
    })

    return () => {
      cancelDefer()
      ac.abort()
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [load])

  const refresh = useCallback(async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      await load({ refresh: true })
    } finally {
      setIsRefreshing(false)
    }
  }, [isRefreshing, load])

  const isLive = isBootstrapped && rows.length > 0
  const isToreadorUnavailable = isBootstrapped && !isLive && isToreadorReachable === false

  return {
    rows,
    summary,
    isConnected,
    isBootstrapped,
    isToreadorReachable,
    isLive,
    isToreadorUnavailable,
    isRefreshing,
    error,
    refresh,
  }
}
