import { useCallback, useEffect, useState } from 'react'
import { fetchGraiMintSupply } from '../grai/fetchGraiMintSupply'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'

export function useGraiTotalSupply() {
  const { connection, solana, isConfigured } = useGraiDeployment()
  const [totalSupplyLabel, setTotalSupplyLabel] = useState('…')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!connection || !solana || !isConfigured) {
      setTotalSupplyLabel('—')
      setError('GRAI is not configured for this network')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const supply = await fetchGraiMintSupply(connection, solana)
      setTotalSupplyLabel(supply.label)
    } catch (err) {
      setTotalSupplyLabel('—')
      setError(err instanceof Error ? err.message : 'Failed to load GRAI total supply')
    } finally {
      setIsLoading(false)
    }
  }, [connection, isConfigured, solana])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { totalSupplyLabel, isLoading, error, refresh }
}
