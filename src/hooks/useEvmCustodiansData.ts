import { useCallback, useEffect, useState } from 'react'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { fetchEvmCustodiansData } from '../grai/evm/fetchCustodians'
import type { GrinderCustodyState } from '../grai/grinderCustodyState'

export function useEvmCustodiansData() {
  const { chainKind, evm } = useGraiDeployment()
  const [rows, setRows] = useState<GrinderCustodyState[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (chainKind !== 'evm' || !evm) {
      setRows([])
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const { rows: next } = await fetchEvmCustodiansData(evm)
      setRows(next)
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : 'Failed to load custodians')
    } finally {
      setIsLoading(false)
    }
  }, [chainKind, evm])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    rows,
    isLoading,
    error,
    refresh,
    enabled: chainKind === 'evm' && Boolean(evm),
  }
}
