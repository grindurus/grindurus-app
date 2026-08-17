import { Connection, PublicKey } from '@solana/web3.js'
import {
  decodeTokenAccountAmount,
  decodeTokenAccountOwner,
  fetchAccountsByKey,
  getAccountData,
} from './accountBatch'
import { fetchGraiProtocol } from './fetchGraiProtocol'
import { getAssociatedTokenAddress, referrerPda } from './pdas'
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

export async function resolveNftOwners(
  connection: Connection,
  nftMints: PublicKey[],
  fallbacks: PublicKey[],
): Promise<PublicKey[]> {
  const owners = fallbacks.map((fallback) => fallback)
  const pending: { index: number; mint: PublicKey }[] = []
  for (let i = 0; i < nftMints.length; i += 1) {
    const mint = nftMints[i]
    if (!mint || mint.equals(PublicKey.default)) continue
    pending.push({ index: i, mint })
  }
  if (pending.length === 0) return owners

  // Canonical locker ATA is where mint put the 1/1. One getMultipleAccounts covers the common case.
  const lockerAtas = pending.map((row) => getAssociatedTokenAddress(row.mint, fallbacks[row.index]!))
  const lockerAtaAccounts = await fetchAccountsByKey(connection, lockerAtas)
  const unresolved: { index: number; mint: PublicKey }[] = []
  for (let i = 0; i < pending.length; i += 1) {
    const row = pending[i]!
    const data = getAccountData(lockerAtaAccounts, lockerAtas[i]!)
    if (data && decodeTokenAccountAmount(data) >= 1n) {
      const owner = decodeTokenAccountOwner(data)
      if (owner) {
        owners[row.index] = owner
        continue
      }
    }
    unresolved.push(row)
  }
  if (unresolved.length === 0) return owners

  const uniqueMints = [...new Map(unresolved.map((row) => [row.mint.toBase58(), row.mint])).values()]
  const largestByMint = new Map<string, string>()
  await Promise.all(
    uniqueMints.map(async (mint) => {
      try {
        const largest = await connection.getTokenLargestAccounts(mint)
        const holder = largest.value.find((row) => BigInt(row.amount) > 0n)
        if (holder) largestByMint.set(mint.toBase58(), holder.address.toString())
      } catch {
        // Fall through to locker identity.
      }
    }),
  )

  const ataKeys: PublicKey[] = []
  const ataPending: number[] = []
  for (const row of unresolved) {
    const ata = largestByMint.get(row.mint.toBase58())
    if (!ata) continue
    ataKeys.push(new PublicKey(ata))
    ataPending.push(row.index)
  }
  if (ataKeys.length === 0) return owners

  const accounts = await fetchAccountsByKey(connection, ataKeys)
  for (let i = 0; i < ataKeys.length; i += 1) {
    const data = getAccountData(accounts, ataKeys[i]!)
    const owner = data ? decodeTokenAccountOwner(data) : null
    if (owner) owners[ataPending[i]!] = owner
  }
  return owners
}

export async function resolveNftOwner(
  connection: Connection,
  nftMint: PublicKey,
  fallback: PublicKey,
): Promise<PublicKey> {
  const [owner] = await resolveNftOwners(connection, [nftMint], [fallback])
  return owner ?? fallback
}

/**
 * Load sticky referral books from `GraiState.referrers` + each locker's Referrer PDA.
 * Shape matches EVM `getLockersData` rows so the tree UI can reuse `buildReferralForest`.
 *
 * Tree edges only need `referrer`. `onPartial` fires after book PDAs (before OTC NFT lookup)
 * so the dashboard can paint without `getTokenLargestAccounts`.
 */
export async function fetchSolanaReferralBooks(
  connection: Connection,
  graiMint: PublicKey,
  options?: { onPartial?: (rows: EvmReferralBookEntry[]) => void },
): Promise<EvmReferralBookEntry[]> {
  const protocol = await fetchGraiProtocol(connection, graiMint)
  const lockers = protocol.referrers
  if (lockers.length === 0) return []

  const { programId } = protocol
  const bookPdas = lockers.map((locker) => referrerPda(locker, programId))
  const accounts = await fetchAccountsByKey(connection, bookPdas)

  const decoded: { locker: PublicKey; book: NonNullable<ReturnType<typeof decodeSolanaReferrerBook>> }[] =
    []
  for (const locker of lockers) {
    const data = getAccountData(accounts, referrerPda(locker, programId))
    if (!data) continue
    const book = decodeSolanaReferrerBook(data)
    if (!book) continue
    decoded.push({ locker, book })
  }

  const toRow = (
    row: (typeof decoded)[number],
    owner: PublicKey,
  ): EvmReferralBookEntry => ({
    locker: row.locker.toBase58() as `0x${string}`,
    referrer: row.book.referrer.equals(PublicKey.default)
      ? (row.locker.toBase58() as `0x${string}`)
      : (row.book.referrer.toBase58() as `0x${string}`),
    owner: owner.toBase58() as `0x${string}`,
    value: row.book.value,
    l1Value: row.book.l1Value,
    l2Value: row.book.l2Value,
  })

  const partial = decoded.map((row) => toRow(row, row.locker))
  options?.onPartial?.(partial)

  const nftOwners = await resolveNftOwners(
    connection,
    decoded.map((row) => row.book.nftMint),
    decoded.map((row) => row.locker),
  )

  return decoded.map((row, index) => toRow(row, nftOwners[index] ?? row.locker))
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
