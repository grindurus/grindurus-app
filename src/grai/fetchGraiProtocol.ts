import { Connection, PublicKey } from '@solana/web3.js'
import { graiStatePda } from './deployments'
import { decodeMintAuthority, decodeMintDecimals, decodeMintSupply } from './onchain'

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
  totalValue: bigint
  assetMints: PublicKey[]
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
 * authority(32) treasury(32) grinders(32) settlement_asset(32) total_value(16) …
 * then fixed fields, then asset_mints vec, voters vec, bump.
 */
function decodeGraiStateFixedFields(data: Buffer): GraiStateFixedFields {
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
  }
}

function decodeGraiStateTotalValue(data: Buffer): bigint {
  let value = 0n
  for (let i = 0; i < 16; i += 1) {
    value |= BigInt(data[136 + i]!) << BigInt(i * 8)
  }
  return value
}

/**
 * asset_mints vec starts after fixed fields:
 * disc(8) + authority+treasury+grinders+settlement(128) + total_value(16)
 * + total_voted(8) + reward_per_vote(16) + pending_vote_rewards(8)
 * + liquidation(1) + liquidation_at(8) + Config(18) = 8+128+16+8+16+8+1+8+18 = 211
 */
function decodeGraiStateAssetMints(data: Buffer): PublicKey[] {
  let offset = 8 + 32 + 32 + 32 + 32 + 16 + 8 + 16 + 8 + 1 + 8 + 18
  const assetCount = data.readUInt32LE(offset)
  offset += 4

  const assetMints: PublicKey[] = []
  for (let i = 0; i < assetCount; i += 1) {
    assetMints.push(new PublicKey(data.subarray(offset, offset + 32)))
    offset += 32
  }
  return assetMints
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
): Promise<GraiProtocolSnapshot> {
  const cacheKey = graiMint.toBase58()
  const cached = cacheByMint.get(cacheKey)
  if (cached) return cached

  const existing = promiseByMint.get(cacheKey)
  if (existing) return existing

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
      totalValue: decodeGraiStateTotalValue(stateData),
      assetMints: decodeGraiStateAssetMints(stateData),
    }

    cacheByMint.set(cacheKey, snapshot)
    return snapshot
  })()

  promiseByMint.set(cacheKey, promise)

  try {
    return await promise
  } finally {
    promiseByMint.delete(cacheKey)
  }
}
