import { Connection } from '@solana/web3.js'
import type { GraiEvmConfig, GraiSolanaRuntime } from './deployments'
import { fetchGraiProtocol } from './fetchGraiProtocol'
import { fetchAccountsByKey } from './accountBatch'
import { decodeMintDecimals } from './onchain'
import { resolveGraiAsset } from './knownMints'
import { assetConfigPda } from './pdas'
import { graiAbi } from './evm/abi'
import { createGraiEvmPublicClient, resolveGraiContractAddress } from './evm/client'
import { isNativeEvmAsset, resolveEvmGraiAsset } from './evm/knownAssets'
import { erc20Abi } from 'viem'

export type GraiBuybackAuction = {
  address: string
  symbol: string
  icon: string
  decimals: number
  /** Auction remaining (asset units). */
  available: bigint
  /** Auction initial lot size (asset units). */
  initial: bigint
  maxPaymentGrai: bigint
  minPaymentGrai: bigint
  /** Unix seconds; 0 means no open auction. */
  startTime: number
  period: number
  listingPrice: bigint
  listingPriceDecimals: number
}

const ACCOUNT_DISCRIMINATOR_LEN = 8

const EMPTY_AUCTION = {
  remaining: 0n,
  initial: 0n,
  maxPayment: 0n,
  minPayment: 0n,
  startTime: 0,
  period: 0,
  listingPrice: 0n,
  listingPriceDecimals: 0,
} as const

function readU128LE(buf: Buffer, offset: number): bigint {
  let value = 0n
  for (let i = 0; i < 16; i += 1) {
    value |= BigInt(buf[offset + i]!) << BigInt(i * 8)
  }
  return value
}

/**
 * AssetConfig body (after 8-byte discriminator):
 * mint(32) feed(32) paused(1) id(4) acc_share(16) total_claimable(8)
 * remaining(8) initial(8) max(8) min(8) start(8) duration(4)
 * listing_price(16) listing_decimals(1) bump(1)
 */
export function decodeAssetConfigAuction(data: Buffer): {
  startTime: number
  period: number
  remaining: bigint
  initial: bigint
  maxPayment: bigint
  minPayment: bigint
  listingPrice: bigint
  listingPriceDecimals: number
} | null {
  if (data.length < ACCOUNT_DISCRIMINATOR_LEN + 155) return null
  const body = data.subarray(ACCOUNT_DISCRIMINATOR_LEN)
  const startTime = Number(body.readBigInt64LE(125))
  return {
    remaining: body.readBigUInt64LE(93),
    initial: body.readBigUInt64LE(101),
    maxPayment: body.readBigUInt64LE(109),
    minPayment: body.readBigUInt64LE(117),
    startTime,
    period: body.readUInt32LE(133),
    listingPrice: readU128LE(body, 137),
    listingPriceDecimals: body.readUInt8(153),
  }
}

async function readEvmAssetDecimals(
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

export async function fetchEvmBuybackAuctions(
  config: GraiEvmConfig,
): Promise<GraiBuybackAuction[]> {
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
      const decimals = await readEvmAssetDecimals(config, address)
      return {
        address,
        symbol: meta.symbol,
        icon: meta.icon.src,
        decimals,
        available: BigInt(entry.remaining),
        initial: BigInt(entry.initial),
        maxPaymentGrai: BigInt(entry.maxPayment),
        minPaymentGrai: BigInt(entry.minPayment),
        startTime: Number(entry.startTime),
        period: Number(entry.period),
        listingPrice: BigInt(entry.listingPrice),
        listingPriceDecimals: Number(entry.listingPriceDecimals),
      }
    }),
  )
}

export async function fetchSolanaBuybackAuctions(
  connection: Connection,
  config: GraiSolanaRuntime,
): Promise<GraiBuybackAuction[]> {
  const protocol = await fetchGraiProtocol(connection, config.graiMint)
  const { programId, assetMints } = protocol
  if (assetMints.length === 0) return []

  const configKeys = assetMints.map((mint) => assetConfigPda(mint, programId))
  const accounts = await fetchAccountsByKey(connection, [...configKeys, ...assetMints])

  const auctions: GraiBuybackAuction[] = []
  for (let i = 0; i < assetMints.length; i += 1) {
    const mint = assetMints[i]!
    const configAccount = accounts.get(configKeys[i]!.toBase58())
    if (!configAccount?.data) continue
    const auction = decodeAssetConfigAuction(Buffer.from(configAccount.data)) ?? EMPTY_AUCTION

    const mintAccount = accounts.get(mint.toBase58())
    const decimals = mintAccount?.data
      ? decodeMintDecimals(Buffer.from(mintAccount.data))
      : 9
    const meta = resolveGraiAsset(mint.toBase58())
    auctions.push({
      address: mint.toBase58(),
      symbol: meta.symbol,
      icon: meta.icon.src,
      decimals,
      available: auction.remaining,
      initial: auction.initial,
      maxPaymentGrai: auction.maxPayment,
      minPaymentGrai: auction.minPayment,
      startTime: auction.startTime,
      period: auction.period,
      listingPrice: auction.listingPrice,
      listingPriceDecimals: auction.listingPriceDecimals,
    })
  }
  return auctions
}
