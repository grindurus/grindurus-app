import { useCallback, useEffect, useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { createGraiRegistryConnection } from '../grai/constants'
import { formatTokenBalance, fetchMintDecimals, fetchWalletAssetBalance } from '../grai/onchain'
import { NATIVE_MINT } from '../grai/knownMints'
import { useSolanaWallet } from './useSolanaWallet'

export function useWalletAssetBalance(assetMint: string | undefined, symbol: string | undefined) {
  const { publicKey, isConnected } = useSolanaWallet()
  const [formattedBalance, setFormattedBalance] = useState<string | null>(null)
  const [maxAmount, setMaxAmount] = useState('')
  const [decimals, setDecimals] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!assetMint) {
      setDecimals(null)
      return
    }

    if (assetMint === NATIVE_MINT) {
      setDecimals(9)
      return
    }

    const connection = createGraiRegistryConnection()
    void fetchMintDecimals(connection, new PublicKey(assetMint))
      .then(setDecimals)
      .catch(() => setDecimals(null))
  }, [assetMint])

  const refresh = useCallback(async () => {
    if (!publicKey || !assetMint) {
      setFormattedBalance(null)
      setMaxAmount('')
      return
    }

    setIsLoading(true)
    try {
      const connection = createGraiRegistryConnection()
      const mint = new PublicKey(assetMint)
      const isNativeSol = assetMint === NATIVE_MINT
      const { raw, maxRaw, decimals } = await fetchWalletAssetBalance(
        connection,
        publicKey,
        mint,
        isNativeSol,
      )
      setFormattedBalance(formatTokenBalance(raw, decimals))
      setMaxAmount(formatTokenBalance(maxRaw, decimals))
    } catch {
      setFormattedBalance(null)
      setMaxAmount('')
    } finally {
      setIsLoading(false)
    }
  }, [assetMint, publicKey])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const balanceLabel = isLoading
    ? '…'
    : `${formattedBalance ?? '0'} ${symbol ?? ''}`.trim()

  return {
    balanceLabel,
    isConnected,
    maxAmount,
    decimals,
    isLoading,
    refresh,
  }
}
