import { Connection, PublicKey } from '@solana/web3.js'
import { graiStatePda } from './deployments'
import { onJsonRpcMutation } from './jsonRpcBatchFetch'
import {
  decodeMintAuthority,
  decodeMintDecimals,
  decodeMintSupply,
  resolveFirstBribeableMint,
} from './onchain'

export type GraiProtocolConfig = {
  dividendCutBps: number
  treasuryCutBps: number
  revenueShareBps: number
  claimTipBps: number
  bribePremiumBps: number
  quorumBps: number
  /** Flat unlock fee in bps (on-chain `unlock_penalty_bps`). */
  unlockPenaltyBps: number
  /** Flat poach fee in bps (on-chain `poach_fee_bps`). */
  poachFeeBps: number
  liquidationPeriod: number
  redeemPeriod: number
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
  grinders: PublicKey
  settlementAsset: PublicKey
  /** NAV in USD with 6 decimals (`GraiState::DECIMALS`). */
  totalValue: bigint
  /** Escrowed GRAI (raw base units). */
  totalLocked: bigint
  /** Voted GRAI toward liquidation (raw base units). */
  totalVoted: bigint
  liquidation: boolean
  /** Grinders heartbeat still active (`grinding()`). */
  grinding: boolean
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
  grinders: PublicKey
  settlementAsset: PublicKey
}

/**
 * GraiState layout (after 8-byte discriminator):
 * owner(32) pending_owner(32) beneficiar(32) grinders(32)
 * total_value(16) total_locked(8) total_voted(8) liquidation(1)
 * liquidation_at(8) grai_mint(32) Config(24) royalty_bps(2) affiliate_levels(1)
 * affiliate_share_bps(4) then asset_mints / lockers / voters / referrers vecs, then bump.
 *
 * Bribe payment mint is per-asset `AssetConfig.bribeable` (no global settlement field).
 * Owner liquidation arm (`confirmed`) lives on GrindersState, not here.
 */
/** Canonical share mint, immediately before `config` (includes 8-byte discriminator). */
const GRAI_STATE_GRAI_MINT_OFFSET =
  8 + // discriminator
  32 + // owner
  32 + // pending_owner
  32 + // beneficiar
  32 + // grinders
  16 + // total_value
  8 + // total_locked
  8 + // total_voted
  1 + // liquidation
  8 // liquidation_at

/** Bytes before `config` in GraiState (includes 8-byte Anchor discriminator). */
export const GRAI_STATE_CONFIG_OFFSET = GRAI_STATE_GRAI_MINT_OFFSET + 32

/** Config::LEN = 8×u16 + 2×u32 (includes `poach_fee_bps`). */
export const GRAI_STATE_CONFIG_LEN = 24

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
 * GrindersState: disc(8) + owner(32) + pending_owner(32) + grai_program(32) +
 * next_custodian_id(8) + collection_mint(32) + heartbeat_at(i64) + grinding_period(u32) + bump.
 * Mirrors on-chain `Grinders.grinding()`: `now <= heartbeat_at + grinding_period`.
 */
export function decodeGrindersGrinding(data: Buffer, nowSec = Math.floor(Date.now() / 1000)): boolean {
  const heartbeatOffset = 8 + 32 + 32 + 32 + 8 + 32
  const periodOffset = heartbeatOffset + 8
  if (data.length < periodOffset + 4) return true
  const heartbeatAt = Number(data.readBigInt64LE(heartbeatOffset))
  const grindingPeriod = data.readUInt32LE(periodOffset)
  return nowSec <= heartbeatAt + grindingPeriod
}

function decodeGraiStateConfig(data: Buffer): GraiProtocolConfig {
  const o = GRAI_STATE_CONFIG_OFFSET
  if (data.length < o + GRAI_STATE_CONFIG_LEN) {
    throw new Error('GRAI state account data too short for config')
  }
  return {
    dividendCutBps: data.readUInt16LE(o),
    treasuryCutBps: data.readUInt16LE(o + 2),
    revenueShareBps: data.readUInt16LE(o + 4),
    claimTipBps: data.readUInt16LE(o + 6),
    bribePremiumBps: data.readUInt16LE(o + 8),
    quorumBps: data.readUInt16LE(o + 10),
    unlockPenaltyBps: data.readUInt16LE(o + 12),
    poachFeeBps: data.readUInt16LE(o + 14),
    liquidationPeriod: data.readUInt32LE(o + 16),
    redeemPeriod: data.readUInt32LE(o + 20),
  }
}

