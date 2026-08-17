import { Connection } from '@solana/web3.js'
import { fetchAccountsByKey, getAccountData } from './accountBatch'
import type { GraiSolanaRuntime } from './deployments'
import { fetchGraiProtocol } from './fetchGraiProtocol'
import { escrowPda } from './pdas'
import type { EvmLockerEntry } from './evm/readProtocol'

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
  const lockerKeys = protocol.lockers
  if (lockerKeys.length === 0) return []

  const escrowKeys = lockerKeys.map((owner) => escrowPda(owner, protocol.programId))
  const accounts = await fetchAccountsByKey(connection, escrowKeys)
  const entries: EvmLockerEntry[] = []
  for (const owner of lockerKeys) {
    const data = getAccountData(accounts, escrowPda(owner, protocol.programId))
    if (!data) continue
    const amount = decodeEscrowAmount(data)
    if (amount <= 0n) continue
    entries.push({
      address: owner.toBase58(),
      lockedGrai: amount,
    })
  }
  return entries
}
