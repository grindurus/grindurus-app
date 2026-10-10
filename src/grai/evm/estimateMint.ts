import type { GraiEvmConfig } from '../deployments'
import { parseTokenAmount } from '../onchain'
import { graiAbi } from './abi'
import { createGraiEvmPublicClient, resolveGraiContractAddress } from './client'

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

  const assetConfig = await client.readContract({
    address: graiAddress,
    abi: graiAbi,
    functionName: 'assets',
    args: [asset],
  })

  if (!assetConfig[0] || assetConfig[0] === '0x0000000000000000000000000000000000000000') {
    throw new Error('Asset is not registered in GRAI protocol')
  }

  // Prefer on-chain preview (no senior/junior split on current GRAI).
  const [depositValueUsd, graiRaw] = await client.readContract({
    address: graiAddress,
    abi: graiAbi,
    functionName: 'previewDeposit',
    args: [asset, depositAmount],
  })

  return {
    graiRaw,
    seniorRaw: depositAmount,
    juniorRaw: 0n,
    seniorUsdRaw: depositValueUsd,
    juniorUsdRaw: 0n,
  }
}
