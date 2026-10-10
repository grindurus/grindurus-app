import { erc20Abi, zeroAddress } from 'viem'
import type { GraiEvmConfig } from '../deployments'
import type { GraiAsset } from '../knownMints'
import { formatTokenBalance } from '../onchain'
import type { GraiAssetVaultBalances } from '../fetchVaultBalances'
import { depositValue } from '../tokenomics'
import { graiAbi, grindersAbi, priceOracleAbi } from './abi'
import { createGraiEvmPublicClient, resolveGraiContractAddress } from './client'
import { GRAI_DECIMALS_EVM, USD_SCALE_EVM } from './constants'
import { isNativeEvmAsset, resolveEvmGraiAsset } from './knownAssets'

export async function fetchEvmGraiAssets(config: GraiEvmConfig): Promise<GraiAsset[]> {
  const client = createGraiEvmPublicClient(config)
  const graiAddress = resolveGraiContractAddress(config)
  const assets = await client.readContract({
    address: graiAddress,
    abi: graiAbi,
    functionName: 'getAssets',
  })

  return assets.map((address) => resolveEvmGraiAsset(address))
}

export type EvmListedAsset = {
  address: `0x${string}`
  symbol: string
  icon: string
  decimals: number
  bribeable: boolean
}

async function fetchEvmListedAssets(config: GraiEvmConfig): Promise<EvmListedAsset[]> {
  const client = createGraiEvmPublicClient(config)
  const graiAddress = resolveGraiContractAddress(config)
  const assets = await client.readContract({
    address: graiAddress,
    abi: graiAbi,
    functionName: 'getAssets',
  })

  return Promise.all(
    assets.map(async (address) => {
      const meta = resolveEvmGraiAsset(address)
      const [decimals, assetConfig] = await Promise.all([
        readAssetDecimals(config, address),
        client.readContract({
          address: graiAddress,
          abi: graiAbi,
          functionName: 'assets',
          args: [address],
        }),
      ])
      return {
        address,
        symbol: meta.symbol,
        icon: meta.icon.src,
        decimals,
        bribeable: Boolean(assetConfig[2]),
      }
    }),
  )
}

/** First bribeable listed asset, or zero if none configured. */
export async function resolveEvmBribePaymentAsset(
  config: GraiEvmConfig,
): Promise<`0x${string}`> {
  const listed = await fetchEvmListedAssets(config)
  const bribeable = listed.find((asset) => asset.bribeable)
  return bribeable?.address ?? zeroAddress
}

export async function fetchEvmGraiTotalSupply(config: GraiEvmConfig) {
  const client = createGraiEvmPublicClient(config)
  const graiAddress = resolveGraiContractAddress(config)
  const [raw, decimals] = await Promise.all([
    client.readContract({
      address: graiAddress,
      abi: graiAbi,
      functionName: 'totalSupply',
    }),
    client.readContract({
      address: graiAddress,
      abi: graiAbi,
      functionName: 'decimals',
    }),
  ])

  return {
    raw,
    decimals: Number(decimals),
    label: formatTokenBalance(raw, Number(decimals), 4),
  }
}

async function readAssetDecimals(
  config: GraiEvmConfig,
  asset: `0x${string}`,
): Promise<number> {
  if (isNativeEvmAsset(asset)) return 18

  const client = createGraiEvmPublicClient(config)
  const decimals = await client.readContract({
    address: asset,
    abi: erc20Abi,
    functionName: 'decimals',
  })
  return Number(decimals)
}

async function readAssetPrice(
  config: GraiEvmConfig,
  asset: `0x${string}`,
): Promise<{ price: bigint; decimals: number }> {
  const client = createGraiEvmPublicClient(config)
  const graiAddress = resolveGraiContractAddress(config)

  const [price, priceDecimals] = await client.readContract({
    address: graiAddress,
    abi: priceOracleAbi,
    functionName: 'getPrice',
    args: [asset],
  })

  return { price, decimals: Number(priceDecimals) }
}

async function readGraiAssetBalance(
  config: GraiEvmConfig,
  graiAddress: `0x${string}`,
  asset: `0x${string}`,
): Promise<bigint> {
  const client = createGraiEvmPublicClient(config)
  if (isNativeEvmAsset(asset)) {
    return client.getBalance({ address: graiAddress })
  }
  return client.readContract({
    address: asset,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [graiAddress],
  })
}

