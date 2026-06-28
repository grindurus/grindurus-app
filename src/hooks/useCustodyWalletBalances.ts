import { useCallback, useEffect, useMemo, useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { fetchCustodyWalletBalances, type CustodyAssetBalances } from '../grai/fetchCustodyWalletBalances'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'

function resolveCustodyWallet(custodyWalletInput: string, connectedWallet: string | null): PublicKey | null {
  const trimmed = custodyWalletInput.trim()
  if (trimmed) {
    try {
      return new PublicKey(trimmed)
    } catch {
      return null
    }
  }

  if (!connectedWallet) return null

  try {
    return new PublicKey(connectedWallet)
  } catch {
    return null
  }
}

export function useCustodyWalletBalances(custodyWalletInput: string, connectedWallet: string | null) {
  const { connection, solana, isConfigured } = useGraiDeployment()
  const [balances, setBalances] = useState<Record<string, CustodyAssetBalances>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const custodyWallet = useMemo(
    () => resolveCustodyWallet(custodyWalletInput, connectedWallet),
    [connectedWallet, custodyWalletInput],
  )

  const refresh = useCallback(async () => {
    if (!connection || !solana || !isConfigured || !custodyWallet) {
      setBalances({})
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const nextBalances = await fetchCustodyWalletBalances(connection, solana, custodyWallet)
      setBalances(nextBalances)
    } catch (err) {
      setBalances({})
      setError(err instanceof Error ? err.message : 'Failed to load custody wallet balances')
    } finally {
      setIsLoading(false)
    }
  }, [connection, custodyWallet, isConfigured, solana])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    custodyWallet,
    balances,
    isLoading,
    error,
    refresh,
  }
}
