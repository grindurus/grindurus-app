import { Connection, PublicKey } from '@solana/web3.js'
import { fetchAccountsByKey, getAccountData } from './accountBatch'
import type { GraiSolanaConfig } from './deployments'
import type { EvmClaimEstimate } from './evm/estimateClaim'
import { fetchGraiProtocol } from './fetchGraiProtocol'
import { NATIVE_MINT, resolveGraiAsset } from './knownMints'
import { decodeAssetConfigPriceFeed, decodeMintDecimals, formatTokenBalance } from './onchain'
import { parseOraclePriceFeed } from './oraclePrice'
import { assetConfigPda, escrowPda, positionPda } from './pdas'
import { depositValue } from './tokenomics'

/** Matches on-chain `tokenomics::DIVIDEND_PRECISION` (1e18). */
const DIVIDEND_PRECISION = 1_000_000_000_000_000_000n
const CLAIM_AMOUNT_MAX_FRACTION_DIGITS = 6
const U64_MAX = 0xffff_ffff_ffff_ffffn

/**
 * AssetConfig after discriminator:
 * mint(32) feed(32) paused(1) id(4) acc_share(16) …
 */
function decodeAssetConfigAccShare(data: Buffer): bigint {
  if (data.length < 93) return 0n
  let value = 0n
  for (let i = 0; i < 16; i += 1) {
    value |= BigInt(data[77 + i]!) << BigInt(i * 8)
  }
  return value
}

/** Position after discriminator: debt(u128) claimable(u64) … */
function decodePosition(data: Buffer): { debt: bigint; claimable: bigint } {
  if (data.length < 32) return { debt: 0n, claimable: 0n }
  let debt = 0n
  for (let i = 0; i < 16; i += 1) {
    debt |= BigInt(data[8 + i]!) << BigInt(i * 8)
  }
  return {
    debt,
    claimable: data.readBigUInt64LE(24),
  }
}

/** Escrow after discriminator: amount(u64) voted(u64) … */
function decodeEscrowUnvoted(data: Buffer): bigint {
  if (data.length < 24) return 0n
  const amount = data.readBigUInt64LE(8)
  const voted = data.readBigUInt64LE(16)
  return amount > voted ? amount - voted : 0n
}

/** Mirrors on-chain `tokenomics::pending_dividend`. */
export function pendingSolanaDividend(
  unvoted: bigint,
  accShare: bigint,
  debt: bigint,
  claimable: bigint,
): bigint {
  const accumulated = (unvoted * accShare) / DIVIDEND_PRECISION
  const unrealized = accumulated > debt ? accumulated - debt : 0n
  return claimable + unrealized
}

/** Mirrors on-chain `tokenomics::preview_claim`. */
export function previewSolanaClaim(amount: bigint, pending: bigint): bigint {
  if (amount >= U64_MAX || amount >= pending) return pending
  return amount
}

function formatClaimAmountLabel(amountRaw: bigint, decimals: number): string {
  if (amountRaw <= 0n) return '0.0'
  const label = formatTokenBalance(amountRaw, decimals, CLAIM_AMOUNT_MAX_FRACTION_DIGITS)
  return label.includes('.') ? label : `${label}.0`
}

function emptyClaim(assetMint: PublicKey, decimals = 9): EvmClaimEstimate {
  const asset = resolveGraiAsset(assetMint.toBase58())
  return {
    assetAddress: assetMint.toBase58() as `0x${string}`,
    symbol: asset.symbol,
    icon: asset.icon.src,
    amountRaw: 0n,
    amountLabel: '0.0',
    usdRaw: 0n,
    decimals,
  }
}

/** Pending dividends for one listed asset (`preview_claim(..., u64::MAX)`). */
export async function estimateSolanaClaimAsset(
  connection: Connection,
  config: GraiSolanaConfig,
  holder: PublicKey,
  assetMint: PublicKey,
): Promise<EvmClaimEstimate> {
  const claims = await estimateSolanaClaimAll(connection, config, holder)
  const mintKey = assetMint.toBase58()
  return claims.find((claim) => claim.assetAddress.toLowerCase() === mintKey.toLowerCase()) ?? emptyClaim(assetMint)
}

/** Pending listed-asset dividends (`preview_claim_all`). */
export async function estimateSolanaClaimAll(
  connection: Connection,
  config: GraiSolanaConfig,
  holder: PublicKey,
): Promise<EvmClaimEstimate[]> {
  const protocol = await fetchGraiProtocol(connection, config.graiMint)
  const { programId, assetMints } = protocol
  if (assetMints.length === 0) return []

  const escrow = escrowPda(holder, programId)
  const accountKeys: PublicKey[] = [escrow]
  for (const mint of assetMints) {
    accountKeys.push(assetConfigPda(mint, programId), positionPda(holder, mint, programId))
    if (mint.toBase58() !== NATIVE_MINT) {
      accountKeys.push(mint)
    }
  }

  const accounts = await fetchAccountsByKey(connection, accountKeys)
  const escrowData = getAccountData(accounts, escrow)
  const unvoted = escrowData ? decodeEscrowUnvoted(escrowData) : 0n

  const priceFeedKeys = assetMints.map((mint) => {
    const assetConfigData = getAccountData(accounts, assetConfigPda(mint, programId))
    return assetConfigData ? decodeAssetConfigPriceFeed(assetConfigData) : null
  })
  const uniquePriceFeedKeys = [
    ...new Map(
      priceFeedKeys
        .filter((key): key is PublicKey => key !== null)
        .map((key) => [key.toBase58(), key]),
    ).values(),
  ]
  const priceFeedAccounts =
    uniquePriceFeedKeys.length > 0
      ? await fetchAccountsByKey(connection, uniquePriceFeedKeys)
      : new Map()

  return assetMints.map((mint, index) => {
    const mintKey = mint.toBase58()
    const isNativeSol = mintKey === NATIVE_MINT
    const asset = resolveGraiAsset(mintKey)
    const assetConfigData = getAccountData(accounts, assetConfigPda(mint, programId))
    const positionData = getAccountData(accounts, positionPda(holder, mint, programId))
    const mintData = isNativeSol ? null : getAccountData(accounts, mint)
    const decimals = isNativeSol ? 9 : mintData ? decodeMintDecimals(mintData) : 9

    const accShare = assetConfigData ? decodeAssetConfigAccShare(assetConfigData) : 0n
    const { debt, claimable } = positionData ? decodePosition(positionData) : { debt: 0n, claimable: 0n }
    const amountRaw = previewSolanaClaim(
      U64_MAX,
      pendingSolanaDividend(unvoted, accShare, debt, claimable),
    )

    let usdRaw = 0n
    if (amountRaw > 0n) {
      try {
        const priceFeedKey = priceFeedKeys[index]
        if (priceFeedKey) {
          const priceFeedAccount = priceFeedAccounts.get(priceFeedKey.toBase58())
          if (priceFeedAccount) {
            const oracle = parseOraclePriceFeed(priceFeedAccount)
            usdRaw = depositValue(amountRaw, decimals, oracle.price, oracle.decimals)
          }
        }
      } catch {
        usdRaw = 0n
      }
    }

    return {
      assetAddress: mintKey as `0x${string}`,
      symbol: asset.symbol,
      icon: asset.icon.src,
      amountRaw,
      amountLabel: formatClaimAmountLabel(amountRaw, decimals),
      usdRaw,
      decimals,
    }
  })
}
