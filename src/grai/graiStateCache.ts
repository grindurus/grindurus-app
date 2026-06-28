import { Connection, PublicKey } from '@solana/web3.js'
import { graiStatePda } from './deployments'
import type { GraiSolanaConfig } from './deployments'

export type GraiStateFixedFields = {
  authority: PublicKey
  treasuryWallet: PublicKey
}

function decodeGraiStateFixedFields(data: Buffer): GraiStateFixedFields {
  return {
    authority: new PublicKey(data.subarray(8, 40)),
    treasuryWallet: new PublicKey(data.subarray(56, 88)),
  }
}

function decodeGraiStateAssetMints(data: Buffer): PublicKey[] {
  let offset = 8 + 32 + 16 + 32
  const assetCount = data.readUInt32LE(offset)
  offset += 4

  const assetMints: PublicKey[] = []
  for (let i = 0; i < assetCount; i += 1) {
    assetMints.push(new PublicKey(data.subarray(offset, offset + 32)))
    offset += 32
  }
  return assetMints
}

const cacheByProgram = new Map<string, PublicKey[]>()
const cachePromiseByProgram = new Map<string, Promise<PublicKey[]>>()

export function clearGraiStateCache(): void {
  cacheByProgram.clear()
  cachePromiseByProgram.clear()
}

export async function fetchGraiStateFixedFields(
  connection: Connection,
  config: GraiSolanaConfig,
): Promise<GraiStateFixedFields> {
  const graiState = graiStatePda(config.programId)
  const accountInfo = await connection.getAccountInfo(graiState)
  if (!accountInfo?.data) {
    throw new Error('GRAI protocol state account not found on this cluster')
  }
  return decodeGraiStateFixedFields(Buffer.from(accountInfo.data))
}

export async function fetchGraiStateAssetMints(
  connection: Connection,
  config: GraiSolanaConfig,
): Promise<PublicKey[]> {
  const cacheKey = config.programId.toBase58()
  const cached = cacheByProgram.get(cacheKey)
  if (cached) return cached

  const existingPromise = cachePromiseByProgram.get(cacheKey)
  if (existingPromise) return existingPromise

  const promise = (async () => {
    const graiState = graiStatePda(config.programId)
    const accountInfo = await connection.getAccountInfo(graiState)
    if (!accountInfo?.data) {
      throw new Error('GRAI protocol state account not found on this cluster')
    }
    const assetMints = decodeGraiStateAssetMints(Buffer.from(accountInfo.data))
    cacheByProgram.set(cacheKey, assetMints)
    return assetMints
  })()

  cachePromiseByProgram.set(cacheKey, promise)

  try {
    return await promise
  } finally {
    cachePromiseByProgram.delete(cacheKey)
  }
}
