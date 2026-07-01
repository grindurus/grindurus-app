import { useEffect } from 'react'
import type { GrinderConfig } from '../grai/grinders'
import { useGraiData } from '../providers/GraiDataProvider'

export type { GrinderCustodyState } from '../grai/grinderCustodyState'

export function useGrindersCustodyBalances(grinders: GrinderConfig[]) {
  const {
    grindersCustodyRows,
    grindersCustodyLoading,
    grindersCustodyError,
    refreshGrindersCustody,
    requestGrindersCustody,
  } = useGraiData()

  useEffect(() => {
    requestGrindersCustody(grinders)
  }, [grinders, requestGrindersCustody])

  return {
    rows: grindersCustodyRows,
    isLoading: grindersCustodyLoading,
    error: grindersCustodyError,
    refresh: refreshGrindersCustody,
  }
}
