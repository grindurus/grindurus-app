import { Connection, PublicKey } from '@solana/web3.js'
import { graiStatePda } from './deployments'
import { decodeMintAuthority, decodeMintDecimals, decodeMintSupply } from './onchain'

export type GraiProtocolConfig = {
  dividendCutBps: number
  treasuryCutBps: number
  revenueShareBps: number
  claimTipBps: number
  bribePremiumBps: number
  quorumBps: number
  /** Flat unlock fee in bps (on-chain `unlock_penalty_bps`). */
  unlockPenaltyBps: number
  /** @deprecated Alias of `unlockPenaltyBps` for older UI. */
  unlockFeeBps: number
  liquidationPeriod: number
  redeemPeriod: number
  /** @deprecated Removed from Solana Config — always 0. */
  buybackCutBps: number
  /** @deprecated Removed from Solana Config — always 0. */
  buybackPeriod: number
  /** @deprecated Time-decay unlock removed — always 0. */
  unlockPenaltyPeriod: number
}

export type GraiProtocolSnapshot = {
  graiMint: PublicKey
  graiState: PublicKey
  programId: PublicKey
  mintSupply: { raw: bigint; decimals: number }
  /** Protocol admin (`GraiState.owner`). */
  authority: PublicKey
  owner: PublicKey
  /** Two-step handoff target (`GraiState.pending_owner`). Default pubkey = none. */
  pendingOwner: PublicKey
  /** Fee recipient (`GraiState.beneficiar`). */
  beneficiar: PublicKey
  /** @deprecated Prefer `beneficiar`. */
  treasuryWallet: PublicKey
  /** @deprecated Prefer `beneficiar`. */
  treasury: PublicKey
  grinders: PublicKey
  settlementAsset: PublicKey
  /** NAV in USD with 6 decimals (`GraiState::DECIMALS`). */
  totalValue: bigint
  /** Escrowed GRAI (raw base units). */
  totalLocked: bigint
  /** Voted GRAI toward liquidation (raw base units). */
  totalVoted: bigint
  /** @deprecated Depositor allowlist removed — always 0. */
  totalDepositors: bigint
  liquidation: boolean
  confirmed: boolean
  liquidationAt: bigint
  config: GraiProtocolConfig
  royaltyBps: number
  affiliateLevels: number
  affiliateShareBps: [number, number]
  assetMints: PublicKey[]
  lockers: PublicKey[]
  /** Accounts with `escrow.voted > 0` (owner pubkeys from `GraiState.voters`). */
  voters: PublicKey[]
  referrers: PublicKey[]
}

export type GraiStateFixedFields = {
  authority: PublicKey
  owner: PublicKey
  /** Two-step handoff target (`GraiState.pending_owner`). Default pubkey = none. */
  pendingOwner: PublicKey
  beneficiar: PublicKey
  /** @deprecated Prefer `beneficiar`. */
  treasuryWallet: PublicKey
  /** @deprecated Prefer `beneficiar`. */
  treasury: PublicKey
  grinders: PublicKey
  settlementAsset: PublicKey
}

/**
 * GraiState layout (after 8-byte discriminator):
 * owner(32) pending_owner(32) beneficiar(32) grinders(32) settlement_asset(32)
 * total_value(16) total_locked(8) total_voted(8) liquidation(1)
 * liquidation_at(8) Config(22) royalty_bps(2) affiliate_levels(1)
 * affiliate_share_bps(4) then asset_mints / lockers / voters / referrers vecs, then bump.
 *
 * Owner liquidation arm (`confirmed`) lives on GrindersState, not here.
 */
/** Bytes before `config` in GraiState (includes 8-byte Anchor discriminator). */
export const GRAI_STATE_CONFIG_OFFSET =
  8 + // discriminator
  32 + // owner
  32 + // pending_owner
  32 + // beneficiar
  32 + // grinders
  32 + // settlement_asset
  16 + // total_value
  8 + // total_locked
  8 + // total_voted
  1 + // liquidation
  8 // liquidation_at

/** Config::LEN = 7×u16 + 2×u32 */
export const GRAI_STATE_CONFIG_LEN = 22

/** Bytes before `asset_mints` vec length prefix (excludes trailing bump after vecs). */
const GRAI_STATE_ASSET_MINTS_OFFSET =
  GRAI_STATE_CONFIG_OFFSET + GRAI_STATE_CONFIG_LEN + 2 + 1 + 4 // royalty + levels + share[2]

function readU128LE(data: Buffer, offset: number): bigint {
  let value = 0n
  for (let i = 0; i < 16; i += 1) {
    value |= BigInt(data[offset + i]!) << BigInt(i * 8)
  }
  return value
}

/**
 * GrindersState: disc(8) + owner(32) + grai_program(32) + next_custodian_id(8) +
 * collection_mint(32) + confirmed(1) + bump(1).
 */
