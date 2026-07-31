import { useCallback, useEffect, useMemo, useState } from 'react'
import { bossLogsStream } from '../boss/bossLogsStream'
import { buildGrinderTableFromBossLogs, type GrinderTableRow, type GrinderTableSummary } from '../boss/grinderTable'
import type { BossGrinderAssetMeta } from '../boss/bossGrindersBootstrap'
import type { BossGrinderLogsSnapshot } from '../boss/types'
import { deferAfterPaint } from '../utils/deferAfterPaint'

type UseBossGrinderTableResult = {
  rows: GrinderTableRow[]
  summary: GrinderTableSummary
  isConnected: boolean
  isBootstrapped: boolean
  isBossReachable: boolean | null
  isLive: boolean
  isBossUnavailable: boolean
  isRefreshing: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useBossGrinderTable(bossUrls: string[], metadataReady: boolean): UseBossGrinderTableResult {
  const [snapshot, setSnapshot] = useState<BossGrinderLogsSnapshot>({})
  const [assetMeta, setAssetMeta] = useState<Record<string, BossGrinderAssetMeta>>({})
  const [isConnected, setIsConnected] = useState(false)
  const [isBootstrapped, setIsBootstrapped] = useState(false)
  const [isBossReachable, setIsBossReachable] = useState<boolean | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!metadataReady) return

    bossLogsStream.setBossUrls(bossUrls)

    let unsubscribe: (() => void) | undefined
    const cancelDefer = deferAfterPaint(() => {
      unsubscribe = bossLogsStream.subscribe({
        onBootstrap: (reachable) => {
          setIsBootstrapped(true)
          setIsBossReachable(reachable)
        },
        onOpen: () => {
          setIsConnected(true)
          setError(null)
        },
        onMessage: (next, nextAssetMeta) => {
          setSnapshot(next)
          setAssetMeta(nextAssetMeta)
          setError(null)
        },
        onError: (message) => {
          if (message) {
            setIsConnected(false)
            setError(message)
          }
        },
      })
    })

    return () => {
      cancelDefer()
      unsubscribe?.()
    }
  }, [bossUrls, metadataReady])

  const { rows, summary } = useMemo(() => buildGrinderTableFromBossLogs(snapshot, assetMeta), [snapshot, assetMeta])

  const isLive = isBootstrapped && Object.keys(snapshot).length > 0
  const isBossUnavailable = metadataReady && isBootstrapped && !isLive && isBossReachable === false

  const refresh = useCallback(async () => {
    if (!metadataReady || isRefreshing) return
    setIsRefreshing(true)
    try {
      await bossLogsStream.refresh()
    } finally {
      setIsRefreshing(false)
    }
  }, [metadataReady, isRefreshing])

  return {
    rows,
    summary,
    isConnected,
    isBootstrapped: metadataReady ? isBootstrapped : false,
    isBossReachable,
    isLive,
    isBossUnavailable,
    isRefreshing,
    error,
    refresh,
  }
}
