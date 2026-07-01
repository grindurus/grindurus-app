import { useGraiData } from '../providers/GraiDataProvider'

export function useGraiVaultBalances() {
  const { vaultBalances, vaultBalancesLoading, vaultBalancesError, refreshVaultBalances } = useGraiData()

  return {
    vaultBalances,
    isLoading: vaultBalancesLoading,
    error: vaultBalancesError,
    refresh: refreshVaultBalances,
  }
}