function decodeGraiStateFixedFields(data: Buffer): GraiStateFixedFields & {
  totalValue: bigint
  totalLocked: bigint
  totalVoted: bigint
  liquidation: boolean
  grinding: boolean
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
  // Bribe payment mint is per-asset `AssetConfig.bribeable` (no global settlement field).
  const settlementAsset = PublicKey.default
  const configEnd = GRAI_STATE_CONFIG_OFFSET + GRAI_STATE_CONFIG_LEN
  return {
    authority: owner,
    owner,
    pendingOwner,
    beneficiar,
    grinders,
    settlementAsset,
    totalValue: readU128LE(data, 136),
    totalLocked: data.readBigUInt64LE(152),
    totalVoted: data.readBigUInt64LE(160),
    liquidation: data[168] !== 0,
    grinding: true,
    liquidationAt: data.readBigInt64LE(169),
    config: decodeGraiStateConfig(data),
    royaltyBps: data.readUInt16LE(configEnd),
    affiliateLevels: data[configEnd + 2] ?? 0,
    affiliateShareBps: [data.readUInt16LE(configEnd + 3), data.readUInt16LE(configEnd + 5)],
  }
}

/** u128 total_value at offset 8 + 4*32 = 136 (owner + pending_owner + beneficiar + grinders). */
export function decodeGraiStateTotalValue(data: Buffer): bigint {
  if (data.length < 136 + 16) return 0n
  return readU128LE(data, 136)
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

const cacheByMint = new Map<string, GraiProtocolSnapshot>()
const promiseByMint = new Map<string, Promise<GraiProtocolSnapshot>>()

export function clearGraiProtocolCache(): void {
  cacheByMint.clear()
  promiseByMint.clear()
}

onJsonRpcMutation(clearGraiProtocolCache)

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
    if (stateData.length < GRAI_STATE_GRAI_MINT_OFFSET + 32) {
      throw new Error('GRAI protocol state account data too short for grai_mint')
    }
    const storedMint = new PublicKey(
      stateData.subarray(GRAI_STATE_GRAI_MINT_OFFSET, GRAI_STATE_GRAI_MINT_OFFSET + 32),
    )
    if (!storedMint.equals(graiMint)) {
      throw new Error('GRAI mint does not match protocol grai_mint')
    }
    const fixed = decodeGraiStateFixedFields(stateData)
    const assets = decodePubkeyVecAt(stateData, GRAI_STATE_ASSET_MINTS_OFFSET)
    const lockers = decodePubkeyVecAt(stateData, assets.nextOffset)
    const voters = decodePubkeyVecAt(stateData, lockers.nextOffset)
    const referrers = decodePubkeyVecAt(stateData, voters.nextOffset)

    // EVM `Grinders.grinding()` — liquidation open needs stale heartbeat (`!grinding`).
    let grinding = true
    if (!fixed.grinders.equals(PublicKey.default)) {
      const grindersInfo = await connection.getAccountInfo(fixed.grinders)
      if (grindersInfo?.data) {
        grinding = decodeGrindersGrinding(Buffer.from(grindersInfo.data))
      }
    }

    // Bribe payment mint = first listed `AssetConfig.bribeable` (no global field on GraiState).
    const settlementAsset = await resolveFirstBribeableMint(
      connection,
      programId,
      assets.keys,
    )

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
      grinders: fixed.grinders,
      settlementAsset,
      pendingOwner: fixed.pendingOwner,
      totalValue: fixed.totalValue,
      totalLocked: fixed.totalLocked,
      totalVoted: fixed.totalVoted,
      liquidation: fixed.liquidation,
      grinding,
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
