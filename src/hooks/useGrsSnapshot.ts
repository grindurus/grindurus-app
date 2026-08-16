import { useCallback, useEffect, useMemo, useState } from 'react'
import { useEvmWallet } from './useEvmWallet'
import { useWalletContext } from '../providers/AppWalletProvider'
import {
  listConfiguredGrsChains,
  resolveGrsEvmConfig,
  type GrsEvmConfig,
} from '../grs/deployments'
import { fetchGrsSnapshot, type GrsSnapshot } from '../grs/evm/readProtocol'

function contextChainId(evmChain: 'ethereum' | 'arbitrum' | 'sepolia'): number {
  if (evmChain === 'ethereum') return 1
  if (evmChain === 'arbitrum') return 42161
  return 11155111
}

export function useGrsSnapshot() {
  const evmWallet = useEvmWallet()
  const { selectedChainType, evmChain } = useWalletContext()

  const chainId = useMemo(() => {
    if (selectedChainType === 'evm' && evmWallet.isConnected && evmWallet.chainId) {
      return evmWallet.chainId
    }
    if (selectedChainType === 'evm') return contextChainId(evmChain)
    const configured = listConfiguredGrsChains()
    return configured[0]?.chainId ?? contextChainId(evmChain)
  }, [evmChain, evmWallet.chainId, evmWallet.isConnected, selectedChainType])

  const config = useMemo(() => resolveGrsEvmConfig(chainId), [chainId])
  const owner = evmWallet.isConnected ? (evmWallet.address as `0x${string}` | undefined) : undefined

  const [snapshot, setSnapshot] = useState<GrsSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const refresh = useCallback(() => {
    setReloadToken((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!config) {
      setSnapshot(null)
      setError(null)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    void fetchGrsSnapshot(config, owner)
      .then((next) => {
        if (!cancelled) {
          setSnapshot(next)
          setError(null)
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setSnapshot(null)
          setError(loadError instanceof Error ? loadError.message : 'Failed to load GRS')
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [config, owner, reloadToken])

  return {
    chainId,
    config,
    snapshot,
    isLoading,
    error,
    refresh,
    configuredChains: listConfiguredGrsChains(),
    owner,
  }
}

export type { GrsEvmConfig }