/** Idle GRAI balances + Grinders allocations per listed asset (replaces removed `getVaultsData`). */
export async function fetchEvmGraiVaultBalances(
  config: GraiEvmConfig,
): Promise<Record<string, GraiAssetVaultBalances>> {
  const client = createGraiEvmPublicClient(config)
  const graiAddress = resolveGraiContractAddress(config)
  const assets = await client.readContract({
    address: graiAddress,
    abi: graiAbi,
    functionName: 'getAssets',
  })

  const grindersAddress = await client.readContract({
    address: graiAddress,
    abi: graiAbi,
    functionName: 'grinders',
  })

  const entries = await Promise.all(
    assets.map(async (assetAddress) => {
      const asset = assetAddress.toLowerCase()
      const decimals = await readAssetDecimals(config, assetAddress)
      const seniorBalance = await readGraiAssetBalance(config, graiAddress, assetAddress)

      let allocatedRaw = 0n
      if (grindersAddress && grindersAddress !== zeroAddress) {
        try {
          allocatedRaw = await client.readContract({
            address: grindersAddress,
            abi: grindersAbi,
            functionName: 'balance',
            args: [assetAddress],
          })
        } catch {
          allocatedRaw = 0n
        }
      }

      let seniorUsdRaw = 0n
      let allocatedUsdRaw = 0n
      try {
        const oracle = await readAssetPrice(config, assetAddress)
        seniorUsdRaw = depositValue(seniorBalance, decimals, oracle.price, oracle.decimals, USD_SCALE_EVM)
        allocatedUsdRaw = depositValue(allocatedRaw, decimals, oracle.price, oracle.decimals, USD_SCALE_EVM)
      } catch {
        // Price feed unavailable — USD columns stay zero.
      }

      return [
        asset,
        {
          seniorRaw: seniorBalance,
          juniorRaw: 0n,
          allocatedRaw,
          decimals,
          navUsdRaw: seniorUsdRaw + allocatedUsdRaw,
          seniorUsdRaw,
          juniorUsdRaw: 0n,
          allocatedUsdRaw,
        },
      ] as const
    }),
  )

  return Object.fromEntries(entries)
}

export class GraiLiquidationRequiredError extends Error {
  constructor(message = 'liquidation event should be reached') {
    super(message)
    this.name = 'GraiLiquidationRequiredError'
  }
}

function isLikelyLiquidationClosedRevert(error: unknown): boolean {
  const text =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === 'string'
        ? error
        : String(error ?? '')
  const lower = text.toLowerCase()
  return (
    lower.includes('liquidationclosed') ||
    lower.includes('liquidation closed') ||
    lower.includes('execution reverted') ||
    lower.includes('reverted')
  )
}

/** Basket snapshot from `getRedeemables` — reverts while liquidation is closed. */
export async function fetchEvmGraiRedeemables(
  config: GraiEvmConfig,
): Promise<Record<string, GraiAssetVaultBalances>> {
  const client = createGraiEvmPublicClient(config)
  const graiAddress = resolveGraiContractAddress(config)

  let assetOuts: readonly `0x${string}`[]
  let amounts: readonly bigint[]
  try {
    ;[assetOuts, amounts] = await client.readContract({
      address: graiAddress,
      abi: graiAbi,
      functionName: 'getRedeemables',
    })
  } catch (error) {
    if (isLikelyLiquidationClosedRevert(error)) {
      throw new GraiLiquidationRequiredError()
    }
    throw error
  }

  const entries = await Promise.all(
    assetOuts.map(async (assetAddress, index) => {
      const asset = assetAddress.toLowerCase()
      const amount = amounts[index] ?? 0n
      const decimals = await readAssetDecimals(config, assetAddress)
      let seniorUsdRaw = 0n
      try {
        const oracle = await readAssetPrice(config, assetAddress)
        seniorUsdRaw = depositValue(amount, decimals, oracle.price, oracle.decimals, USD_SCALE_EVM)
      } catch {
        // Price feed unavailable — USD stays zero.
      }

      return [
        asset,
        {
          seniorRaw: amount,
          juniorRaw: 0n,
          allocatedRaw: 0n,
          decimals,
          navUsdRaw: seniorUsdRaw,
          seniorUsdRaw,
          juniorUsdRaw: 0n,
          allocatedUsdRaw: 0n,
        },
      ] as const
    }),
  )

  return Object.fromEntries(entries)
}

export type EvmRedeemUnlockTiming = {
  liquidationOpen: boolean
  liquidationAt: number
  liquidationPeriodSec: number
  /** Unix seconds when redeem becomes allowed; null while liquidation is closed. */
  redeemUnlockAt: number | null
}

