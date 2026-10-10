import { Connection, PublicKey, type Commitment } from '@solana/web3.js'
import { fetchAccountsByKey, getAccountData } from './accountBatch'
import { assetConfigPda, getAssociatedTokenAddress } from './pdas'

/**
 * AssetConfig layout after 8-byte Anchor discriminator:
 * asset_mint(32) price_feed(32) paused(1) bribeable(1) id(4)
 * acc_share(16) total_claimable(8) bump(1) pyth_feed_id(32)
 */
export const ASSET_CONFIG_PRICE_FEED_OFFSET = 40
/** `paused(1)` at 72, `bribeable(1)` at 73 (absolute, with discriminator). */
export const ASSET_CONFIG_BRIBEABLE_OFFSET = 73
export const ASSET_CONFIG_ACC_SHARE_OFFSET = 78
export const ASSET_CONFIG_TOTAL_CLAIMABLE_OFFSET = 94

export function decodeAssetConfigPriceFeed(data: Buffer): PublicKey {
  return new PublicKey(
    data.subarray(ASSET_CONFIG_PRICE_FEED_OFFSET, ASSET_CONFIG_PRICE_FEED_OFFSET + 32),
  )
}

export function decodeAssetConfigBribeable(data: Buffer): boolean {
  if (data.length <= ASSET_CONFIG_BRIBEABLE_OFFSET) return false
  return data[ASSET_CONFIG_BRIBEABLE_OFFSET] !== 0
}

/** First listed mint with `AssetConfig.bribeable`, or `Pubkey::default` if none. */
export async function resolveFirstBribeableMint(
  connection: Connection,
  programId: PublicKey,
  assetMints: PublicKey[],
): Promise<PublicKey> {
  if (assetMints.length === 0) return PublicKey.default
  const configKeys = assetMints.map((mint) => assetConfigPda(mint, programId))
  const configAccounts = await fetchAccountsByKey(connection, configKeys)
  for (let i = 0; i < assetMints.length; i += 1) {
    const configData = getAccountData(configAccounts, configKeys[i]!)
    if (configData && decodeAssetConfigBribeable(configData)) {
      return assetMints[i]!
    }
  }
  return PublicKey.default
}

export function decodeAssetConfigAccShare(data: Buffer): bigint {
  if (data.length < ASSET_CONFIG_ACC_SHARE_OFFSET + 16) return 0n
  let value = 0n
  for (let i = 0; i < 16; i += 1) {
    value |= BigInt(data[ASSET_CONFIG_ACC_SHARE_OFFSET + i]!) << BigInt(i * 8)
  }
  return value
}

export function decodeAssetConfigTotalClaimable(data: Buffer): bigint {
  if (data.length < ASSET_CONFIG_TOTAL_CLAIMABLE_OFFSET + 8) return 0n
  return data.readBigUInt64LE(ASSET_CONFIG_TOTAL_CLAIMABLE_OFFSET)
}

export async function fetchAssetConfigPriceFeed(
  connection: Connection,
  assetConfig: PublicKey,
): Promise<PublicKey> {
  const account = await connection.getAccountInfo(assetConfig)
  if (!account?.data) {
    throw new Error('Asset config account not found for this asset')
  }
  return decodeAssetConfigPriceFeed(Buffer.from(account.data))
}

/** SPL mint account: mint_authority COption<Pubkey> at offset 0. */
export function decodeMintAuthority(data: Buffer): PublicKey | null {
  if (data.length < 36) return null
  const tag = data.readUInt32LE(0)
  if (tag !== 1) return null
  return new PublicKey(data.subarray(4, 36))
}

/** SPL mint account: supply at offset 36 (u64 LE). */
export function decodeMintSupply(data: Buffer): bigint {
  return data.readBigUInt64LE(36)
}

/** SPL mint account: decimals at offset 44. */
export function decodeMintDecimals(data: Buffer): number {
  return data.readUInt8(44)
}

const mintDecimalsCache = new Map<string, number>()

