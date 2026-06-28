import { Connection, PublicKey } from '@solana/web3.js'
import { GRAI_PROGRAM_ID, graiStatePda } from './constants'

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

let cachedAssetMints: PublicKey[] | null = null
let cachePromise: Promise<PublicKey[]> | null = null

export function clearGraiStateCache(): void {
  cachedAssetMints = null
  cachePromise = null
}

export async function fetchGraiStateAssetMints(
  connection: Connection,
): Promise<PublicKey[]> {
  if (cachedAssetMints) return cachedAssetMints
  if (cachePromise) return cachePromise

  cachePromise = (async () => {
    const graiState = graiStatePda(GRAI_PROGRAM_ID)
    const accountInfo = await connection.getAccountInfo(graiState)
    if (!accountInfo?.data) {
      throw new Error('GRAI protocol state account not found on this cluster')
    }
    cachedAssetMints = decodeGraiStateAssetMints(Buffer.from(accountInfo.data))
    return cachedAssetMints
  })()

  try {
    return await cachePromise
  } finally {
    cachePromise = null
  }
}
