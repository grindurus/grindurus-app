import { AccountInfo, Connection, PublicKey } from '@solana/web3.js'

export type AccountInfoMap = Map<string, AccountInfo<Buffer> | null>

/** SPL token account: amount (u64) at offset 64. */
export function decodeTokenAccountAmount(data: Buffer): bigint {
  if (data.length < 72) return 0n
  return data.readBigUInt64LE(64)
}

export async function fetchAccountsByKey(
  connection: Connection,
  pubkeys: PublicKey[],
): Promise<AccountInfoMap> {
  if (pubkeys.length === 0) return new Map()

  const unique = [...new Map(pubkeys.map((key) => [key.toBase58(), key])).values()]
  const infos = await connection.getMultipleAccountsInfo(unique)
  const map: AccountInfoMap = new Map()

  unique.forEach((key, index) => {
    map.set(key.toBase58(), infos[index] ?? null)
  })

  return map
}

export function getAccountData(map: AccountInfoMap, pubkey: PublicKey): Buffer | null {
  const account = map.get(pubkey.toBase58())
  if (!account?.data) return null
  return Buffer.from(account.data)
}
