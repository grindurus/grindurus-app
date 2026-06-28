import { PublicKey } from '@solana/web3.js'
import { GRAI_PROGRAM_ID } from './constants'

export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')

export function seniorVaultPda(
  assetMint: PublicKey,
  programId: PublicKey = GRAI_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('senior_vault_state'), assetMint.toBuffer()],
    programId,
  )[0]
}

export function seniorVaultAtaPda(
  assetMint: PublicKey,
  programId: PublicKey = GRAI_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('senior_vault_ata'), assetMint.toBuffer()],
    programId,
  )[0]
}

export function juniorVaultPda(
  assetMint: PublicKey,
  programId: PublicKey = GRAI_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('junior_vault_state'), assetMint.toBuffer()],
    programId,
  )[0]
}

export function juniorVaultAtaPda(
  assetMint: PublicKey,
  programId: PublicKey = GRAI_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('junior_vault_ata'), assetMint.toBuffer()],
    programId,
  )[0]
}

export function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0]
}