export async function fetchEvmRedeemUnlockTiming(
  config: GraiEvmConfig,
): Promise<EvmRedeemUnlockTiming> {
  const client = createGraiEvmPublicClient(config)
  const graiAddress = resolveGraiContractAddress(config)
  const [liquidationOpen, liquidationAtRaw, protocolConfig] = await Promise.all([
    client.readContract({ address: graiAddress, abi: graiAbi, functionName: 'liquidation' }),
    client.readContract({ address: graiAddress, abi: graiAbi, functionName: 'liquidationAt' }),
    client.readContract({ address: graiAddress, abi: graiAbi, functionName: 'config' }),
  ])

  const liquidationAt = Number(liquidationAtRaw)
  // config: dividend, treasury, revenueShare, claimTip, bribePremium, quorum, unlockPenalty, liquidationPeriod, redeemPeriod
  const liquidationPeriodSec = Number(protocolConfig[7])
  const redeemUnlockAt =
    liquidationOpen && liquidationAt > 0 ? liquidationAt + liquidationPeriodSec : null

  return {
    liquidationOpen,
    liquidationAt,
    liquidationPeriodSec,
    redeemUnlockAt,
  }
}

export async function fetchEvmWalletAssetBalance(
  config: GraiEvmConfig,
  owner: `0x${string}`,
  asset: string,
): Promise<{ raw: bigint; maxRaw: bigint; decimals: number }> {
  const client = createGraiEvmPublicClient(config)
  const graiAddress = resolveGraiContractAddress(config)
  const normalizedAsset = asset.toLowerCase()

  if (normalizedAsset === graiAddress.toLowerCase()) {
    const [raw, decimals] = await Promise.all([
      client.readContract({
        address: graiAddress,
        abi: graiAbi,
        functionName: 'balanceOf',
        args: [owner],
      }),
      client.readContract({
        address: graiAddress,
        abi: graiAbi,
        functionName: 'decimals',
      }),
    ])
    const dec = Number(decimals)
    return { raw, maxRaw: raw, decimals: dec }
  }

  if (isNativeEvmAsset(normalizedAsset)) {
    const raw = await client.getBalance({ address: owner })
    const gasReserve = 500_000_000_000_000n
    const maxRaw = raw > gasReserve ? raw - gasReserve : 0n
    return { raw, maxRaw, decimals: 18 }
  }

  const assetAddress = normalizedAsset as `0x${string}`
  const [raw, decimals] = await Promise.all([
    client.readContract({
      address: assetAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [owner],
    }),
    client.readContract({
      address: assetAddress,
      abi: erc20Abi,
      functionName: 'decimals',
    }),
  ])
  const dec = Number(decimals)
  return { raw, maxRaw: raw, decimals: dec }
}

export type EvmVoterEntry = {
  address: `0x${string}`
  escrowGrai: bigint
}

export type EvmLiquidationVoteState = {
  graiDecimals: number
  walletGrai: bigint
  votedGrai: bigint
  lockedGrai: bigint
  totalVoted: bigint
  totalSupply: bigint
  totalValue: bigint
  hasQuorum: boolean
  /** Grinders operational heartbeat is still active (`grinders.grinding()`). */
  grinding: boolean
  liquidationOpen: boolean
  /** Default bribe payment asset (first bribeable listed asset). */
  settlementAsset: `0x${string}`
  settlementDecimals: number
  settlementSymbol: string
  bribePremiumBps: number
  liquidationQuorumBps: number
  voters: `0x${string}`[]
  voterEntries: EvmVoterEntry[]
  listedAssets: EvmListedAsset[]
}

