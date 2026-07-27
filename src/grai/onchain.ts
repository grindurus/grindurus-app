import { Connection, PublicKey, type Commitment } from '@solana/web3.js'
import { getAssociatedTokenAddress } from './pdas'

/**
 * AssetConfig layout after 8-byte discriminator:
 * asset_mint(32) price_feed(32) paused(1) id(4) auction… bump(1)
 */
export function decodeAssetConfigPriceFeed(data: Buffer): PublicKey {
  return new PublicKey(data.subarray(40, 72))
}

export function decodeAssetConfigPaused(data: Buffer): boolean {
  return data[72] === 1
}

/** @deprecated Senior vaults removed — use `decodeAssetConfigPriceFeed`. */
export function decodeSeniorVaultPriceFeed(data: Buffer): PublicKey {
  return decodeAssetConfigPriceFeed(data)
}

/** @deprecated */
export function decodeSeniorVaultTotalValue(_data: Buffer): bigint {
  return 0n
}

/** @deprecated */
export function decodeSeniorVaultMintSplit(_data: Buffer): number {
  return 0
}

/** @deprecated */
export function decodeSeniorVaultYieldSplit(_data: Buffer): number {
  return 0
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

/** @deprecated Prefer `fetchAssetConfigPriceFeed`. */
export async function fetchSeniorVaultPriceFeed(
  connection: Connection,
  seniorVault: PublicKey,
): Promise<PublicKey> {
  return fetchAssetConfigPriceFeed(connection, seniorVault)
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

export async function fetchMintDecimals(connection: Connection, mint: PublicKey): Promise<number> {
  const account = await connection.getAccountInfo(mint)
  if (!account?.data) {
    throw new Error('Asset mint account not found')
  }
  return decodeMintDecimals(Buffer.from(account.data))
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

  const decimals = await fetchMintDecimals(connection, assetMint)
  const ata = getAssociatedTokenAddress(assetMint, owner)

  try {
    const balance = await connection.getTokenAccountBalance(ata)
    const raw = BigInt(balance.value.amount)
    return { raw, maxRaw: raw, decimals: balance.value.decimals }
  } catch {
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
