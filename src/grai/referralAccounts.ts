import { Connection, PublicKey, SystemProgram } from '@solana/web3.js'
import { fetchAccountsByKey, getAccountData } from './accountBatch'
import {
  getAssociatedTokenAddress,
  referrerPda,
  treasuryNftMintPda,
} from './pdas'

export type AccountMeta = {
  pubkey: PublicKey
  isSigner: boolean
  isWritable: boolean
}

/** Anchor Referrer: disc(8) + referrer(32) + nft_mint(32) + … */
export function decodeReferrerAccount(
  data: Buffer,
): { referrer: PublicKey; nftMint: PublicKey } | null {
  if (data.length < 8 + 64) return null
  return {
    referrer: new PublicKey(data.subarray(8, 40)),
    nftMint: new PublicKey(data.subarray(40, 72)),
  }
}

/**
 * Claim remaining: `[referrer_pda, nft_ata, affiliate_ata] × affiliate_levels` plus the last
 * ancestor's Referrer PDA (N levels → N+1 books). Level 0 book is the locker's Referrer PDA.
 */
export async function claimAffiliateRemainingMetas(
  connection: Connection,
  locker: PublicKey,
  assetMint: PublicKey,
  programId: PublicKey,
  affiliateLevels: number,
): Promise<AccountMeta[]> {
  const levels = Math.max(0, affiliateLevels)
  if (levels === 0) return []

  const metas: AccountMeta[] = []
  let cur = locker

  for (let level = 0; level < levels; level += 1) {
    const book = referrerPda(cur, programId)
    const info = await connection.getAccountInfo(book)
    const decoded = info?.data ? decodeReferrerAccount(Buffer.from(info.data)) : null

    const affiliate =
      decoded &&
      !decoded.referrer.equals(PublicKey.default) &&
      !decoded.referrer.equals(locker) &&
      !decoded.referrer.equals(cur)
        ? decoded.referrer
        : cur

    const nftMint =
      decoded && !decoded.nftMint.equals(PublicKey.default)
        ? decoded.nftMint
        : treasuryNftMintPda(affiliate, programId)
    const nftAta = getAssociatedTokenAddress(nftMint, affiliate)
    const affiliateAta = getAssociatedTokenAddress(assetMint, affiliate)

    metas.push(
      { pubkey: book, isSigner: false, isWritable: true },
      { pubkey: nftAta, isSigner: false, isWritable: false },
      { pubkey: affiliateAta, isSigner: false, isWritable: true },
    )

    if (
      !decoded ||
      decoded.referrer.equals(PublicKey.default) ||
      decoded.referrer.equals(locker) ||
      decoded.referrer.equals(cur)
    ) {
      // Pad remaining levels with system program placeholders so length matches.
      for (let rest = level + 1; rest < levels; rest += 1) {
        metas.push(
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        )
      }
      break
    }

    cur = decoded.referrer
  }

  // Last hop's book (L2 when levels=2). Duplicate of an earlier PDA / SystemProgram is fine
  // when the walk stopped early — `referrer_info` still needs a slot in the pool.
  metas.push({ pubkey: referrerPda(cur, programId), isSigner: false, isWritable: true })

  return metas
}

/**
 * Deposit remaining: L1 book + L2 ancestor book for `credit_books` on mint (M-04).
 *
 * Prefer the locker's already-bound sticky referrer when present so later deposits that
 * pass a default / self sticky arg still supply ancestor PDAs. Missing L2 on a live
 * upline is `Incomplete` and reverts bind (H-07) instead of sticky self-root.
 */
export async function depositAffiliateRemainingMetas(
  connection: Connection,
  locker: PublicKey,
  stickyReferrer: PublicKey,
  programId: PublicKey,
): Promise<AccountMeta[]> {
  let upline = stickyReferrer
  const lockerPda = referrerPda(locker, programId)
  const stickyPda =
    !stickyReferrer.equals(PublicKey.default) && !stickyReferrer.equals(locker)
      ? referrerPda(stickyReferrer, programId)
      : null
  const accounts = await fetchAccountsByKey(
    connection,
    stickyPda ? [lockerPda, stickyPda] : [lockerPda],
  )

  const lockerDecoded = (() => {
    const lockerInfo = getAccountData(accounts, lockerPda)
    return lockerInfo ? decodeReferrerAccount(lockerInfo) : null
  })()
  if (
    lockerDecoded &&
    !lockerDecoded.referrer.equals(PublicKey.default) &&
    !lockerDecoded.referrer.equals(locker)
  ) {
    upline = lockerDecoded.referrer
  }

  if (upline.equals(PublicKey.default) || upline.equals(locker)) {
    return []
  }

  const l1 = referrerPda(upline, programId)
  let l2 = SystemProgram.programId
  let l1Data = getAccountData(accounts, l1)
  if (!l1Data) {
    l1Data = getAccountData(await fetchAccountsByKey(connection, [l1]), l1)
  }
  const decoded = l1Data ? decodeReferrerAccount(l1Data) : null
  if (
    decoded &&
    !decoded.referrer.equals(PublicKey.default) &&
    !decoded.referrer.equals(upline) &&
    !decoded.referrer.equals(locker)
  ) {
    l2 = referrerPda(decoded.referrer, programId)
  }

  return [
    { pubkey: l1, isSigner: false, isWritable: true },
    { pubkey: l2, isSigner: false, isWritable: true },
  ]
}
