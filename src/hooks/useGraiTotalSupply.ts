import { useCallback, useEffect, useState } from 'react'
import { fetchGraiMintSupply } from '../grai/fetchGraiMintSupply'

export function useGraiTotalSupply() {
  const [totalSupplyLabel, setTotalSupplyLabel] = useState('…')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const supply = await fetchGraiMintSupply()
      setTotalSupplyLabel(supply.label)
    } catch (err) {
      setTotalSupplyLabel('—')
      setError(err instanceof Error ? err.message : 'Failed to load GRAI total supply')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { totalSupplyLabel, isLoading, error, refresh }
}
