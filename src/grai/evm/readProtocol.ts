import { erc20Abi } from 'viem'
import type { GraiEvmConfig } from '../deployments'
import type { GraiAsset } from '../knownMints'
import { formatTokenBalance } from '../onchain'
import type { GraiAssetVaultBalances } from '../fetchVaultBalances'
import { depositValue } from '../tokenomics'
import { graiAbi, priceOracleAbi } from './abi'
import { createGraiEvmPublicClient, resolveGraiContractAddress } from './client'
import { GRAI_DECIMALS_EVM, USD_SCALE_EVM } from './constants'
import { isNativeEvmAsset, resolveEvmGraiAsset } from './knownAssets'

export async function fetchEvmGraiAssets(config: GraiEvmConfig): Promise<GraiAsset[]> {
  const client = createGraiEvmPublicClient(config)
  const graiAddress = resolveGraiContractAddress(config)
  const entries = await client.readContract({
    address: graiAddress,
    abi: graiAbi,
    functionName: 'getAssets',
  })

  return entries.map((entry) => resolveEvmGraiAsset(entry.asset))
}

export type EvmListedAsset = {
  address: `0x${string}`
  symbol: string
  icon: string
  decimals: number
}

async function fetchEvmListedAssets(config: GraiEvmConfig): Promise<EvmListedAsset[]> {
  const client = createGraiEvmPublicClient(config)
  const graiAddress = resolveGraiContractAddress(config)
  const entries = await client.readContract({
    address: graiAddress,
    abi: graiAbi,
    functionName: 'getAssets',
  })

  return Promise.all(
    entries.map(async (entry) => {
      const address = entry.asset
      const meta = resolveEvmGraiAsset(address)
      const decimals = await readAssetDecimals(config, address)
      return {
        address,
        symbol: meta.symbol,
        icon: meta.icon.src,
        decimals,
      }
    }),
  )
}

async function readBribeOrSettlementAsset(
  config: GraiEvmConfig,
  graiAddress: `0x${string}`,
): Promise<`0x${string}`> {
  const client = createGraiEvmPublicClient(config)
  try {
    return await client.readContract({
      address: graiAddress,
      abi: graiAbi,
      functionName: 'bribeAsset',
    })
  } catch {
    return await client.readContract({
      address: graiAddress,
      abi: graiAbi,
      functionName: 'settlementAsset',
    })
  }
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

export async function fetchEvmGraiVaultBalances(
  config: GraiEvmConfig,
): Promise<Record<string, GraiAssetVaultBalances>> {
  const client = createGraiEvmPublicClient(config)
  const graiAddress = resolveGraiContractAddress(config)
  const vaults = await client.readContract({
    address: graiAddress,
    abi: graiAbi,
    functionName: 'getVaultsData',
  })

  const entries = await Promise.all(
    vaults.map(async (vault) => {
      const asset = vault.asset.toLowerCase()
      const decimals = await readAssetDecimals(config, vault.asset)
      let seniorUsdRaw = 0n
      let juniorUsdRaw = 0n
      let allocatedUsdRaw = 0n

      try {
        const oracle = await readAssetPrice(config, vault.asset)
        seniorUsdRaw = depositValue(vault.seniorBalance, decimals, oracle.price, oracle.decimals, USD_SCALE_EVM)
        juniorUsdRaw = depositValue(vault.juniorBalance, decimals, oracle.price, oracle.decimals, USD_SCALE_EVM)
        allocatedUsdRaw = depositValue(vault.activeAmount, decimals, oracle.price, oracle.decimals, USD_SCALE_EVM)
      } catch {
        // Price feed unavailable — USD columns stay zero.
      }

      return [
        asset,
        {
          seniorRaw: vault.seniorBalance,
          juniorRaw: vault.juniorBalance,
          allocatedRaw: vault.activeAmount,
          decimals,
          navUsdRaw: seniorUsdRaw,
          seniorUsdRaw,
          juniorUsdRaw,
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
  confirmed: boolean
  liquidationOpen: boolean
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
    confirmed,
    liquidationOpen,
    settlementAsset,
    protocolConfig,
    voterEscrows,
    listedAssets,
    walletGrai,
    escrowEntry,
  ] = await Promise.all([
    client.readContract({ address: graiAddress, abi: graiAbi, functionName: 'decimals' }),
    client.readContract({ address: graiAddress, abi: graiAbi, functionName: 'totalVoted' }),
    client.readContract({ address: graiAddress, abi: graiAbi, functionName: 'totalSupply' }),
    client.readContract({ address: graiAddress, abi: graiAbi, functionName: 'totalValue' }),
    client.readContract({ address: graiAddress, abi: graiAbi, functionName: 'hasQuorum' }),
    client.readContract({ address: graiAddress, abi: graiAbi, functionName: 'confirmed' }),
    client.readContract({ address: graiAddress, abi: graiAbi, functionName: 'liquidation' }),
    readBribeOrSettlementAsset(config, graiAddress),
    client.readContract({ address: graiAddress, abi: graiAbi, functionName: 'config' }),
    client.readContract({
      address: graiAddress,
      abi: graiAbi,
      functionName: 'getVoters',
      args: [0n, 2n ** 256n - 1n],
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
          0,
        ] as const),
  ])

  const settlementDecimals = await readAssetDecimals(config, settlementAsset)
  const settlementMeta = resolveEvmGraiAsset(settlementAsset)
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
    confirmed,
    liquidationOpen,
    settlementAsset,
    settlementDecimals,
    settlementSymbol: settlementMeta.symbol,
    bribePremiumBps: Number(protocolConfig[3]),
    liquidationQuorumBps: Number(protocolConfig[4]),
    voters: voterEscrows.map((escrow) => escrow.account),
    voterEntries,
    listedAssets,
  }
}

export async function fetchEvmVoterEscrow(
  config: GraiEvmConfig,
  voter: `0x${string}`,
): Promise<bigint> {
  const client = createGraiEvmPublicClient(config)
  const graiAddress = resolveGraiContractAddress(config)
  const entry = await client.readContract({
    address: graiAddress,
    abi: graiAbi,
    functionName: 'escrows',
    args: [voter],
  })
  return entry[3]
}

export async function previewEvmBribe(
  config: GraiEvmConfig,
  voter: `0x${string}`,
  graiAmount: bigint,
): Promise<{ bribeAmount: bigint; premium: bigint; discount: bigint }> {
  if (graiAmount <= 0n) return { bribeAmount: 0n, premium: 0n, discount: 0n }
  const client = createGraiEvmPublicClient(config)
  const graiAddress = resolveGraiContractAddress(config)
  const [bribeAmount, premium, discount] = await client.readContract({
    address: graiAddress,
    abi: graiAbi,
    functionName: 'previewBribe',
    args: [voter, graiAmount],
  })
  return { bribeAmount, premium, discount }
}

export { GRAI_DECIMALS_EVM }
