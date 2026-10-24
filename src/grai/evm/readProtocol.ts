import { erc20Abi, zeroAddress, type Abi } from 'viem'
import type { GraiEvmConfig } from '../deployments'
import type { GraiAsset } from '../knownMints'
import { formatTokenBalance } from '../onchain'
import type { GraiAssetVaultBalances } from '../fetchVaultBalances'
import { depositValue } from '../tokenomics'
import { graiAbi, grindersAbi, priceOracleAbi } from './abi'
import { createGraiEvmPublicClient, resolveGraiContractAddress } from './client'
import { GRAI_DECIMALS_EVM, USD_SCALE_EVM } from './constants'
import { isNativeEvmAsset, resolveEvmGraiAsset } from './knownAssets'

type MulticallContract = {
  address: `0x${string}`
  abi: Abi
  functionName: string
  args?: readonly unknown[]
}

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
  if (assets.length === 0) return []

  const contracts: MulticallContract[] = []
  for (const address of assets) {
    if (!isNativeEvmAsset(address)) {
      contracts.push({
        address,
        abi: erc20Abi,
        functionName: 'decimals',
      })
    }
    contracts.push({
      address: graiAddress,
      abi: graiAbi,
      functionName: 'assets',
      args: [address],
    })
  }

  const results = await client.multicall({ contracts, allowFailure: true })
  let cursor = 0
  return assets.map((address) => {
    const meta = resolveEvmGraiAsset(address)
    let decimals = 18
    if (!isNativeEvmAsset(address)) {
      const decResult = results[cursor++]
      if (decResult?.status === 'success') decimals = Number(decResult.result)
    }
    const cfgResult = results[cursor++]
    const bribeable =
      cfgResult?.status === 'success' && Array.isArray(cfgResult.result)
        ? Boolean(cfgResult.result[2])
        : false
    return {
      address,
      symbol: meta.symbol,
      icon: meta.icon.src,
      decimals,
      bribeable,
    }
  })
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
  const [supplyResult, decimalsResult] = await client.multicall({
    contracts: [
      { address: graiAddress, abi: graiAbi, functionName: 'totalSupply' },
      { address: graiAddress, abi: graiAbi, functionName: 'decimals' },
    ],
    allowFailure: false,
  })

  const raw = supplyResult as bigint
  const decimals = Number(decimalsResult)
  return {
    raw,
    decimals,
    label: formatTokenBalance(raw, decimals, 4),
  }
}

