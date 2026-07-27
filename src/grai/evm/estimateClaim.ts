import { erc20Abi, maxUint256 } from 'viem'
import type { GraiEvmConfig } from '../deployments'
import { formatTokenBalance, parseTokenAmount } from '../onchain'
import { depositValue, USD_SCALE } from '../tokenomics'
import { graiAbi, priceOracleAbi } from './abi'
import { createGraiEvmPublicClient, resolveGraiContractAddress } from './client'
import { USD_SCALE_EVM } from './constants'
import { isNativeEvmAsset, resolveEvmGraiAsset } from './knownAssets'

const CLAIM_AMOUNT_MAX_FRACTION_DIGITS = 4
const CLAIM_USD_MAX_FRACTION_DIGITS = 2

export type EvmClaimEstimate = {
  assetAddress: `0x${string}`
  symbol: string
  icon: string
  amountRaw: bigint
  amountLabel: string
  usdRaw: bigint
  decimals: number
}

function formatClaimAmountLabel(amountRaw: bigint, decimals: number): string {
  if (amountRaw <= 0n) return '0.0'
  const label = formatTokenBalance(amountRaw, decimals, CLAIM_AMOUNT_MAX_FRACTION_DIGITS)
  return label.includes('.') ? label : `${label}.0`
}

/** Pending dividends for a single listed asset (`previewClaim(..., max)`). */
export async function estimateEvmClaimAsset(
  config: GraiEvmConfig,
  holder: `0x${string}`,
  assetAddress: `0x${string}`,
): Promise<EvmClaimEstimate> {
  const client = createGraiEvmPublicClient(config)
  const graiAddress = resolveGraiContractAddress(config)
  const asset = resolveEvmGraiAsset(assetAddress)

  const [amountRaw, decimals] = await Promise.all([
    client.readContract({
      address: graiAddress,
      abi: graiAbi,
      functionName: 'previewClaim',
      args: [holder, assetAddress, maxUint256],
    }),
    isNativeEvmAsset(assetAddress)
      ? Promise.resolve(18)
      : client
          .readContract({
            address: assetAddress,
            abi: erc20Abi,
            functionName: 'decimals',
          })
          .then((value) => Number(value)),
  ])

  let usdRaw = 0n
  if (amountRaw > 0n) {
    try {
      const [price, priceDecimals] = await client.readContract({
        address: graiAddress,
        abi: priceOracleAbi,
        functionName: 'getPrice',
        args: [assetAddress],
      })
      usdRaw = depositValue(amountRaw, decimals, price, Number(priceDecimals), USD_SCALE_EVM)
    } catch {
      usdRaw = 0n
    }
  }

  return {
    assetAddress,
    symbol: asset.symbol,
    icon: asset.icon.src,
    amountRaw,
    amountLabel: formatClaimAmountLabel(amountRaw, decimals),
    usdRaw,
    decimals,
  }
}

/** Pending listed-asset dividends from `previewClaimAll`. */
export async function estimateEvmClaimAll(
  config: GraiEvmConfig,
  holder: `0x${string}`,
): Promise<EvmClaimEstimate[]> {
  const client = createGraiEvmPublicClient(config)
  const graiAddress = resolveGraiContractAddress(config)

  const [claimAssets, amounts] = await client.readContract({
    address: graiAddress,
    abi: graiAbi,
    functionName: 'previewClaimAll',
    args: [holder],
  })

  return Promise.all(
    claimAssets.map(async (assetAddress, index) => {
      const amountRaw = amounts[index] ?? 0n
      const asset = resolveEvmGraiAsset(assetAddress)
      const decimals = isNativeEvmAsset(assetAddress)
        ? 18
        : Number(
            await client.readContract({
              address: assetAddress,
              abi: erc20Abi,
              functionName: 'decimals',
            }),
          )

      let usdRaw = 0n
      if (amountRaw > 0n) {
        try {
          const [price, priceDecimals] = await client.readContract({
            address: graiAddress,
            abi: priceOracleAbi,
            functionName: 'getPrice',
            args: [assetAddress],
          })
          usdRaw = depositValue(amountRaw, decimals, price, Number(priceDecimals), USD_SCALE_EVM)
        } catch {
          usdRaw = 0n
        }
      }

      return {
        assetAddress,
        symbol: asset.symbol,
        icon: asset.icon.src,
        amountRaw,
        amountLabel: formatClaimAmountLabel(amountRaw, decimals),
        usdRaw,
        decimals,
      }
    }),
  )
}

