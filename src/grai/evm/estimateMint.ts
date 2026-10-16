import { zeroAddress } from 'viem'
import type { GraiEvmConfig } from '../deployments'
import { parseTokenAmount } from '../onchain'
import { graiAbi } from './abi'
import { createGraiEvmPublicClient, resolveGraiContractAddress } from './client'
import { isNativeEvmAsset } from './knownAssets'

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

  // Native ETH is keyed as address(0). Checking `assets(asset).asset != 0` falsely
  // treats it as unregistered and zeroes mint/USD estimates.
  if (isNativeEvmAsset(asset)) {
    const listed = await client.readContract({
      address: graiAddress,
      abi: graiAbi,
      functionName: 'getAssets',
    })
    if (!listed.some((item) => item.toLowerCase() === asset)) {
      throw new Error('Asset is not registered in GRAI protocol')
    }
  } else {
    const assetConfig = await client.readContract({
      address: graiAddress,
      abi: graiAbi,
      functionName: 'assets',
      args: [asset],
    })
    if (!assetConfig[0] || assetConfig[0].toLowerCase() === zeroAddress) {
      throw new Error('Asset is not registered in GRAI protocol')
    }
  }

  // Prefer on-chain preview (no senior/junior split on current GRAI).
  const [depositValueUsd, graiRaw] = await client.readContract({
    address: graiAddress,
    abi: graiAbi,
    functionName: 'previewDeposit',
    args: [asset, depositAmount],
  })

  // Entire deposit goes to Grinders (same as Solana estimate — no senior split).
  return {
    graiRaw,
    seniorRaw: 0n,
    juniorRaw: depositAmount,
    seniorUsdRaw: 0n,
    juniorUsdRaw: depositValueUsd,
  }
}
