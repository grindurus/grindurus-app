import { Connection, PublicKey } from '@solana/web3.js'
import type { SolanaCluster } from '../providers/AppWalletProvider'

const GRINDERS_PROGRAM_ID_DEFAULT = '7W9uhZZvmHSyhRmdDRnbZPZfaUdJaMbGMWsBLjSRWT5v'

function readEnv(key: string): string | undefined {
  const value = (import.meta.env as Record<string, string | undefined>)[key]
  return value?.trim() || undefined
}

function clusterEnvSuffix(cluster: SolanaCluster): string {
  if (cluster === 'mainnet-beta') return 'MAINNET'
  if (cluster === 'testnet') return 'TESTNET'
  return 'DEVNET'
}

export function resolveSolanaGrindersProgramId(cluster: SolanaCluster): PublicKey {
  const suffix = clusterEnvSuffix(cluster)
  const specific =
    readEnv(`VITE_GRINDERS_${suffix}_PROGRAM_ID`) ??
    readEnv(`VITE_TREASURY_${suffix}_PROGRAM_ID`)
  const legacy = readEnv('VITE_GRINDERS_PROGRAM_ID') ?? readEnv('VITE_TREASURY_PROGRAM_ID')
  const raw = specific ?? legacy ?? GRINDERS_PROGRAM_ID_DEFAULT
  return new PublicKey(raw)
}

/** @deprecated Use `resolveSolanaGrindersProgramId`. */
export const resolveSolanaTreasuryProgramId = resolveSolanaGrindersProgramId

/** Assert `custodyWallet` is a grinders `CustodianState` PDA. */
export async function assertSolanaCustodianWallet(
  connection: Pick<Connection, 'getAccountInfo'>,
  custodyWallet: PublicKey,
  programId: PublicKey,
): Promise<void> {
  const account = await connection.getAccountInfo(custodyWallet)
  if (!account || !account.owner.equals(programId)) {
    throw new Error('Custody wallet is not registered with grinders')
  }
}

/** @deprecated Prefer `assertSolanaCustodianWallet`. */
export async function resolveSolanaAllocateCustodyAccounts(
  connection: Pick<Connection, 'getAccountInfo'>,
  custodyWallet: PublicKey,
  programId: PublicKey,
): Promise<{ custodianIndex: PublicKey; custodianRecord: PublicKey }> {
  await assertSolanaCustodianWallet(connection, custodyWallet, programId)
  // Legacy return shape — callers should stop using index/record PDAs.
  return { custodianIndex: custodyWallet, custodianRecord: custodyWallet }
}
