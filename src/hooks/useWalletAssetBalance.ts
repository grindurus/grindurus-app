import { useCallback, useEffect, useMemo, useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { erc20Abi } from 'viem'
import { fetchEvmWalletAssetBalance } from '../grai/evm/readProtocol'
import { createGraiEvmPublicClient } from '../grai/evm/client'
import { isNativeEvmAsset } from '../grai/evm/knownAssets'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { formatTokenBalance, fetchMintDecimals, fetchWalletAssetBalance } from '../grai/onchain'
import { isPlaceholderGraiAssetMint, NATIVE_MINT } from '../grai/knownMints'
import { useSolanaWallet } from '../wallets/useSolanaWallet'
import { useEvmWallet } from '../wallets/useEvmWallet'

function placeholderDecimals(symbol: string | undefined): number {
  const upper = symbol?.toUpperCase() ?? ''
  if (upper === 'SOL') return 9
  if (upper === 'ETH' || upper === 'WETH' || upper === 'BTC') return 8
  return 6
}

function tryPublicKey(value: string | undefined | null): PublicKey | null {
  if (!value) return null
  try {
    return new PublicKey(value)
  } catch {
    return null
  }
}

/** Max fraction digits for asset-select trigger + dropdown balance chips. */
const ASSET_SELECT_BALANCE_FRACTION_DIGITS = 8

/** App-cluster RPC + owner from adapter publicKey or base58 address. */
function useSolanaBalanceConnection() {
  const { address, publicKey, isConnected } = useSolanaWallet()
  const { connection } = useGraiDeployment()
  const owner = publicKey ?? tryPublicKey(address)
  // Treat a resolved owner as connected — snapshot `isConnected` can lag after stack remounts.
  return { connection, owner, isConnected: Boolean(owner) || isConnected }
}

export function useWalletAssetBalance(assetMint: string | undefined, symbol: string | undefined) {
  const { address: evmAddress, isConnected: isEvmConnected } = useEvmWallet()
  const { chainKind, evm } = useGraiDeployment()
  const {
    connection: solanaConnection,
    owner: solanaOwner,
    isConnected: isSolanaConnected,
  } = useSolanaBalanceConnection()
  const [formattedBalance, setFormattedBalance] = useState<string | null>(null)
  const [maxAmount, setMaxAmount] = useState('')
  const [raw, setRaw] = useState(0n)
  const [decimals, setDecimals] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const isConnected =
    chainKind === 'evm' ? isEvmConnected : chainKind === 'solana' ? isSolanaConnected : isSolanaConnected || isEvmConnected
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

    if (!solanaConnection) {
      setDecimals(null)
      return
    }

    // Stale EVM `0x…` mints must not reach PublicKey — sync throw unmounts the React root.
    const mint = tryPublicKey(assetMint)
    if (!mint) {
      setDecimals(null)
      return
    }

    void fetchMintDecimals(solanaConnection, mint)
      .then(setDecimals)
      .catch(() => setDecimals(null))
  }, [assetMint, chainKind, evm, isPlaceholderMint, solanaConnection, symbol])

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
        setFormattedBalance(
          formatTokenBalance(walletRaw, assetDecimals, ASSET_SELECT_BALANCE_FRACTION_DIGITS),
        )
        // Exact/floor — half-up display rounding made MAX exceed on-chain WETH balance.
        setMaxAmount(formatTokenBalance(maxRaw, assetDecimals, assetDecimals, 'floor'))
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

    if (!solanaOwner || !solanaConnection) {
      setFormattedBalance(null)
      setMaxAmount('')
      setRaw(0n)
      return
    }

    setIsLoading(true)
    try {
      const mint = tryPublicKey(assetMint)
      if (!mint) {
        setFormattedBalance(null)
        setMaxAmount('')
        setRaw(0n)
        return
      }
      const isNativeSol = assetMint === NATIVE_MINT
      const { raw: walletRaw, maxRaw, decimals: assetDecimals } = await fetchWalletAssetBalance(
        solanaConnection,
        solanaOwner,
        mint,
        isNativeSol,
      )
      setFormattedBalance(
        formatTokenBalance(walletRaw, assetDecimals, ASSET_SELECT_BALANCE_FRACTION_DIGITS),
      )
      setMaxAmount(formatTokenBalance(maxRaw, assetDecimals, assetDecimals, 'floor'))
      setRaw(walletRaw)
      setDecimals(assetDecimals)
    } catch {
      setFormattedBalance(null)
      setMaxAmount('')
      setRaw(0n)
    } finally {
      setIsLoading(false)
    }
  }, [
    assetMint,
    chainKind,
    evm,
    evmAddress,
    isPlaceholderMint,
    solanaConnection,
    solanaOwner,
    symbol,
  ])

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
    } else if (!solanaOwner || !solanaConnection) {
      setFormattedBalance(null)
      setMaxAmount('')
      setRaw(0n)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    void refresh()
  }, [
    assetMint,
    chainKind,
    evm,
    evmAddress,
    isPlaceholderMint,
    refresh,
    solanaConnection,
    solanaOwner,
    symbol,
  ])

  const balanceLabel = isLoading
    ? '…'
    : formattedBalance == null
      ? '—'
      : `${formattedBalance} ${symbol ?? ''}`.trim()

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
  const { address: evmAddress, isConnected: isEvmConnected } = useEvmWallet()
  const { chainKind, evm } = useGraiDeployment()
  const {
    connection: solanaConnection,
    owner: solanaOwner,
    isConnected: isSolanaConnected,
  } = useSolanaBalanceConnection()
  const [balancesByAddress, setBalancesByAddress] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  const isConnected =
    chainKind === 'evm' ? isEvmConnected : chainKind === 'solana' ? isSolanaConnected : isSolanaConnected || isEvmConnected

  const assetsKey = useMemo(
    () => assets.map((asset) => `${asset.address.toLowerCase()}:${asset.symbol}`).join('|'),
    [assets],
  )

  const refresh = useCallback(async () => {
    if (assets.length === 0) {
      setBalancesByAddress({})
      setIsLoading(false)
      return
    }

    const placeholders: Record<string, string> = {}
    const toFetch: WalletBalanceAsset[] = []
    for (const asset of assets) {
      const key = asset.address.toLowerCase()
      if (!asset.address || isPlaceholderGraiAssetMint(asset.address)) {
        placeholders[key || asset.symbol.toLowerCase()] = '0'
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
    const next: Record<string, string> = { ...placeholders }

    try {
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
                next[key] = formatTokenBalance(raw, decimals, ASSET_SELECT_BALANCE_FRACTION_DIGITS)
              } catch {
                next[key] = '0'
              }
            }),
          )
        }
      } else if (!solanaOwner || !solanaConnection) {
        for (const asset of toFetch) next[asset.address.toLowerCase()] = '—'
      } else {
        await Promise.all(
          toFetch.map(async (asset) => {
            const key = asset.address.toLowerCase()
            try {
              const mint = new PublicKey(asset.address)
              const { raw, decimals } = await fetchWalletAssetBalance(
                solanaConnection,
                solanaOwner,
                mint,
                asset.address === NATIVE_MINT,
              )
              next[key] = formatTokenBalance(raw, decimals, ASSET_SELECT_BALANCE_FRACTION_DIGITS)
            } catch {
              next[key] = '0'
            }
          }),
        )
      }
      setBalancesByAddress(next)
    } finally {
      setIsLoading(false)
    }
  }, [
    assets,
    chainKind,
    evm,
    evmAddress,
    isConnected,
    solanaConnection,
    solanaOwner,
  ])

  useEffect(() => {
    void refresh()
  }, [assetsKey, refresh])

  return { balancesByAddress, isLoading, isConnected, refresh }
}
