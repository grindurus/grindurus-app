import type { GraiEvmConfig } from '../deployments'
import { parseTokenAmount } from '../onchain'
import { depositValue, graiMintAmount, mintSplit } from '../tokenomics'
import { graiAbi, priceOracleAbi } from './abi'
import { createGraiEvmPublicClient, resolveGraiContractAddress } from './client'
import { USD_SCALE_EVM } from './constants'
import { isNativeEvmAsset } from './knownAssets'
import { erc20Abi } from 'viem'

export type EvmGraiMintEstimate = {
  graiRaw: bigint
  seniorRaw: bigint
  juniorRaw: bigint
  seniorUsdRaw: bigint
  juniorUsdRaw: bigint
}

function tryParseDepositAmount(amountInput: string, assetDecimals: number): bigint | null {
  const trimmed = amountInput.trim()
  if (!trimmed || trimmed === '.' || trimmed.endsWith('.')) return null

  try {
    return parseTokenAmount(trimmed, assetDecimals)
  } catch {
    return null
  }
}

export async function estimateEvmGraiMintOutput(
  config: GraiEvmConfig,
  assetAddress: string,
  amountInput: string,
  assetDecimals: number,
): Promise<EvmGraiMintEstimate | null> {
  const depositAmount = tryParseDepositAmount(amountInput, assetDecimals)
  if (depositAmount === null) return null

  const client = createGraiEvmPublicClient(config)
  const graiAddress = resolveGraiContractAddress(config)
  const asset = assetAddress.toLowerCase() as `0x${string}`

  const [totalValue, totalSupply, assetConfig] = await Promise.all([
    client.readContract({
      address: graiAddress,
      abi: graiAbi,
      functionName: 'totalValue',
    }),
    client.readContract({
      address: graiAddress,
      abi: graiAbi,
      functionName: 'totalSupply',
    }),
    client.readContract({
      address: graiAddress,
      abi: graiAbi,
      functionName: 'assets',
      args: [asset],
    }),
  ])

  if (!assetConfig[0]) {
    throw new Error('Asset is not registered in GRAI protocol')
  }

  const [price, priceDecimals] = await client.readContract({
    address: graiAddress,
    abi: priceOracleAbi,
    functionName: 'getPrice',
    args: [asset],
  })

  const decimals =
    assetDecimals ??
    (isNativeEvmAsset(asset)
      ? 18
      : Number(
          await client.readContract({
            address: asset,
            abi: erc20Abi,
            functionName: 'decimals',
          }),
        ))

  const depositValueUsd = depositValue(
    depositAmount,
    decimals,
    price,
    Number(priceDecimals),
    USD_SCALE_EVM,
  )
  const graiRaw = graiMintAmount(depositValueUsd, totalSupply, totalValue)
  const mintSplitBps = Number(assetConfig[1])
  const [seniorRaw, juniorRaw] = mintSplit(depositAmount, mintSplitBps)
  const seniorUsdRaw = depositValue(seniorRaw, decimals, price, Number(priceDecimals), USD_SCALE_EVM)
  const juniorUsdRaw = depositValue(juniorRaw, decimals, price, Number(priceDecimals), USD_SCALE_EVM)

  return { graiRaw, seniorRaw, juniorRaw, seniorUsdRaw, juniorUsdRaw }
}
