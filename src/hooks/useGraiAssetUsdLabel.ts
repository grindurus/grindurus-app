import { useEffect, useMemo, useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { fetchAccountsByKey } from '../grai/accountBatch'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { priceOracleAbi } from '../grai/evm/abi'
import { createGraiEvmPublicClient, resolveGraiContractAddress } from '../grai/evm/client'
import { GRAI_DECIMALS_EVM, USD_SCALE_EVM } from '../grai/evm/constants'
import { formatVaultBalanceDisplay } from '../grai/formatVaultBalance'
import { fetchAssetConfigPriceFeed, parseTokenAmount } from '../grai/onchain'
import { parseOraclePriceFeed } from '../grai/oraclePrice'
import { assetConfigPda } from '../grai/pdas'
import { depositValue, USD_SCALE } from '../grai/tokenomics'

function tryParseAmount(amountInput: string, assetDecimals: number): bigint | null {
  const trimmed = amountInput.trim()
  if (!trimmed || trimmed === '.' || trimmed.endsWith('.')) return null
  try {
    return parseTokenAmount(trimmed, assetDecimals)
  } catch {
    return null
  }
}

async function estimateSolanaAssetUsd(
  connection: NonNullable<ReturnType<typeof useGraiDeployment>['connection']>,
  solana: NonNullable<ReturnType<typeof useGraiDeployment>['solana']>,
  assetMint: string,
  amountRaw: bigint,
  assetDecimals: number,
): Promise<bigint> {
  const mint = new PublicKey(assetMint)
  const assetConfig = assetConfigPda(mint, solana.programId)
  const priceFeedKey = await fetchAssetConfigPriceFeed(connection, assetConfig)
  const accounts = await fetchAccountsByKey(connection, [priceFeedKey])
  const priceFeedAccount = accounts.get(priceFeedKey.toBase58())
  if (!priceFeedAccount) return 0n
  const oracle = parseOraclePriceFeed(priceFeedAccount)
  return depositValue(amountRaw, assetDecimals, oracle.price, oracle.decimals, USD_SCALE)
}

async function estimateEvmAssetUsd(
  evm: NonNullable<ReturnType<typeof useGraiDeployment>['evm']>,
  assetAddress: string,
  amountRaw: bigint,
  assetDecimals: number,
): Promise<bigint> {
  const client = createGraiEvmPublicClient(evm)
  const graiAddress = resolveGraiContractAddress(evm)
  const asset = assetAddress.toLowerCase() as `0x${string}`
  const [price, priceDecimals] = await client.readContract({
    address: graiAddress,
    abi: priceOracleAbi,
    functionName: 'getPrice',
    args: [asset],
  })
  return depositValue(amountRaw, assetDecimals, price, Number(priceDecimals), USD_SCALE_EVM)
}

/** USD label for an entered asset amount — same display style as mint `usdLabel`. */
export function useGraiAssetUsdLabel(
  assetMint: string | undefined,
  amountInput: string,
  assetDecimals: number | null,
) {
  const { connection, solana, evm, chainKind, isConfigured } = useGraiDeployment()
  const [usdRaw, setUsdRaw] = useState(0n)
  const [isLoading, setIsLoading] = useState(false)

  const usdScale = chainKind === 'evm' ? GRAI_DECIMALS_EVM : USD_SCALE

  useEffect(() => {
    if (!assetMint || assetDecimals === null || !amountInput.trim() || !isConfigured) {
      setUsdRaw(0n)
      setIsLoading(false)
      return
    }

    const amountRaw = tryParseAmount(amountInput, assetDecimals)
    if (amountRaw === null || amountRaw <= 0n) {
      setUsdRaw(0n)
      setIsLoading(false)
      return
    }

    const isSolanaReady = chainKind === 'solana' && connection && solana
    const isEvmReady = chainKind === 'evm' && evm
    if (!isSolanaReady && !isEvmReady) {
      setUsdRaw(0n)
      setIsLoading(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      setIsLoading(true)
      const estimatePromise =
        chainKind === 'evm' && evm
          ? estimateEvmAssetUsd(evm, assetMint, amountRaw, assetDecimals)
          : estimateSolanaAssetUsd(connection!, solana!, assetMint, amountRaw, assetDecimals)

      void estimatePromise
        .then((value) => {
          if (!cancelled) setUsdRaw(value)
        })
        .catch(() => {
          if (!cancelled) setUsdRaw(0n)
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false)
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [amountInput, assetDecimals, assetMint, chainKind, connection, evm, isConfigured, solana])

  const usdLabel = useMemo(() => {
    if (!amountInput.trim()) return '$0.00'
    if (isLoading) return '…'
    if (usdRaw <= 0n) return '$0.00'
    return `$${formatVaultBalanceDisplay(usdRaw, usdScale, 2)}`
  }, [amountInput, isLoading, usdRaw, usdScale])

  return { usdLabel, usdRaw, isLoading }
}
