import { useCallback, useEffect, useState } from 'react'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import {
  fetchEvmBuybackAuctions,
  fetchSolanaBuybackAuctions,
  type GraiBuybackAuction,
} from '../grai/fetchBuybackAuctions'

export function useGraiBuybackAuctions() {
  const { connection, solana, evm, chainKind, isConfigured } = useGraiDeployment()
  const [auctions, setAuctions] = useState<GraiBuybackAuction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!isConfigured) {
      setAuctions([])
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      if (chainKind === 'evm' && evm) {
        setAuctions(await fetchEvmBuybackAuctions(evm))
        return
      }
      if (chainKind === 'solana' && connection && solana) {
        setAuctions(await fetchSolanaBuybackAuctions(connection, solana))
        return
      }
      setAuctions([])
    } catch (err) {
      setAuctions([])
      setError(err instanceof Error ? err.message : 'Failed to load buyback auctions')
    } finally {
      setIsLoading(false)
    }
  }, [chainKind, connection, evm, isConfigured, solana])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { auctions, isLoading, error, refresh }
}
