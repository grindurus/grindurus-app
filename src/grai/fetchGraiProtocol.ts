import { Connection, PublicKey } from '@solana/web3.js'
import { graiStatePda } from './deployments'
import { decodeMintAuthority, decodeMintDecimals, decodeMintSupply } from './onchain'

export type GraiProtocolConfig = {
  buybackCutBps: number
  dividendCutBps: number
  treasuryCutBps: number
  bribePremiumBps: number
  quorumBps: number
  unlockFeeBps: number
  buybackPeriod: number
  liquidationPeriod: number
  redeemPeriod: number
  unlockPenaltyPeriod: number
}

export type GraiProtocolSnapshot = {
  graiMint: PublicKey
  graiState: PublicKey
  programId: PublicKey
  mintSupply: { raw: bigint; decimals: number }
  authority: PublicKey
  /** @deprecated Prefer `treasury`. */
  treasuryWallet: PublicKey
  treasury: PublicKey
  grinders: PublicKey
  settlementAsset: PublicKey
  /** NAV in USD with 6 decimals (`GraiState::DECIMALS`). */
  totalValue: bigint
  /** Escrowed GRAI (raw base units). */
  totalLocked: bigint
  /** Voted GRAI toward liquidation (raw base units). */
  totalVoted: bigint
  liquidation: boolean
  confirmed: boolean
  liquidationAt: bigint
  config: GraiProtocolConfig
  assetMints: PublicKey[]
  /** Accounts with `escrow.voted > 0` (owner pubkeys from `GraiState.voters`). */
  voters: PublicKey[]
}

export type GraiStateFixedFields = {
  authority: PublicKey
  /** @deprecated Prefer `treasury`. */
  treasuryWallet: PublicKey
  treasury: PublicKey
  grinders: PublicKey
  settlementAsset: PublicKey
}

/**
 * New GraiState layout (after 8-byte discriminator):
 * authority(32) treasury(32) grinders(32) bribe_asset(32) total_value(16)
 * total_locked(8) total_voted(8) liquidation(1) confirmed(1) liquidation_at(8)
 * Config(28) then asset_mints / lockers / voters vecs, then bump.
 */
/** Bytes before `config` in GraiState (includes 8-byte Anchor discriminator). */
export const GRAI_STATE_CONFIG_OFFSET =
  8 + // discriminator
  32 + // authority
  32 + // treasury
  32 + // grinders
  32 + // bribe_asset
  16 + // total_value
  8 + // total_locked
  8 + // total_voted
  1 + // liquidation
  1 + // confirmed
  8 // liquidation_at

/** Bytes before `asset_mints` vec length prefix. */
const GRAI_STATE_ASSET_MINTS_OFFSET = GRAI_STATE_CONFIG_OFFSET + 28 // Config (6×u16 + 4×u32)

function readU128LE(data: Buffer, offset: number): bigint {
  let value = 0n
  for (let i = 0; i < 16; i += 1) {
    value |= BigInt(data[offset + i]!) << BigInt(i * 8)
  }
  return value
}

function decodeGraiStateConfig(data: Buffer): GraiProtocolConfig {
  const o = GRAI_STATE_CONFIG_OFFSET
  if (data.length < o + 28) {
    throw new Error('GRAI state account data too short for config')
  }
  return {
    buybackCutBps: data.readUInt16LE(o),
    dividendCutBps: data.readUInt16LE(o + 2),
    treasuryCutBps: data.readUInt16LE(o + 4),
    bribePremiumBps: data.readUInt16LE(o + 6),
    quorumBps: data.readUInt16LE(o + 8),
    unlockFeeBps: data.readUInt16LE(o + 10),
    buybackPeriod: data.readUInt32LE(o + 12),
    liquidationPeriod: data.readUInt32LE(o + 16),
    redeemPeriod: data.readUInt32LE(o + 20),
    unlockPenaltyPeriod: data.readUInt32LE(o + 24),
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
} {
  if (data.length < GRAI_STATE_ASSET_MINTS_OFFSET) {
    throw new Error('GRAI state account data too short')
  }
  const authority = new PublicKey(data.subarray(8, 40))
  const treasury = new PublicKey(data.subarray(40, 72))
  const grinders = new PublicKey(data.subarray(72, 104))
  const settlementAsset = new PublicKey(data.subarray(104, 136))
  return {
    authority,
    treasury,
    treasuryWallet: treasury,
    grinders,
    settlementAsset,
    totalValue: readU128LE(data, 136),
    totalLocked: data.readBigUInt64LE(152),
    totalVoted: data.readBigUInt64LE(160),
    liquidation: data[168] !== 0,
    confirmed: data[169] !== 0,
    liquidationAt: data.readBigInt64LE(170),
    config: decodeGraiStateConfig(data),
  }
}

/** u128 total_value at offset 8 + 4*32 = 136. */
export function decodeGraiStateTotalValue(data: Buffer): bigint {
  if (data.length < 136 + 16) return 0n
  return readU128LE(data, 136)
}

export function decodeGraiStateTotalVoted(data: Buffer): bigint {
  if (data.length < 168) return 0n
  return data.readBigUInt64LE(160)
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

function decodeGraiStateAssetMints(data: Buffer): PublicKey[] {
  return decodePubkeyVecAt(data, GRAI_STATE_ASSET_MINTS_OFFSET).keys
}

/** `voters` vec after `asset_mints` and `lockers`. */
export function decodeGraiStateVoters(data: Buffer): PublicKey[] {
  const assets = decodePubkeyVecAt(data, GRAI_STATE_ASSET_MINTS_OFFSET)
  const lockers = decodePubkeyVecAt(data, assets.nextOffset)
  return decodePubkeyVecAt(data, lockers.nextOffset).keys
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

    const snapshot: GraiProtocolSnapshot = {
      graiMint,
      graiState,
      programId,
      mintSupply: {
        raw: decodeMintSupply(mintData),
        decimals: decodeMintDecimals(mintData),
      },
      authority: fixed.authority,
      treasury: fixed.treasury,
      treasuryWallet: fixed.treasury,
      grinders: fixed.grinders,
      settlementAsset: fixed.settlementAsset,
      totalValue: fixed.totalValue,
      totalLocked: fixed.totalLocked,
      totalVoted: fixed.totalVoted,
      liquidation: fixed.liquidation,
      confirmed: fixed.confirmed,
      liquidationAt: fixed.liquidationAt,
      config: fixed.config,
      assetMints: decodeGraiStateAssetMints(stateData),
      voters: decodeGraiStateVoters(stateData),
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