export async function fetchMintDecimals(connection: Connection, mint: PublicKey): Promise<number> {
  const cacheKey = mint.toBase58()
  const cached = mintDecimalsCache.get(cacheKey)
  if (cached !== undefined) return cached
  const account = await connection.getAccountInfo(mint)
  if (!account?.data) {
    throw new Error('Asset mint account not found')
  }
  const decimals = decodeMintDecimals(Buffer.from(account.data))
  mintDecimalsCache.set(cacheKey, decimals)
  return decimals
}

export function parseTokenAmount(input: string, decimals: number): bigint {
  const trimmed = input.trim()
  if (!trimmed || trimmed === '.') {
    throw new Error('Enter an amount to mint')
  }

  const [wholePart, fractionPart = ''] = trimmed.split('.')
  const whole = wholePart.replace(/^0+(?=\d)/, '') || '0'
  const fraction = fractionPart.padEnd(decimals, '0').slice(0, decimals)
  const raw = `${whole}${fraction}`.replace(/^0+(?=\d)/, '') || '0'
  const amount = BigInt(raw)

  if (amount <= 0n) {
    throw new Error('Amount must be greater than zero')
  }

  return amount
}

const SOL_FEE_RESERVE_LAMPORTS = 10_000_000n

export function normalizeDecimalInput(value: string, decimals: number): string {
  const sanitized = value.replace(/[^\d.]/g, '')
  const [intPart, fractionPart] = sanitized.split('.')
  if (fractionPart === undefined) return intPart
  if (decimals <= 0) return intPart
  return `${intPart}.${fractionPart.slice(0, decimals)}`
}

export function formatTokenBalance(raw: bigint, decimals: number, maxFractionDigits = decimals): string {
  if (raw <= 0n) return '0'

  const divisor = 10n ** BigInt(decimals)
  const whole = raw / divisor
  const fraction = raw % divisor
  let fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '')

  if (fractionStr.length > maxFractionDigits) {
    fractionStr = fractionStr.slice(0, maxFractionDigits).replace(/0+$/, '')
  }

  return fractionStr ? `${whole}.${fractionStr}` : whole.toString()
}

export type WalletAssetBalance = {
  /** Full wallet balance for display. */
  raw: bigint
  /** Safe amount for MAX (SOL reserves fee buffer). */
  maxRaw: bigint
  decimals: number
}

export async function fetchWalletAssetBalance(
  connection: Connection,
  owner: PublicKey,
  assetMint: PublicKey,
  isNativeSol: boolean,
): Promise<WalletAssetBalance> {
  if (isNativeSol) {
    const lamports = BigInt(await connection.getBalance(owner))
    const maxRaw = lamports > SOL_FEE_RESERVE_LAMPORTS ? lamports - SOL_FEE_RESERVE_LAMPORTS : 0n
    return { raw: lamports, maxRaw, decimals: 9 }
  }

  const ata = getAssociatedTokenAddress(assetMint, owner)
  try {
    const balance = await connection.getTokenAccountBalance(ata)
    const raw = BigInt(balance.value.amount)
    return { raw, maxRaw: raw, decimals: balance.value.decimals }
  } catch {
    const decimals = await fetchMintDecimals(connection, assetMint)
    return { raw: 0n, maxRaw: 0n, decimals }
  }
}

const SIGNATURE_CONFIRM_TIMEOUT_MS = 60_000
const SIGNATURE_CONFIRM_POLL_MS = 1_000

function isSignatureConfirmed(status: string | null | undefined, commitment: Commitment): boolean {
  if (!status) return false
  if (commitment === 'processed') {
    return status === 'processed' || status === 'confirmed' || status === 'finalized'
  }
  if (commitment === 'confirmed') {
    return status === 'confirmed' || status === 'finalized'
  }
  return status === 'finalized'
}

/** Poll RPC over HTTP — avoids WebSocket (broken for the local /solana-devnet-rpc Vite proxy). */
export async function confirmSignatureViaHttp(
  connection: Connection,
  signature: string,
  commitment: Commitment = 'confirmed',
  timeoutMs = SIGNATURE_CONFIRM_TIMEOUT_MS,
): Promise<void> {
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    const { value } = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: false,
    })
    const status = value[0]

    if (status?.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`)
    }

    if (isSignatureConfirmed(status?.confirmationStatus ?? null, commitment)) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, SIGNATURE_CONFIRM_POLL_MS))
  }

  throw new Error('Transaction confirmation timed out')
}
