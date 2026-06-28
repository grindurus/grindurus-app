import { clusterApiUrl, Connection, PublicKey } from '@solana/web3.js'

export const GRAI_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_GRAI_PROGRAM_ID ?? 'APwEPN6PYrRgEqL2G2CnmhQNouikdKiNdPJ48YX5Y8a8',
)

/** RPC for read-only GRAI registry (program is on devnet). Override via VITE_GRAI_RPC_URL. */
export const GRAI_REGISTRY_RPC_URL =
  import.meta.env.VITE_GRAI_RPC_URL ?? clusterApiUrl('devnet')

export function createGraiRegistryConnection(): Connection {
  return new Connection(GRAI_REGISTRY_RPC_URL, 'confirmed')
}

export function graiStatePda(programId: PublicKey = GRAI_PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('protocol')], programId)[0]
}

/** GRAI token mint (devnet deployment). Override via VITE_GRAI_MINT. */
export const GRAI_MINT = new PublicKey(
  import.meta.env.VITE_GRAI_MINT ?? '5UjazXW1NqBD1HnW9WfEdjHZUJsjk4prvuabq8GfEn5Q',
)
