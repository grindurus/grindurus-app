import { PublicKey } from '@solana/web3.js'
import { getAddress, isAddress, pad, type Hex } from 'viem'

function bytesToHex(bytes: Uint8Array): Hex {
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}` as Hex
}

export function evmAddressToBytes32(address: string): Hex {
  return pad(getAddress(address) as Hex, { size: 32 })
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