export function formatClaimUsdTotal(usdRaw: bigint): string {
  if (usdRaw <= 0n) return '$0.00'
  return `$${formatTokenBalance(usdRaw, USD_SCALE, CLAIM_USD_MAX_FRACTION_DIGITS)}`
}

export async function fetchEvmLockedGrai(
  config: GraiEvmConfig,
  owner: `0x${string}`,
): Promise<{ locked: bigint; voted: bigint; lockedAt: number; decimals: number }> {
  const client = createGraiEvmPublicClient(config)
  const graiAddress = resolveGraiContractAddress(config)
  const [escrow, decimalsRaw] = await Promise.all([
    client.readContract({
      address: graiAddress,
      abi: graiAbi,
      functionName: 'escrows',
      args: [owner],
    }),
    client.readContract({
      address: graiAddress,
      abi: graiAbi,
      functionName: 'decimals',
    }),
  ])
  return {
    locked: escrow[2],
    voted: escrow[3],
    lockedAt: Number(escrow[4]),
    decimals: Number(decimalsRaw),
  }
}

export type EvmUnlockPreview = {
  unlockAmount: bigint
  penalty: bigint
  unlockAmountLabel: string
  penaltyLabel: string
  /** Seconds until unlock penalty decays to 0 (`lockedAt + unlockPenaltyPeriod`). */
  secondsLeft: number
  unlockPenaltyPeriod: number
  unlockFeeBps: number
  lockedAt: number
  decimals: number
}

const BPS = 10_000n

/** Preview early-unlock penalty (local formula matching `GRAI.previewUnlock`). */
export async function estimateEvmUnlockPreview(
  config: GraiEvmConfig,
  owner: `0x${string}`,
  amountInput: string,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<EvmUnlockPreview> {
  const client = createGraiEvmPublicClient(config)
  const graiAddress = resolveGraiContractAddress(config)

  const [escrow, decimalsRaw, protocolConfig] = await Promise.all([
    client.readContract({
      address: graiAddress,
      abi: graiAbi,
      functionName: 'escrows',
      args: [owner],
    }),
    client.readContract({
      address: graiAddress,
      abi: graiAbi,
      functionName: 'decimals',
    }),
    client.readContract({
      address: graiAddress,
      abi: graiAbi,
      functionName: 'config',
    }),
  ])

  const decimals = Number(decimalsRaw)
  const lockedAt = Number(escrow[4])
  const unlockFeeBps = Number(protocolConfig[5])
  const unlockPenaltyPeriod = Number(protocolConfig[9])
  const secondsLeft =
    unlockPenaltyPeriod > 0 && lockedAt > 0
      ? Math.max(0, lockedAt + unlockPenaltyPeriod - nowSec)
      : 0

  let amountRaw = 0n
  const trimmed = amountInput.trim()
  if (trimmed) {
    try {
      amountRaw = parseTokenAmount(trimmed, decimals)
    } catch {
      amountRaw = 0n
    }
  }

  let unlockAmount = amountRaw
  let penalty = 0n

  if (amountRaw > 0n) {
    // Prefer on-chain preview when available; fall back to local decay math.
    try {
      const preview = await client.readContract({
        address: graiAddress,
        abi: graiAbi,
        functionName: 'previewUnlock',
        args: [owner, amountRaw, BigInt(nowSec)],
      })
      unlockAmount = preview[0]
      penalty = preview[1]
    } catch {
      if (unlockFeeBps > 0 && unlockPenaltyPeriod > 0 && lockedAt > 0) {
        const elapsed = Math.max(0, nowSec - lockedAt)
        if (elapsed < unlockPenaltyPeriod) {
          const penaltyBps =
            (BigInt(unlockFeeBps) * BigInt(unlockPenaltyPeriod - elapsed)) / BigInt(unlockPenaltyPeriod)
          penalty = (amountRaw * penaltyBps) / BPS
          unlockAmount = amountRaw - penalty
        }
      }
    }
  }

  return {
    unlockAmount,
    penalty,
    unlockAmountLabel: formatClaimAmountLabel(unlockAmount, decimals),
    penaltyLabel: formatClaimAmountLabel(penalty, decimals),
    secondsLeft,
    unlockPenaltyPeriod,
    unlockFeeBps,
    lockedAt,
    decimals,
  }
}

export function formatUnlockPenaltyDuration(secondsLeft: number): string {
  if (secondsLeft <= 0) return 'no penalty'
  const d = Math.floor(secondsLeft / 86_400)
  const h = Math.floor((secondsLeft % 86_400) / 3600)
  const m = Math.floor((secondsLeft % 3600) / 60)
  const s = secondsLeft % 60
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`
  return `${s}s`
}
