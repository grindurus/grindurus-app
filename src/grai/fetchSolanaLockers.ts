import { Connection } from '@solana/web3.js'
import type { GraiSolanaRuntime } from './deployments'
import { decodeGraiStateLockers, fetchGraiProtocol } from './fetchGraiProtocol'
import { escrowPda } from './pdas'
import type { EvmLockerEntry } from './evm/readProtocol'

/** Match on-chain escrow page size used for voter fetches. */
const LOCKERS_PAGE_SIZE = 32

function decodeEscrowAmount(data: Buffer): bigint {
  // After discriminator(8): amount(u64)
  if (data.length < 16) return 0n
  return data.readBigUInt64LE(8)
}

/**
 * Load active Solana GRAI lockers with escrow amounts (analogous to EVM `getLockers`).
 */
export async function fetchSolanaLockers(
  connection: Connection,
  config: GraiSolanaRuntime,
): Promise<EvmLockerEntry[]> {
  const protocol = await fetchGraiProtocol(connection, config.graiMint)
  const stateInfo = await connection.getAccountInfo(protocol.graiState)
  if (!stateInfo?.data) return []

  const lockerKeys = decodeGraiStateLockers(Buffer.from(stateInfo.data))
  const entries: EvmLockerEntry[] = []

  for (let offset = 0; offset < lockerKeys.length; offset += LOCKERS_PAGE_SIZE) {
    const slice = lockerKeys.slice(offset, offset + LOCKERS_PAGE_SIZE)
    const escrowKeys = slice.map((owner) => escrowPda(owner, protocol.programId))
    const infos = await connection.getMultipleAccountsInfo(escrowKeys)
    infos.forEach((info, index) => {
      const owner = slice[index]
      if (!owner || !info?.data) return
      const amount = decodeEscrowAmount(Buffer.from(info.data))
      if (amount <= 0n) return
      entries.push({
        address: owner.toBase58(),
        lockedGrai: amount,
      })
    })
  }

  return entries
}
