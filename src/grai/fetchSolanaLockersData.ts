import { Connection, PublicKey } from '@solana/web3.js'
import { fetchAccountsByKey, getAccountData } from './accountBatch'
import {
  decodeAssetConfigAccShare,
  decodeEscrowUnvoted,
  decodePosition,
  pendingSolanaDividend,
} from './estimateSolanaClaim'
import { fetchGraiProtocol } from './fetchGraiProtocol'
import {
  decodeSolanaReferrerBook,
  resolveNftOwner,
} from './fetchSolanaReferralBooks'
import { assetConfigPda, escrowPda, positionPda, referrerPda } from './pdas'

export type SolanaLockerData = {
  locker: PublicKey
  referrer: PublicKey
  ownerOf: PublicKey
  nftMint: PublicKey
  book: {
    value: bigint
    l1Value: bigint
    l2Value: bigint
    referrer: PublicKey
  }
  assets: PublicKey[]
  claimable: bigint[]
}

/**
 * Bound lockers + pending claims (EVM GRAI `getLockersData`).
 * Off-chain PDA read of the same remaining-account layout as `get_lockers_data`.
 */
export async function fetchSolanaLockersData(
  connection: Connection,
  graiMint: PublicKey,
): Promise<SolanaLockerData[]> {
  const protocol = await fetchGraiProtocol(connection, graiMint, { bypassCache: true })
  const lockers = protocol.referrers
  if (lockers.length === 0) return []

  const { programId, assetMints } = protocol
  const keys: PublicKey[] = []
  for (const locker of lockers) {
    keys.push(referrerPda(locker, programId), escrowPda(locker, programId))
  }
  for (const mint of assetMints) {
    keys.push(assetConfigPda(mint, programId))
  }
  for (const locker of lockers) {
    for (const mint of assetMints) {
      keys.push(positionPda(locker, mint, programId))
    }
  }

  const accounts = await fetchAccountsByKey(connection, keys)
  const rows: SolanaLockerData[] = []

  for (const locker of lockers) {
    const bookData = getAccountData(accounts, referrerPda(locker, programId))
    if (!bookData) continue
    const book = decodeSolanaReferrerBook(bookData)
    if (!book) continue

    const escrowData = getAccountData(accounts, escrowPda(locker, programId))
    const unvoted = escrowData ? decodeEscrowUnvoted(escrowData) : 0n
    const assets: PublicKey[] = []
    const claimable: bigint[] = []
    for (const mint of assetMints) {
      const assetConfigData = getAccountData(accounts, assetConfigPda(mint, programId))
      const positionData = getAccountData(accounts, positionPda(locker, mint, programId))
      const accShare = assetConfigData ? decodeAssetConfigAccShare(assetConfigData) : 0n
      const { debt, claimable: stored } = positionData
        ? decodePosition(positionData)
        : { debt: 0n, claimable: 0n }
      assets.push(mint)
      claimable.push(pendingSolanaDividend(unvoted, accShare, debt, stored))
    }

    const ownerOf = await resolveNftOwner(connection, book.nftMint, locker)
    rows.push({
      locker,
      referrer: book.referrer,
      ownerOf,
      nftMint: book.nftMint,
      book: {
        value: book.value,
        l1Value: book.l1Value,
        l2Value: book.l2Value,
        referrer: book.referrer,
      },
      assets,
      claimable,
    })
  }

  return rows
}
