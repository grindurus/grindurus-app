import { Connection, PublicKey } from '@solana/web3.js'
import { GRINDERS_SOLANA } from '../contracts'
import type { SolanaCluster } from '../wallets/AppWalletProvider'

export function resolveSolanaGrindersProgramId(cluster: SolanaCluster): PublicKey {
  return new PublicKey(GRINDERS_SOLANA[cluster] ?? GRINDERS_SOLANA.default)
}

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
