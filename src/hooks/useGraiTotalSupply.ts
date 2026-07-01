import { useGraiData } from '../providers/GraiDataProvider'

export function useGraiTotalSupply() {
  const { totalSupplyLabel, totalSupplyLoading, totalSupplyError, refreshTotalSupply } = useGraiData()

  return {
    totalSupplyLabel,
    isLoading: totalSupplyLoading,
    error: totalSupplyError,
    refresh: refreshTotalSupply,
  }
}