/** Idle GRAI balances + Grinders allocations per listed asset (replaces removed `getVaultsData`). */
export async function fetchEvmGraiVaultBalances(
  config: GraiEvmConfig,
): Promise<Record<string, GraiAssetVaultBalances>> {
  const client = createGraiEvmPublicClient(config)
  const graiAddress = resolveGraiContractAddress(config)

  const [assets, grindersAddress] = await client.multicall({
    contracts: [
      { address: graiAddress, abi: graiAbi, functionName: 'getAssets' },
      { address: graiAddress, abi: graiAbi, functionName: 'grinders' },
    ],
    allowFailure: false,
  })

  const assetList = assets as readonly `0x${string}`[]
  const grinders = grindersAddress as `0x${string}`
  const hasGrinders = Boolean(grinders && grinders !== zeroAddress)
  if (assetList.length === 0) return {}

  const contracts: MulticallContract[] = []
  const nativeBalanceIndexes: number[] = []

  for (let i = 0; i < assetList.length; i++) {
    const assetAddress = assetList[i]!
    if (isNativeEvmAsset(assetAddress)) {
      nativeBalanceIndexes.push(i)
    } else {
      contracts.push({
        address: assetAddress,
        abi: erc20Abi,
        functionName: 'decimals',
      })
      contracts.push({
        address: assetAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [graiAddress],
      })
    }
    if (hasGrinders) {
      contracts.push({
        address: grinders,
        abi: grindersAbi,
        functionName: 'balance',
        args: [assetAddress],
      })
    }
    contracts.push({
      address: graiAddress,
      abi: priceOracleAbi,
      functionName: 'getPrice',
      args: [assetAddress],
    })
  }

  const [results, ...nativeBalances] = await Promise.all([
    client.multicall({ contracts, allowFailure: true }),
    ...nativeBalanceIndexes.map(() => client.getBalance({ address: graiAddress })),
  ])

  let cursor = 0
  let nativeCursor = 0
  const entries: Array<readonly [string, GraiAssetVaultBalances]> = []

  for (let i = 0; i < assetList.length; i++) {
    const assetAddress = assetList[i]!
    const asset = assetAddress.toLowerCase()
    let decimals = 18
    let seniorBalance = 0n

    if (isNativeEvmAsset(assetAddress)) {
      seniorBalance = (nativeBalances[nativeCursor++] as bigint) ?? 0n
    } else {
      const decResult = results[cursor++]
      const balResult = results[cursor++]
      if (decResult?.status === 'success') decimals = Number(decResult.result)
      if (balResult?.status === 'success') seniorBalance = balResult.result as bigint
    }

    let allocatedRaw = 0n
    if (hasGrinders) {
      const allocResult = results[cursor++]
      if (allocResult?.status === 'success') allocatedRaw = allocResult.result as bigint
    }

    let seniorUsdRaw = 0n
    let allocatedUsdRaw = 0n
    const priceResult = results[cursor++]
    if (priceResult?.status === 'success' && Array.isArray(priceResult.result)) {
      const price = priceResult.result[0] as bigint
      const priceDecimals = Number(priceResult.result[1])
      seniorUsdRaw = depositValue(seniorBalance, decimals, price, priceDecimals, USD_SCALE_EVM)
      allocatedUsdRaw = depositValue(allocatedRaw, decimals, price, priceDecimals, USD_SCALE_EVM)
    }

    entries.push([
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
    ])
  }

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

  if (assetOuts.length === 0) return {}

  const contracts: MulticallContract[] = []
  for (const assetAddress of assetOuts) {
    if (!isNativeEvmAsset(assetAddress)) {
      contracts.push({
        address: assetAddress,
        abi: erc20Abi,
        functionName: 'decimals',
      })
    }
    contracts.push({
      address: graiAddress,
      abi: priceOracleAbi,
      functionName: 'getPrice',
      args: [assetAddress],
    })
  }

  const results = await client.multicall({ contracts, allowFailure: true })
  let cursor = 0
  const entries: Array<readonly [string, GraiAssetVaultBalances]> = []

  for (let index = 0; index < assetOuts.length; index++) {
    const assetAddress = assetOuts[index]!
    const asset = assetAddress.toLowerCase()
    const amount = amounts[index] ?? 0n
    let decimals = 18
    if (!isNativeEvmAsset(assetAddress)) {
      const decResult = results[cursor++]
      if (decResult?.status === 'success') decimals = Number(decResult.result)
    }
    let seniorUsdRaw = 0n
    const priceResult = results[cursor++]
    if (priceResult?.status === 'success' && Array.isArray(priceResult.result)) {
      const price = priceResult.result[0] as bigint
      const priceDecimals = Number(priceResult.result[1])
      seniorUsdRaw = depositValue(amount, decimals, price, priceDecimals, USD_SCALE_EVM)
    }

    entries.push([
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
    ])
  }

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
  const [liquidationOpen, liquidationAtRaw, protocolConfig] = await client.multicall({
    contracts: [
      { address: graiAddress, abi: graiAbi, functionName: 'liquidation' },
      { address: graiAddress, abi: graiAbi, functionName: 'liquidationAt' },
      { address: graiAddress, abi: graiAbi, functionName: 'config' },
    ],
    allowFailure: false,
  })

  const liquidationAt = Number(liquidationAtRaw)
  // config: dividend, treasury, revenueShare, claimTip, bribePremium, quorum, unlockPenalty, liquidationPeriod, redeemPeriod
  const liquidationPeriodSec = Number((protocolConfig as readonly unknown[])[7])
  const redeemUnlockAt =
    Boolean(liquidationOpen) && liquidationAt > 0 ? liquidationAt + liquidationPeriodSec : null

  return {
    liquidationOpen: Boolean(liquidationOpen),
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
    const [raw, decimals] = await client.multicall({
      contracts: [
        {
          address: graiAddress,
          abi: graiAbi,
          functionName: 'balanceOf',
          args: [owner],
        },
        { address: graiAddress, abi: graiAbi, functionName: 'decimals' },
      ],
      allowFailure: false,
    })
    const dec = Number(decimals)
    return { raw: raw as bigint, maxRaw: raw as bigint, decimals: dec }
  }

  if (isNativeEvmAsset(normalizedAsset)) {
    const raw = await client.getBalance({ address: owner })
    const gasReserve = 500_000_000_000_000n
    const maxRaw = raw > gasReserve ? raw - gasReserve : 0n
    return { raw, maxRaw, decimals: 18 }
  }

  const assetAddress = normalizedAsset as `0x${string}`
  const [raw, decimals] = await client.multicall({
    contracts: [
      {
        address: assetAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [owner],
      },
      {
        address: assetAddress,
        abi: erc20Abi,
        functionName: 'decimals',
      },
    ],
    allowFailure: false,
  })
  const dec = Number(decimals)
  return { raw: raw as bigint, maxRaw: raw as bigint, decimals: dec }
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

  const emptyEscrow = [
    '0x0000000000000000000000000000000000000000',
    0,
    0n,
    0n,
    0,
    0,
  ] as const

  const round1Contracts: MulticallContract[] = [
    { address: graiAddress, abi: graiAbi, functionName: 'decimals' },
    { address: graiAddress, abi: graiAbi, functionName: 'totalVoted' },
    { address: graiAddress, abi: graiAbi, functionName: 'totalSupply' },
    { address: graiAddress, abi: graiAbi, functionName: 'totalValue' },
    { address: graiAddress, abi: graiAbi, functionName: 'hasQuorum' },
    { address: graiAddress, abi: graiAbi, functionName: 'liquidation' },
    { address: graiAddress, abi: graiAbi, functionName: 'config' },
    {
      address: graiAddress,
      abi: graiAbi,
      functionName: 'getEscrows',
      args: [true, 0n, 2n ** 256n - 1n],
    },
    { address: graiAddress, abi: graiAbi, functionName: 'getAssets' },
    { address: graiAddress, abi: graiAbi, functionName: 'grinders' },
  ]
  if (owner) {
    round1Contracts.push(
      {
        address: graiAddress,
        abi: graiAbi,
        functionName: 'balanceOf',
        args: [owner],
      },
      {
        address: graiAddress,
        abi: graiAbi,
        functionName: 'escrows',
        args: [owner],
      },
    )
  }

  const round1 = await client.multicall({ contracts: round1Contracts, allowFailure: true })

  const requireOk = <T,>(index: number, label: string): T => {
    const item = round1[index]
    if (!item || item.status !== 'success') {
      throw new Error(`GRAI ${label} read failed`)
    }
    return item.result as T
  }

  const graiDecimalsRaw = requireOk<bigint>(0, 'decimals')
  const totalVoted = requireOk<bigint>(1, 'totalVoted')
  const totalSupply = requireOk<bigint>(2, 'totalSupply')
  const totalValue = requireOk<bigint>(3, 'totalValue')
  const hasQuorum = requireOk<boolean>(4, 'hasQuorum')
  const liquidationOpen = requireOk<boolean>(5, 'liquidation')
  const protocolConfig = requireOk<readonly unknown[]>(6, 'config')
  const voterEscrows = requireOk<
    readonly { account: `0x${string}`; voted: bigint; locked: bigint }[]
  >(7, 'getEscrows')
  const assets = requireOk<readonly `0x${string}`[]>(8, 'getAssets')
  const grindersAddress = requireOk<`0x${string}`>(9, 'grinders')
  const walletGrai = owner
    ? round1[10]?.status === 'success'
      ? (round1[10].result as bigint)
      : 0n
    : 0n
  const escrowEntry = owner
    ? round1[11]?.status === 'success'
      ? (round1[11].result as typeof emptyEscrow)
      : emptyEscrow
    : emptyEscrow

  const hasGrinders = Boolean(grindersAddress && grindersAddress !== zeroAddress)
  const round2Contracts: MulticallContract[] = []
  if (hasGrinders) {
    round2Contracts.push({
      address: grindersAddress,
      abi: grindersAbi,
      functionName: 'grinding',
    })
  }
  for (const address of assets) {
    if (!isNativeEvmAsset(address)) {
      round2Contracts.push({
        address,
        abi: erc20Abi,
        functionName: 'decimals',
      })
    }
    round2Contracts.push({
      address: graiAddress,
      abi: graiAbi,
      functionName: 'assets',
      args: [address],
    })
  }

  const round2 =
    round2Contracts.length > 0
      ? await client.multicall({ contracts: round2Contracts, allowFailure: true })
      : []

  let r2 = 0
  let grinding = true
  if (hasGrinders) {
    const grindingResult = round2[r2++]
    if (grindingResult?.status === 'success') grinding = Boolean(grindingResult.result)
  }

  const listedAssets: EvmListedAsset[] = assets.map((address) => {
    const meta = resolveEvmGraiAsset(address)
    let decimals = 18
    if (!isNativeEvmAsset(address)) {
      const decResult = round2[r2++]
      if (decResult?.status === 'success') decimals = Number(decResult.result)
    }
    const cfgResult = round2[r2++]
    const bribeable =
      cfgResult?.status === 'success' && Array.isArray(cfgResult.result)
        ? Boolean(cfgResult.result[2])
        : false
    return {
      address,
      symbol: meta.symbol,
      icon: meta.icon.src,
      decimals,
      bribeable,
    }
  })

  const bribePayment =
    listedAssets.find((asset) => asset.bribeable)?.address ?? zeroAddress
  const settlementDecimals =
    bribePayment === zeroAddress
      ? 18
      : listedAssets.find((a) => a.address.toLowerCase() === bribePayment.toLowerCase())
          ?.decimals ?? 18
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
