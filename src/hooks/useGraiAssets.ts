import { useEffect, useState } from 'react'
import { useWalletContext } from '../providers/AppWalletProvider'
import { fetchGraiRegistryAssets } from '../grai/fetchAssets'
import { type GraiAsset } from '../grai/knownMints'
import { useSolanaWallet } from './useSolanaWallet'

export function useGraiAssets() {
  const { selectedChainType } = useWalletContext()
  const { isConnected } = useSolanaWallet()
  const [assets, setAssets] = useState<GraiAsset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRegistryLoaded, setIsRegistryLoaded] = useState(false)
  const isWalletReady = selectedChainType === 'solana' && isConnected

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const registryAssets = await fetchGraiRegistryAssets()
        if (cancelled) return
        setAssets(registryAssets)
        setIsRegistryLoaded(registryAssets.length > 0)
      } catch (err) {
        if (cancelled) return
        setAssets([])
        setIsRegistryLoaded(false)
        setError(err instanceof Error ? err.message : 'Failed to load GRAI assets')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  return { assets, isLoading, error, isRegistryLoaded, isWalletReady }
}
