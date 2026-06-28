import { useEffect, useState } from 'react'
import { useWalletContext } from '../providers/AppWalletProvider'
import { fetchGraiRegistryAssets } from '../grai/fetchAssets'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { type GraiAsset } from '../grai/knownMints'
import { useSolanaWallet } from './useSolanaWallet'

export function useGraiAssets() {
  const { selectedChainType } = useWalletContext()
  const { isConnected } = useSolanaWallet()
  const { connection, solana, isConfigured } = useGraiDeployment()
  const [assets, setAssets] = useState<GraiAsset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRegistryLoaded, setIsRegistryLoaded] = useState(false)
  const isWalletReady = selectedChainType === 'solana' && isConnected

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!connection || !solana || !isConfigured) {
        setAssets([])
        setIsRegistryLoaded(false)
        setError('GRAI is not configured for this network')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)
      try {
        const registryAssets = await fetchGraiRegistryAssets(connection, solana)
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
  }, [connection, isConfigured, solana])

  return { assets, isLoading, error, isRegistryLoaded, isWalletReady }
}
