import { useCallback, useEffect, useState } from 'react'
import { fetchGraiVaultBalances, type GraiAssetVaultBalances } from '../grai/fetchVaultBalances'

export function useGraiVaultBalances() {
  const [vaultBalances, setVaultBalances] = useState<Record<string, GraiAssetVaultBalances>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const balances = await fetchGraiVaultBalances()
      setVaultBalances(balances)
    } catch (err) {
      setVaultBalances({})
      setError(err instanceof Error ? err.message : 'Failed to load vault balances')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { vaultBalances, isLoading, error, refresh }
}
