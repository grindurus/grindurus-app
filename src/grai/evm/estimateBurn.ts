import { erc20Abi } from 'viem'
import type { GraiEvmConfig } from '../deployments'
import type { GraiBurnOutputEstimate } from '../estimateGraiBurn'
import { formatTokenBalance, parseTokenAmount } from '../onchain'
import { depositValue, redeemAssetAmount, USD_SCALE } from '../tokenomics'
import { graiAbi, priceOracleAbi } from './abi'
import { createGraiEvmPublicClient, resolveGraiContractAddress } from './client'
import { USD_SCALE_EVM } from './constants'
import { isNativeEvmAsset, resolveEvmGraiAsset } from './knownAssets'

const BURN_AMOUNT_MAX_FRACTION_DIGITS = 4
const BURN_USD_MAX_FRACTION_DIGITS = 2

function tryParseGraiAmount(amountInput: string, graiDecimals: number): bigint | null {
  const trimmed = amountInput.trim()
  if (!trimmed || trimmed === '.' || trimmed.endsWith('.')) return null

  try {
    return parseTokenAmount(trimmed, graiDecimals)
  } catch {
    return null
  }
}

function formatBurnAmountLabel(redeemRaw: bigint, decimals: number): string {
  if (redeemRaw <= 0n) return '0.0'
  const label = formatTokenBalance(redeemRaw, decimals, BURN_AMOUNT_MAX_FRACTION_DIGITS)
  return label.includes('.') ? label : `${label}.0`
}

export async function estimateEvmGraiBurnOutputs(
  config: GraiEvmConfig,
  graiAmountInput: string,
  graiDecimals: number,
): Promise<GraiBurnOutputEstimate[] | null> {
  const graiAmount = tryParseGraiAmount(graiAmountInput, graiDecimals)
  if (graiAmount === null) return null

  const client = createGraiEvmPublicClient(config)
  const graiAddress = resolveGraiContractAddress(config)

  const [totalSupply, vaults] = await Promise.all([
    client.readContract({
      address: graiAddress,
      abi: graiAbi,
      functionName: 'totalSupply',
    }),
    client.readContract({
      address: graiAddress,
      abi: graiAbi,
      functionName: 'getVaultsData',
    }),
  ])

  if (totalSupply <= 0n || graiAmount > totalSupply) {
    return vaults.map((vault) => ({
      asset: resolveEvmGraiAsset(vault.asset),
      amountLabel: '0',
      usdLabel: null,
      usdRaw: 0n,
    }))
  }

  return Promise.all(
    vaults.map(async (vault) => {
      const asset = resolveEvmGraiAsset(vault.asset)
      const decimals = isNativeEvmAsset(vault.asset)
        ? 18
        : Number(
            await client.readContract({
              address: vault.asset,
              abi: erc20Abi,
              functionName: 'decimals',
            }),
          )

      const redeemRaw = redeemAssetAmount(graiAmount, totalSupply, vault.seniorBalance)
      let usdRaw = 0n

      if (redeemRaw > 0n) {
        try {
          const [price, priceDecimals] = await client.readContract({
            address: graiAddress,
            abi: priceOracleAbi,
            functionName: 'getPrice',
            args: [vault.asset],
          })
          usdRaw = depositValue(
            redeemRaw,
            decimals,
            price,
            Number(priceDecimals),
            USD_SCALE_EVM,
          )
        } catch {
          usdRaw = 0n
        }
      }

      const usdLabel =
        usdRaw > 0n
          ? `$${formatTokenBalance(usdRaw, USD_SCALE, BURN_USD_MAX_FRACTION_DIGITS)}`
          : null

      return {
        asset,
        amountLabel: formatBurnAmountLabel(redeemRaw, decimals),
        usdLabel,
        usdRaw,
      }
    }),
  )
}
