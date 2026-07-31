import { useCallback, useEffect, useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { erc20Abi } from 'viem'
import { fetchEvmWalletAssetBalance } from '../grai/evm/readProtocol'
import { createGraiEvmPublicClient } from '../grai/evm/client'
import { isNativeEvmAsset } from '../grai/evm/knownAssets'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { formatTokenBalance, fetchMintDecimals, fetchWalletAssetBalance } from '../grai/onchain'
import { NATIVE_MINT } from '../grai/knownMints'
import { useSolanaWallet } from './useSolanaWallet'
import { useEvmWallet } from './useEvmWallet'

export function useWalletAssetBalance(assetMint: string | undefined, symbol: string | undefined) {
  const { publicKey, isConnected: isSolanaConnected, connection: walletConnection } = useSolanaWallet()
  const { address: evmAddress, isConnected: isEvmConnected } = useEvmWallet()
  const { connection: graiConnection, clusterMismatch, chainKind, evm } = useGraiDeployment()
  const connection = clusterMismatch ? graiConnection : (walletConnection ?? graiConnection)
  const [formattedBalance, setFormattedBalance] = useState<string | null>(null)
  const [maxAmount, setMaxAmount] = useState('')
  const [decimals, setDecimals] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const isConnected =
    chainKind === 'evm' ? isEvmConnected : chainKind === 'solana' ? isSolanaConnected : false

  useEffect(() => {
    if (!assetMint) {
      setDecimals(null)
      return
    }

    if (chainKind === 'evm') {
      if (isNativeEvmAsset(assetMint)) {
        setDecimals(18)
        return
      }
      if (!evm) {
        setDecimals(null)
        return
      }

      let cancelled = false
      const client = createGraiEvmPublicClient(evm)
      void client
        .readContract({
          address: assetMint as `0x${string}`,
          abi: erc20Abi,
          functionName: 'decimals',
        })
        .then((value) => {
          if (!cancelled) setDecimals(Number(value))
        })
        .catch(() => {
          if (!cancelled) setDecimals(18)
        })

      return () => {
        cancelled = true
      }
    }

    if (assetMint === NATIVE_MINT) {
      setDecimals(9)
      return
    }

    if (!graiConnection) {
      setDecimals(null)
      return
    }

    void fetchMintDecimals(graiConnection, new PublicKey(assetMint))
      .then(setDecimals)
      .catch(() => setDecimals(null))
  }, [assetMint, chainKind, evm, graiConnection])

  const refresh = useCallback(async () => {
    if (!assetMint) {
      setFormattedBalance(null)
      setMaxAmount('')
      return
    }

    if (chainKind === 'evm') {
      if (!evmAddress || !evm) {
        setFormattedBalance(null)
        setMaxAmount('')
        return
      }

      setIsLoading(true)
      try {
        const { raw, maxRaw, decimals: assetDecimals } = await fetchEvmWalletAssetBalance(
          evm,
          evmAddress as `0x${string}`,
          assetMint,
        )
        setFormattedBalance(formatTokenBalance(raw, assetDecimals))
        setMaxAmount(formatTokenBalance(maxRaw, assetDecimals))
        setDecimals(assetDecimals)
      } catch {
        setFormattedBalance(null)
        setMaxAmount('')
      } finally {
        setIsLoading(false)
      }
      return
    }

    if (!publicKey || !connection) {
      setFormattedBalance(null)
      setMaxAmount('')
      return
    }

    setIsLoading(true)
    try {
      const mint = new PublicKey(assetMint)
      const isNativeSol = assetMint === NATIVE_MINT
      const { raw, maxRaw, decimals: assetDecimals } = await fetchWalletAssetBalance(
        connection,
        publicKey,
        mint,
        isNativeSol,
      )
      setFormattedBalance(formatTokenBalance(raw, assetDecimals))
      setMaxAmount(formatTokenBalance(maxRaw, assetDecimals))
      setDecimals(assetDecimals)
    } catch {
      setFormattedBalance(null)
      setMaxAmount('')
    } finally {
      setIsLoading(false)
    }
  }, [assetMint, chainKind, connection, evm, evmAddress, publicKey])

  useEffect(() => {
    if (!assetMint) {
      setFormattedBalance(null)
      setMaxAmount('')
      setIsLoading(false)
      return
    }

    if (chainKind === 'evm') {
      if (!evmAddress || !evm) {
        setFormattedBalance(null)
        setMaxAmount('')
        setIsLoading(false)
        return
      }
    } else if (!publicKey || !connection) {
      setFormattedBalance(null)
      setMaxAmount('')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    void refresh()
  }, [assetMint, chainKind, connection, evm, evmAddress, publicKey, refresh])

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