export function decodeGrindersConfirmed(data: Buffer): boolean {
  const offset = 8 + 32 + 32 + 8 + 32
  if (data.length <= offset) return false
  return data[offset] !== 0
}

function decodeGraiStateConfig(data: Buffer): GraiProtocolConfig {
  const o = GRAI_STATE_CONFIG_OFFSET
  if (data.length < o + GRAI_STATE_CONFIG_LEN) {
    throw new Error('GRAI state account data too short for config')
  }
  const unlockPenaltyBps = data.readUInt16LE(o + 12)
  return {
    dividendCutBps: data.readUInt16LE(o),
    treasuryCutBps: data.readUInt16LE(o + 2),
    revenueShareBps: data.readUInt16LE(o + 4),
    claimTipBps: data.readUInt16LE(o + 6),
    bribePremiumBps: data.readUInt16LE(o + 8),
    quorumBps: data.readUInt16LE(o + 10),
    unlockPenaltyBps,
    unlockFeeBps: unlockPenaltyBps,
    liquidationPeriod: data.readUInt32LE(o + 14),
    redeemPeriod: data.readUInt32LE(o + 18),
    buybackCutBps: 0,
    buybackPeriod: 0,
    unlockPenaltyPeriod: 0,
  }
}

function decodeGraiStateFixedFields(data: Buffer): GraiStateFixedFields & {
  totalValue: bigint
  totalLocked: bigint
  totalVoted: bigint
  liquidation: boolean
  confirmed: boolean
  liquidationAt: bigint
  config: GraiProtocolConfig
  royaltyBps: number
  affiliateLevels: number
  affiliateShareBps: [number, number]
} {
  if (data.length < GRAI_STATE_ASSET_MINTS_OFFSET) {
    throw new Error('GRAI state account data too short')
  }
  const owner = new PublicKey(data.subarray(8, 40))
  const pendingOwner = new PublicKey(data.subarray(40, 72))
  const beneficiar = new PublicKey(data.subarray(72, 104))
  const grinders = new PublicKey(data.subarray(104, 136))
  const settlementAsset = new PublicKey(data.subarray(136, 168))
  const configEnd = GRAI_STATE_CONFIG_OFFSET + GRAI_STATE_CONFIG_LEN
  return {
    authority: owner,
    owner,
    pendingOwner,
    beneficiar,
    treasury: beneficiar,
    treasuryWallet: beneficiar,
    grinders,
    settlementAsset,
    totalValue: readU128LE(data, 168),
    totalLocked: data.readBigUInt64LE(184),
    totalVoted: data.readBigUInt64LE(192),
    liquidation: data[200] !== 0,
    /** Populated by callers from GrindersState; GraiState no longer stores the arm. */
    confirmed: false,
    liquidationAt: data.readBigInt64LE(201),
    config: decodeGraiStateConfig(data),
    royaltyBps: data.readUInt16LE(configEnd),
    affiliateLevels: data[configEnd + 2] ?? 0,
    affiliateShareBps: [data.readUInt16LE(configEnd + 3), data.readUInt16LE(configEnd + 5)],
  }
}

/** u128 total_value at offset 8 + 5*32 = 168 (owner + pending_owner + beneficiar + grinders + settlement). */
export function decodeGraiStateTotalValue(data: Buffer): bigint {
  if (data.length < 168 + 16) return 0n
  return readU128LE(data, 168)
}

export function decodeGraiStateTotalVoted(data: Buffer): bigint {
  if (data.length < 200) return 0n
  return data.readBigUInt64LE(192)
}

/**
 * `asset_mints` vec starts after the fixed header above.
 */
function decodePubkeyVecAt(data: Buffer, offset: number): { keys: PublicKey[]; nextOffset: number } {
  if (offset + 4 > data.length) return { keys: [], nextOffset: offset }
  const count = data.readUInt32LE(offset)
  let cursor = offset + 4
  const maxReasonable = Math.floor((data.length - cursor) / 32)
  if (count > maxReasonable) {
    throw new Error(
      `Invalid GraiState pubkey vec count ${count} (max ${maxReasonable} for account size)`,
    )
  }
  const keys: PublicKey[] = []
  for (let i = 0; i < count; i += 1) {
    keys.push(new PublicKey(data.subarray(cursor, cursor + 32)))
    cursor += 32
  }
  return { keys, nextOffset: cursor }
}

/** `voters` vec after `asset_mints` and `lockers`. */
export function decodeGraiStateVoters(data: Buffer): PublicKey[] {
  const assets = decodePubkeyVecAt(data, GRAI_STATE_ASSET_MINTS_OFFSET)
  const lockers = decodePubkeyVecAt(data, assets.nextOffset)
  return decodePubkeyVecAt(data, lockers.nextOffset).keys
}