export async function fetchEvmLiquidationVoteState(
  config: GraiEvmConfig,
  owner: `0x${string}` | null,
): Promise<EvmLiquidationVoteState> {
  const client = createGraiEvmPublicClient(config)
  const graiAddress = resolveGraiContractAddress(config)

  const [
    graiDecimalsRaw,
    totalVoted,
    totalSupply,
    totalValue,
    hasQuorum,
    liquidationOpen,
    protocolConfig,
    voterEscrows,
    listedAssets,
    walletGrai,
    escrowEntry,
    grindersAddress,
  ] = await Promise.all([
    client.readContract({ address: graiAddress, abi: graiAbi, functionName: 'decimals' }),
    client.readContract({ address: graiAddress, abi: graiAbi, functionName: 'totalVoted' }),
    client.readContract({ address: graiAddress, abi: graiAbi, functionName: 'totalSupply' }),
    client.readContract({ address: graiAddress, abi: graiAbi, functionName: 'totalValue' }),
    client.readContract({ address: graiAddress, abi: graiAbi, functionName: 'hasQuorum' }),
    client.readContract({ address: graiAddress, abi: graiAbi, functionName: 'liquidation' }),
    client.readContract({ address: graiAddress, abi: graiAbi, functionName: 'config' }),
    client.readContract({
      address: graiAddress,
      abi: graiAbi,
      functionName: 'getEscrows',
      args: [true, 0n, 2n ** 256n - 1n],
    }),
    fetchEvmListedAssets(config),
    owner
      ? client.readContract({
          address: graiAddress,
          abi: graiAbi,
          functionName: 'balanceOf',
          args: [owner],
        })
      : Promise.resolve(0n),
    owner
      ? client.readContract({
          address: graiAddress,
          abi: graiAbi,
          functionName: 'escrows',
          args: [owner],
        })
      : Promise.resolve([
          '0x0000000000000000000000000000000000000000',
          0,
          0n,
          0n,
          0,
          0,
        ] as const),
    client.readContract({ address: graiAddress, abi: graiAbi, functionName: 'grinders' }),
  ])

  let grinding = true
  if (grindersAddress && grindersAddress !== zeroAddress) {
    try {
      grinding = await client.readContract({
        address: grindersAddress,
        abi: grindersAbi,
        functionName: 'grinding',
      })
    } catch {
      grinding = true
    }
  }

  const bribePayment =
    listedAssets.find((asset) => asset.bribeable)?.address ?? zeroAddress
  const settlementDecimals =
    bribePayment === zeroAddress ? 18 : await readAssetDecimals(config, bribePayment)
  const settlementMeta = resolveEvmGraiAsset(bribePayment)
  const voterEntries = voterEscrows.map((escrow) => ({
    address: escrow.account,
    escrowGrai: escrow.voted,
  }))

  return {
    graiDecimals: Number(graiDecimalsRaw),
    walletGrai,
    lockedGrai: escrowEntry[2],
    votedGrai: escrowEntry[3],
    totalVoted,
    totalSupply,
    totalValue,
    hasQuorum,
    grinding,
    liquidationOpen,
    settlementAsset: bribePayment,
    settlementDecimals,
    settlementSymbol: settlementMeta.symbol,
    bribePremiumBps: Number(protocolConfig[4]),
    liquidationQuorumBps: Number(protocolConfig[5]),
    voters: voterEscrows.map((escrow) => escrow.account),
    voterEntries,
    listedAssets,
  }
}

export type EvmLockerEntry = {
  address: string
  lockedGrai: bigint
}

/** Active GRAI lockers (`getEscrows(false, …)`) with non-zero escrow. */
export async function fetchEvmLockers(config: GraiEvmConfig): Promise<EvmLockerEntry[]> {
  const client = createGraiEvmPublicClient(config)
  const graiAddress = resolveGraiContractAddress(config)
  const escrows = await client.readContract({
    address: graiAddress,
    abi: graiAbi,
    functionName: 'getEscrows',
    args: [false, 0n, 2n ** 256n - 1n],
  })
  return escrows
    .filter((escrow) => escrow.locked > 0n && escrow.account !== zeroAddress)
    .map((escrow) => ({
      address: escrow.account,
      lockedGrai: escrow.locked,
    }))
}

export async function previewEvmBribe(
  config: GraiEvmConfig,
  voter: `0x${string}`,
  graiAmount: bigint,
  asset?: `0x${string}`,
): Promise<{ bribeAmount: bigint; premium: bigint; discount: bigint }> {
  if (graiAmount <= 0n) return { bribeAmount: 0n, premium: 0n, discount: 0n }
  const client = createGraiEvmPublicClient(config)
  const graiAddress = resolveGraiContractAddress(config)
  const paymentAsset = asset ?? (await resolveEvmBribePaymentAsset(config))
  if (paymentAsset === zeroAddress) {
    throw new Error('No bribeable asset configured on GRAI')
  }
  const [bribeAmount, premium, discount] = await client.readContract({
    address: graiAddress,
    abi: graiAbi,
    functionName: 'previewBribe',
    args: [paymentAsset, voter, graiAmount],
  })
  return { bribeAmount, premium, discount }
}

export { GRAI_DECIMALS_EVM }
