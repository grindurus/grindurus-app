import { AccountInfo, Connection, PublicKey } from '@solana/web3.js'

export type AccountInfoMap = Map<string, AccountInfo<Buffer> | null>

/** Devnet RPC `getMultipleAccounts` cap. */
const GET_MULTIPLE_ACCOUNTS_LIMIT = 100

/** SPL token account: amount (u64) at offset 64. */
export function decodeTokenAccountAmount(data: Buffer): bigint {
  if (data.length < 72) return 0n
  return data.readBigUInt64LE(64)
}

/** SPL token account: owner pubkey at offset 32. */
export function decodeTokenAccountOwner(data: Buffer): PublicKey | null {
  if (data.length < 64) return null
  return new PublicKey(data.subarray(32, 64))
}

export async function fetchAccountsByKey(
  connection: Connection,
  pubkeys: PublicKey[],
): Promise<AccountInfoMap> {
  if (pubkeys.length === 0) return new Map()

  const unique = [...new Map(pubkeys.map((key) => [key.toBase58(), key])).values()]
  const chunks: PublicKey[][] = []
  for (let offset = 0; offset < unique.length; offset += GET_MULTIPLE_ACCOUNTS_LIMIT) {
    chunks.push(unique.slice(offset, offset + GET_MULTIPLE_ACCOUNTS_LIMIT))
  }
  const infoChunks = await Promise.all(
    chunks.map((chunk) => connection.getMultipleAccountsInfo(chunk)),
  )

  const map: AccountInfoMap = new Map()
  unique.forEach((key, index) => {
    const chunkIndex = Math.floor(index / GET_MULTIPLE_ACCOUNTS_LIMIT)
    const indexInChunk = index % GET_MULTIPLE_ACCOUNTS_LIMIT
    map.set(key.toBase58(), infoChunks[chunkIndex]?.[indexInChunk] ?? null)
  })

  return map
}

export function getAccountData(map: AccountInfoMap, pubkey: PublicKey): Buffer | null {
  const account = map.get(pubkey.toBase58())
  if (!account?.data) return null
  return Buffer.from(account.data)
}
