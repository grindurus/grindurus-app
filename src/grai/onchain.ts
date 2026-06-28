import { Connection, PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddress } from './pdas'

/** Anchor SeniorVault.total_value (USD 9 decimals) at byte 77. */
export function decodeSeniorVaultTotalValue(data: Buffer): bigint {
  let value = 0n
  for (let i = 0; i < 16; i += 1) {
    value |= BigInt(data[77 + i]!) << BigInt(i * 8)
  }
  return value
}

/** Anchor account discriminator + SeniorVault fields; price_feed follows asset_mint. */
export function decodeSeniorVaultPriceFeed(data: Buffer): PublicKey {
  return new PublicKey(data.subarray(40, 72))
}

export async function fetchSeniorVaultPriceFeed(
  connection: Connection,
  seniorVault: PublicKey,
): Promise<PublicKey> {
  const account = await connection.getAccountInfo(seniorVault)
  if (!account?.data) {
    throw new Error('Senior vault account not found for this asset')
  }
  return decodeSeniorVaultPriceFeed(Buffer.from(account.data))
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
