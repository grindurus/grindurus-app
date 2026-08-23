import { PublicKey } from '@solana/web3.js'
import { getAddress, isAddress, pad, type Hex } from 'viem'

function bytesToHex(bytes: Uint8Array): Hex {
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}` as Hex
}

export function evmAddressToBytes32(address: string): Hex {
  return pad(getAddress(address) as Hex, { size: 32 })
}

export const ZERO_BYTES32 = evmAddressToBytes32('0x0000000000000000000000000000000000000000')

export function parseSaleAsset(input: string): Hex {
  const trimmed = input.trim()
  const upper = trimmed.toUpperCase()
  if (
    !trimmed ||
    upper === 'ETH' ||
    upper === 'SOL' ||
    trimmed === '0' ||
    /^0x0+$/i.test(trimmed)
  ) {
    return ZERO_BYTES32
  }
  // Solana mint / pubkey as bytes32 (spoke sales priced in SPL / SOL).
  if (isSolanaBase58Address(trimmed)) {
    return bytesToHex(new PublicKey(trimmed).toBytes())
  }
  if (!isAddress(trimmed)) {
    throw new Error('Enter ETH, SOL, USDC, an ERC-20 address, or a Solana mint')
  }
  return evmAddressToBytes32(trimmed)
}


export function isSolanaBase58Address(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || trimmed.startsWith('0x')) return false
  try {
    const key = new PublicKey(trimmed)
    return key.toBase58() === trimmed
  } catch {
    return false
  }
}

export function validateBridgeRecipient(
  input: string,
  destIsSolana: boolean,
  destName?: string,
): { ok: true } | { ok: false; message: string } {
  const trimmed = input.trim()
  const chain = destName ?? (destIsSolana ? 'Solana' : 'this chain')

  if (!trimmed) {
    return {
      ok: false,
      message: destIsSolana ? 'Enter a Solana address' : 'Enter an EVM address',
    }
  }

  if (destIsSolana) {
    if (isAddress(trimmed)) {
      return { ok: false, message: `${chain} cannot receive an EVM 0x address` }
    }
    if (!isSolanaBase58Address(trimmed)) {
      return { ok: false, message: `Enter a valid Solana address for ${chain}` }
    }
    return { ok: true }
  }

  if (isSolanaBase58Address(trimmed)) {
    return { ok: false, message: `${chain} cannot receive a Solana address` }
  }
  if (!isAddress(trimmed)) {
    return { ok: false, message: `Enter a valid EVM address for ${chain}` }
  }
  return { ok: true }
}

export function parseBridgeRecipient(input: string, destIsSolana: boolean, destName?: string): Hex {
  const check = validateBridgeRecipient(input, destIsSolana, destName)
  if (!check.ok) throw new Error(check.message)

  const trimmed = input.trim()
  if (destIsSolana) return bytesToHex(new PublicKey(trimmed).toBytes())
  return evmAddressToBytes32(trimmed)
}
