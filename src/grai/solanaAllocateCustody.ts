import { Connection, PublicKey } from '@solana/web3.js'
import type { SolanaCluster } from '../providers/AppWalletProvider'

const ACCOUNT_DISCRIMINATOR_LEN = 8
const GRINDERS_PROGRAM_ID_DEFAULT = 'HLAmxNKz19CFJQYbsJPJHvixt7r9x4NdYjqqUQiiogJa'

function readEnv(key: string): string | undefined {
  const value = (import.meta.env as Record<string, string | undefined>)[key]
  return value?.trim() || undefined
}

function clusterEnvSuffix(cluster: SolanaCluster): string {
  if (cluster === 'mainnet-beta') return 'MAINNET'
  if (cluster === 'testnet') return 'TESTNET'
  return 'DEVNET'
}

function custodianIndexPda(custodianWallet: PublicKey, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('custodian_index'), custodianWallet.toBuffer()],
    programId,
  )[0]
}

function custodianRecordPda(custodianId: number, programId: PublicKey): PublicKey {
  const id = Buffer.alloc(8)
  id.writeBigUInt64LE(BigInt(custodianId))
  return PublicKey.findProgramAddressSync([Buffer.from('custodian'), id], programId)[0]
}

function decodeCustodianIndex(data: Buffer): { custodianId: number } {
  const body = data.subarray(ACCOUNT_DISCRIMINATOR_LEN)
  return { custodianId: Number(body.readBigUInt64LE(0)) }
}

function decodeCustodianRecordWallet(data: Buffer): PublicKey {
  const body = data.subarray(ACCOUNT_DISCRIMINATOR_LEN)
  return new PublicKey(body.subarray(8, 40))
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

export async function resolveSolanaAllocateCustodyAccounts(
  connection: Pick<Connection, 'getAccountInfo'>,
  custodyWallet: PublicKey,
  programId: PublicKey,
): Promise<{ custodianIndex: PublicKey; custodianRecord: PublicKey }> {
  const custodianIndex = custodianIndexPda(custodyWallet, programId)
  const indexAccount = await connection.getAccountInfo(custodianIndex)
  if (!indexAccount || !indexAccount.owner.equals(programId)) {
    throw new Error('Custody wallet is not registered with grinders')
  }

  const { custodianId } = decodeCustodianIndex(indexAccount.data)
  const custodianRecord = custodianRecordPda(custodianId, programId)
  const recordAccount = await connection.getAccountInfo(custodianRecord)
  if (!recordAccount || !recordAccount.owner.equals(programId)) {
    throw new Error('Grinders custodian record is missing')
  }

  if (!decodeCustodianRecordWallet(recordAccount.data).equals(custodyWallet)) {
    throw new Error('Grinders custodian record does not match custody wallet')
  }

  return { custodianIndex, custodianRecord }
}