/** `lockers` vec after `asset_mints`. */
export function decodeGraiStateLockers(data: Buffer): PublicKey[] {
  const assets = decodePubkeyVecAt(data, GRAI_STATE_ASSET_MINTS_OFFSET)
  return decodePubkeyVecAt(data, assets.nextOffset).keys
}

/** `referrers` vec after `asset_mints` / `lockers` / `voters`. */
export function decodeGraiStateReferrers(data: Buffer): PublicKey[] {
  const assets = decodePubkeyVecAt(data, GRAI_STATE_ASSET_MINTS_OFFSET)
  const lockers = decodePubkeyVecAt(data, assets.nextOffset)
  const voters = decodePubkeyVecAt(data, lockers.nextOffset)
  return decodePubkeyVecAt(data, voters.nextOffset).keys
}

const cacheByMint = new Map<string, GraiProtocolSnapshot>()
const promiseByMint = new Map<string, Promise<GraiProtocolSnapshot>>()

export function clearGraiProtocolCache(): void {
  cacheByMint.clear()
  promiseByMint.clear()
}

/**
 * Resolves GRAI protocol metadata from the mint address alone (2 RPC round-trips):
 * 1. getAccountInfo(graiMint) → supply + grai_state address (mint_authority)
 * 2. getAccountInfo(graiState) → program_id (owner), asset_mints, NAV fields
 */
export async function fetchGraiProtocol(
  connection: Connection,
  graiMint: PublicKey,
  options?: { bypassCache?: boolean },
): Promise<GraiProtocolSnapshot> {
  const cacheKey = graiMint.toBase58()
  if (!options?.bypassCache) {
    const cached = cacheByMint.get(cacheKey)
    if (cached) return cached

    const existing = promiseByMint.get(cacheKey)
    if (existing) return existing
  }

  const promise = (async () => {
    const mintInfo = await connection.getAccountInfo(graiMint)
    if (!mintInfo?.data) {
      throw new Error('GRAI mint account not found on this cluster')
    }

    const mintData = Buffer.from(mintInfo.data)
    const graiState = decodeMintAuthority(mintData)
    if (!graiState) {
      throw new Error('GRAI mint has no mint authority')
    }

    const stateInfo = await connection.getAccountInfo(graiState)
    if (!stateInfo?.data) {
      throw new Error('GRAI protocol state account not found on this cluster')
    }

    const programId = stateInfo.owner
    const expectedState = graiStatePda(programId)
    if (!graiState.equals(expectedState)) {
      throw new Error('GRAI mint authority does not match protocol state PDA')
    }

    const stateData = Buffer.from(stateInfo.data)
    const fixed = decodeGraiStateFixedFields(stateData)
    const assets = decodePubkeyVecAt(stateData, GRAI_STATE_ASSET_MINTS_OFFSET)
    const lockers = decodePubkeyVecAt(stateData, assets.nextOffset)
    const voters = decodePubkeyVecAt(stateData, lockers.nextOffset)
    const referrers = decodePubkeyVecAt(stateData, voters.nextOffset)

    // EVM `Grinders.confirmed` — owner arm lives on GrindersState, not GraiState.
    let confirmed = false
    if (!fixed.grinders.equals(PublicKey.default)) {
      const grindersInfo = await connection.getAccountInfo(fixed.grinders)
      if (grindersInfo?.data) {
        confirmed = decodeGrindersConfirmed(Buffer.from(grindersInfo.data))
      }
    }

    const snapshot: GraiProtocolSnapshot = {
      graiMint,
      graiState,
      programId,
      mintSupply: {
        raw: decodeMintSupply(mintData),
        decimals: decodeMintDecimals(mintData),
      },
      authority: fixed.authority,
      owner: fixed.owner,
      beneficiar: fixed.beneficiar,
      treasury: fixed.beneficiar,
      treasuryWallet: fixed.beneficiar,
      grinders: fixed.grinders,
      settlementAsset: fixed.settlementAsset,
      pendingOwner: fixed.pendingOwner,
      totalValue: fixed.totalValue,
      totalLocked: fixed.totalLocked,
      totalVoted: fixed.totalVoted,
      totalDepositors: 0n,
      liquidation: fixed.liquidation,
      confirmed,
      liquidationAt: fixed.liquidationAt,
      config: fixed.config,
      royaltyBps: fixed.royaltyBps,
      affiliateLevels: fixed.affiliateLevels,
      affiliateShareBps: fixed.affiliateShareBps,
      assetMints: assets.keys,
      lockers: lockers.keys,
      voters: voters.keys,
      referrers: referrers.keys,
    }

    cacheByMint.set(cacheKey, snapshot)
    return snapshot
  })()

  if (!options?.bypassCache) {
    promiseByMint.set(cacheKey, promise)
  }

  try {
    return await promise
  } finally {
    if (!options?.bypassCache) {
      promiseByMint.delete(cacheKey)
    }
  }
}
