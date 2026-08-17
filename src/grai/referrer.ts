import { PublicKey } from '@solana/web3.js'
import { isAddress, zeroAddress } from 'viem'

export const GRAI_REFERRER_STORAGE_KEY = 'grindurus.grai.referrer'

export type GraiReferrerChain = 'evm' | 'solana'

export function isValidGraiReferrer(value: string, chain: GraiReferrerChain): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (chain === 'evm') return isAddress(trimmed)
  try {
    // Throws on invalid base58 / wrong length.
    void new PublicKey(trimmed)
    return true
  } catch {
    return false
  }
}

/** Strict address check for the active chain — only values safe to treat as a referrer. */
export function normalizeGraiReferrerInput(
  value: string | null | undefined,
  chain: GraiReferrerChain = 'evm',
): string {
  const trimmed = value?.trim() ?? ''
  if (!trimmed || !isValidGraiReferrer(trimmed, chain)) return ''
  return trimmed
}

/** Address to pass to EVM `deposit`; empty/invalid → zero (self-bind). */
export function resolveGraiReferrerForDeposit(value: string | null | undefined): `0x${string}` {
  const normalized = normalizeGraiReferrerInput(value, 'evm')
  return (normalized || zeroAddress) as `0x${string}`
}

export function readStoredGraiReferrer(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(GRAI_REFERRER_STORAGE_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function writeStoredGraiReferrer(value: string): void {
  if (typeof window === 'undefined') return
  const trimmed = value.trim()
  try {
    if (!trimmed) {
      window.localStorage.removeItem(GRAI_REFERRER_STORAGE_KEY)
      return
    }
    window.localStorage.setItem(GRAI_REFERRER_STORAGE_KEY, trimmed)
  } catch {
    // ignore quota / private mode
  }
}

function readRefQueryParam(): string {
  if (typeof window === 'undefined') return ''
  try {
    return new URLSearchParams(window.location.search).get('ref')?.trim() ?? ''
  } catch {
    return ''
  }
}

/**
 * Prefer `?ref=` from the URL (shown as-is so short/test values still fill the input),
 * then fall back to localStorage. Persists the URL value when present.
 */
export function readInitialGraiReferrer(): string {
  const fromUrl = readRefQueryParam()
  if (fromUrl) {
    writeStoredGraiReferrer(fromUrl)
    return fromUrl
  }
  return readStoredGraiReferrer()
}
