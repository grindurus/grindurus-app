import { Connection, PublicKey } from '@solana/web3.js'
import { fetchGraiProtocol } from './fetchGraiProtocol'
import { referrerPda } from './pdas'
import type { EvmReferralBookEntry } from './evm/fetchReferralBooks'

function readU128LE(data: Buffer, offset: number): bigint {
  let value = 0n
  for (let i = 0; i < 16; i += 1) {
    value |= BigInt(data[offset + i]!) << BigInt(i * 8)
  }
  return value
}

/** Anchor Referrer account after discriminator. */
export type SolanaReferrerBook = {
  referrer: PublicKey
  nftMint: PublicKey
  value: bigint
  l1Value: bigint
  l2Value: bigint
}

export function decodeSolanaReferrerBook(data: Buffer): SolanaReferrerBook | null {
  // disc(8) + referrer(32) + nft_mint(32) + value(16) + l1(16) + l2(16) + bump(1)
  if (data.length < 8 + 32 + 32 + 16 + 16 + 16 + 1) return null
  return {
    referrer: new PublicKey(data.subarray(8, 40)),
    nftMint: new PublicKey(data.subarray(40, 72)),
    value: readU128LE(data, 72),
    l1Value: readU128LE(data, 88),
    l2Value: readU128LE(data, 104),
  }
}

export async function resolveNftOwner(
  connection: Connection,
  nftMint: PublicKey,
  fallback: PublicKey,
): Promise<PublicKey> {
  if (nftMint.equals(PublicKey.default)) return fallback
  try {
    const largest = await connection.getTokenLargestAccounts(nftMint)
    const holder = largest.value.find((row) => BigInt(row.amount) > 0n)
    if (!holder) return fallback
    const ataInfo = await connection.getParsedAccountInfo(holder.address)
    const parsed = ataInfo.value?.data
    if (parsed && typeof parsed === 'object' && 'parsed' in parsed) {
      const owner = (parsed as { parsed?: { info?: { owner?: string } } }).parsed?.info?.owner
      if (owner) return new PublicKey(owner)
    }
  } catch {
    // Fall through to locker identity.
  }
  return fallback
}

/**
 * Load sticky referral books from `GraiState.referrers` + each locker's Referrer PDA.
 * Shape matches EVM `getLockersData` rows so the tree UI can reuse `buildReferralForest`.
 */
export async function fetchSolanaReferralBooks(
  connection: Connection,
  graiMint: PublicKey,
): Promise<EvmReferralBookEntry[]> {
  const protocol = await fetchGraiProtocol(connection, graiMint, { bypassCache: true })
  const lockers = protocol.referrers
  if (lockers.length === 0) return []

  const bookPdas = lockers.map((locker) => referrerPda(locker, protocol.programId))
  const infos = await connection.getMultipleAccountsInfo(bookPdas)

  const rows: EvmReferralBookEntry[] = []
  for (let i = 0; i < lockers.length; i += 1) {
    const locker = lockers[i]!
    const info = infos[i]
    if (!info?.data) continue
    const book = decodeSolanaReferrerBook(Buffer.from(info.data))
    if (!book) continue

    const owner = await resolveNftOwner(connection, book.nftMint, locker)
    rows.push({
      locker: locker.toBase58() as `0x${string}`,
      referrer: book.referrer.equals(PublicKey.default)
        ? (locker.toBase58() as `0x${string}`)
        : (book.referrer.toBase58() as `0x${string}`),
      owner: owner.toBase58() as `0x${string}`,
      value: book.value,
      l1Value: book.l1Value,
      l2Value: book.l2Value,
    })
  }
  return rows
}

/** Local `preview_poach`: price = value + l1_value, seller = sticky referrer. */
export function previewSolanaPoach(book: SolanaReferrerBook, poacher: PublicKey): {
  price: bigint
  seller: PublicKey
} {
  if (book.referrer.equals(PublicKey.default)) {
    throw new Error('Referral slot is unbound')
  }
  if (book.referrer.equals(poacher)) {
    throw new Error('You already hold this upline seat')
  }
  const price = book.value + book.l1Value
  if (price <= 0n) throw new Error('Poach ask is zero')
  if (price > 0xffff_ffff_ffff_ffffn) throw new Error('Poach price overflow')
  return { price, seller: book.referrer }
}
