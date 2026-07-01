import { useGraiData } from '../providers/GraiDataProvider'

export function useGraiAssets() {
  const {
    assets,
    assetsLoading,
    assetsError,
    isRegistryLoaded,
    isWalletReady,
  } = useGraiData()

  return {
    assets,
    isLoading: assetsLoading,
    error: assetsError,
    isRegistryLoaded,
    isWalletReady,
  }
}
