import { useCallback, useEffect, useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import type { GrinderConfig } from '../grai/grinders'
import {
  fetchCustodyWalletBalances,
  type CustodyAssetBalances,
} from '../grai/fetchCustodyWalletBalances'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'

export type GrinderCustodyState = {
  id: string
  name: string
  custodyWallet: PublicKey | null
  balances: Record<string, CustodyAssetBalances>
}

function parseCustodyWallet(value: string | undefined): PublicKey | null {
  if (!value?.trim()) return null
  try {
    return new PublicKey(value.trim())
  } catch {
    return null
  }
}

export function useGrindersCustodyBalances(grinders: GrinderConfig[]) {
  const { connection, solana, isConfigured } = useGraiDeployment()
  const [rows, setRows] = useState<GrinderCustodyState[]>(() =>
    grinders.map((grinder) => ({
      id: grinder.id,
      name: grinder.name,
      custodyWallet: parseCustodyWallet(grinder.custodyWallet),
      balances: {},
    })),
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!connection || !solana || !isConfigured) {
      setRows(
        grinders.map((grinder) => ({
          id: grinder.id,
          name: grinder.name,
          custodyWallet: parseCustodyWallet(grinder.custodyWallet),
          balances: {},
        })),
      )
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const nextRows = await Promise.all(
        grinders.map(async (grinder) => {
          const custodyWallet = parseCustodyWallet(grinder.custodyWallet)
          if (!custodyWallet) {
            return {
              id: grinder.id,
              name: grinder.name,
              custodyWallet: null,
              balances: {},
            }
          }

          const balances = await fetchCustodyWalletBalances(connection, solana, custodyWallet)
          return {
            id: grinder.id,
            name: grinder.name,
            custodyWallet,
            balances,
          }
        }),
      )
      setRows(nextRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load grinder custody balances')
    } finally {
      setIsLoading(false)
    }
  }, [connection, grinders, isConfigured, solana])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    rows,
    isLoading,
    error,
    refresh,
  }
}
