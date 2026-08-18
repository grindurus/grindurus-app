import { useCallback, useEffect, useMemo, useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { erc20Abi } from 'viem'
import { fetchEvmWalletAssetBalance } from '../grai/evm/readProtocol'
import { createGraiEvmPublicClient } from '../grai/evm/client'
import { isNativeEvmAsset } from '../grai/evm/knownAssets'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { formatTokenBalance, fetchMintDecimals, fetchWalletAssetBalance } from '../grai/onchain'
import { isPlaceholderGraiAssetMint, NATIVE_MINT } from '../grai/knownMints'
import { useSolanaWallet } from './useSolanaWallet'
import { useEvmWallet } from './useEvmWallet'

function placeholderDecimals(symbol: string | undefined): number {
  const upper = symbol?.toUpperCase() ?? ''
  if (upper === 'SOL') return 9
  if (upper === 'ETH' || upper === 'WETH' || upper === 'BTC') return 8
  return 6
}

export function useWalletAssetBalance(assetMint: string | undefined, symbol: string | undefined) {
  const { publicKey, isConnected: isSolanaConnected, connection: walletConnection } = useSolanaWallet()
  const { address: evmAddress, isConnected: isEvmConnected } = useEvmWallet()
  const { connection: graiConnection, clusterMismatch, chainKind, evm } = useGraiDeployment()
  const connection = clusterMismatch ? graiConnection : (walletConnection ?? graiConnection)
  const [formattedBalance, setFormattedBalance] = useState<string | null>(null)
  const [maxAmount, setMaxAmount] = useState('')
  const [raw, setRaw] = useState(0n)
  const [decimals, setDecimals] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const isConnected =
    chainKind === 'evm' ? isEvmConnected : chainKind === 'solana' ? isSolanaConnected : false
  const isPlaceholderMint = Boolean(assetMint && isPlaceholderGraiAssetMint(assetMint))

  useEffect(() => {
    if (!assetMint) {
      setDecimals(null)
      return
    }

    if (isPlaceholderMint) {
      setDecimals(placeholderDecimals(symbol))
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
  }, [assetMint, chainKind, evm, graiConnection, isPlaceholderMint, symbol])

  const refresh = useCallback(async () => {
    if (!assetMint) {
      setFormattedBalance(null)
      setMaxAmount('')
      setRaw(0n)
      return
    }

    if (isPlaceholderMint) {
      setFormattedBalance('0')
      setMaxAmount('')
      setRaw(0n)
      setDecimals(placeholderDecimals(symbol))
      return
    }

    if (chainKind === 'evm') {
      if (!evmAddress || !evm) {
        setFormattedBalance(null)
        setMaxAmount('')
        setRaw(0n)
        return
      }

      setIsLoading(true)
      try {
        const { raw: walletRaw, maxRaw, decimals: assetDecimals } = await fetchEvmWalletAssetBalance(
          evm,
          evmAddress as `0x${string}`,
          assetMint,
        )
        setFormattedBalance(formatTokenBalance(walletRaw, assetDecimals))
        setMaxAmount(formatTokenBalance(maxRaw, assetDecimals))
        setRaw(walletRaw)
        setDecimals(assetDecimals)
      } catch {
        setFormattedBalance(null)
        setMaxAmount('')
        setRaw(0n)
      } finally {
        setIsLoading(false)
      }
      return
    }

    if (!publicKey || !connection) {
      setFormattedBalance(null)
      setMaxAmount('')
      setRaw(0n)
      return
    }

    setIsLoading(true)
    try {
      const mint = new PublicKey(assetMint)
      const isNativeSol = assetMint === NATIVE_MINT
      const { raw: walletRaw, maxRaw, decimals: assetDecimals } = await fetchWalletAssetBalance(
        connection,
        publicKey,
        mint,
        isNativeSol,
      )
      setFormattedBalance(formatTokenBalance(walletRaw, assetDecimals))
      setMaxAmount(formatTokenBalance(maxRaw, assetDecimals))
      setRaw(walletRaw)
      setDecimals(assetDecimals)
    } catch {
      setFormattedBalance(null)
      setMaxAmount('')
      setRaw(0n)
    } finally {
      setIsLoading(false)
    }
  }, [assetMint, chainKind, connection, evm, evmAddress, isPlaceholderMint, publicKey, symbol])

  useEffect(() => {
    if (!assetMint) {
      setFormattedBalance(null)
      setMaxAmount('')
      setRaw(0n)
      setIsLoading(false)
      return
    }

    if (isPlaceholderMint) {
      setFormattedBalance('0')
      setMaxAmount('')
      setRaw(0n)
      setDecimals(placeholderDecimals(symbol))
      setIsLoading(false)
      return
    }

    if (chainKind === 'evm') {
      if (!evmAddress || !evm) {
        setFormattedBalance(null)
        setMaxAmount('')
        setRaw(0n)
        setIsLoading(false)
        return
      }
    } else if (!publicKey || !connection) {
      setFormattedBalance(null)
      setMaxAmount('')
      setRaw(0n)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    void refresh()
  }, [assetMint, chainKind, connection, evm, evmAddress, isPlaceholderMint, publicKey, refresh, symbol])

  const balanceLabel = isLoading
    ? '…'
    : `${formattedBalance ?? '0'} ${symbol ?? ''}`.trim()

  return {
    balanceLabel,
    isConnected,
    maxAmount,
    raw,
    decimals,
    isLoading,
    refresh,
  }
}

export type WalletBalanceAsset = {
  address: string
  symbol: string
}

/** Parallel wallet balances keyed by lowercased address (display amounts only). */
export function useWalletAssetBalances(assets: WalletBalanceAsset[]) {
  const { publicKey, isConnected: isSolanaConnected, connection: walletConnection } = useSolanaWallet()
  const { address: evmAddress, isConnected: isEvmConnected } = useEvmWallet()
  const { connection: graiConnection, clusterMismatch, chainKind, evm } = useGraiDeployment()
  const connection = clusterMismatch ? graiConnection : (walletConnection ?? graiConnection)
  const [balancesByAddress, setBalancesByAddress] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  const isConnected =
    chainKind === 'evm' ? isEvmConnected : chainKind === 'solana' ? isSolanaConnected : false

  const assetsKey = useMemo(
    () => assets.map((asset) => `${asset.address.toLowerCase()}:${asset.symbol}`).join('|'),
    [assets],
  )

  useEffect(() => {
    let cancelled = false

    if (assets.length === 0) {
      setBalancesByAddress({})
      setIsLoading(false)
      return
    }

    const placeholders: Record<string, string> = {}
    const toFetch: WalletBalanceAsset[] = []
    for (const asset of assets) {
      const key = asset.address.toLowerCase()
      if (isPlaceholderGraiAssetMint(asset.address)) {
        placeholders[key] = '0'
      } else {
        toFetch.push(asset)
      }
    }

    if (!isConnected) {
      const disconnected: Record<string, string> = { ...placeholders }
      for (const asset of toFetch) {
        disconnected[asset.address.toLowerCase()] = '—'
      }
      setBalancesByAddress(disconnected)
      setIsLoading(false)
      return
    }

    if (toFetch.length === 0) {
      setBalancesByAddress(placeholders)
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    void (async () => {
      const next: Record<string, string> = { ...placeholders }

      if (chainKind === 'evm') {
        if (!evmAddress || !evm) {
          for (const asset of toFetch) next[asset.address.toLowerCase()] = '—'
        } else {
          await Promise.all(
            toFetch.map(async (asset) => {
              const key = asset.address.toLowerCase()
              try {
                const { raw, decimals } = await fetchEvmWalletAssetBalance(
                  evm,
                  evmAddress as `0x${string}`,
                  asset.address,
                )
                next[key] = formatTokenBalance(raw, decimals)
              } catch {
                next[key] = '0'
              }
            }),
          )
        }
      } else if (!publicKey || !connection) {
        for (const asset of toFetch) next[asset.address.toLowerCase()] = '—'
      } else {
        await Promise.all(
          toFetch.map(async (asset) => {
            const key = asset.address.toLowerCase()
            try {
              const mint = new PublicKey(asset.address)
              const { raw, decimals } = await fetchWalletAssetBalance(
                connection,
                publicKey,
                mint,
                asset.address === NATIVE_MINT,
              )
              next[key] = formatTokenBalance(raw, decimals)
            } catch {
              next[key] = '0'
            }
          }),
        )
      }

      if (!cancelled) {
        setBalancesByAddress(next)
        setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [assets, assetsKey, chainKind, connection, evm, evmAddress, isConnected, publicKey])

  return { balancesByAddress, isLoading, isConnected }
}
