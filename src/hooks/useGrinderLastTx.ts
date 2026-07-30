import { useMemo } from 'react'
import { resolveGrinderTxExplorerUrl } from '../grinder/fetchLastWalletTx'

export type GrinderLastTxEntry =
  | { status: 'idle' }
  | { status: 'ready'; hash: string; explorerUrl: string }
  | { status: 'hashOnly'; hash: string }
  | { status: 'empty' }

type GrinderLastTxRow = {
  id: string
  lastTxHash?: string
  terminal?: string
  network?: string
}

export function useGrinderLastTx(rows: GrinderLastTxRow[], enabled: boolean): Record<string, GrinderLastTxEntry> {
  return useMemo(() => {
    if (!enabled || rows.length === 0) return {}

    const next: Record<string, GrinderLastTxEntry> = {}
    for (const row of rows) {
      const rawHash = row.lastTxHash?.trim()
      const hash = rawHash && rawHash.toLowerCase() !== '0x' ? rawHash : undefined
      if (!hash) {
        next[row.id] = { status: 'empty' }
        continue
      }

      const explorerUrl = resolveGrinderTxExplorerUrl({
        hash,
        terminal: row.terminal,
        network: row.network,
      })

      next[row.id] = explorerUrl
        ? { status: 'ready', hash, explorerUrl }
        : { status: 'hashOnly', hash }
    }
    return next
  }, [enabled, rows])
}
