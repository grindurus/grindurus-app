import { PublicKey } from '@solana/web3.js'

export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
export const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')

export function assetConfigPda(assetMint: PublicKey, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('asset'), assetMint.toBuffer()],
    programId,
  )[0]
}

export function vaultAtaPda(assetMint: PublicKey, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), assetMint.toBuffer()],
    programId,
  )[0]
}

export function treasuryVaultPda(assetMint: PublicKey, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('treasury'), assetMint.toBuffer()],
    programId,
  )[0]
}

export function positionPda(
  account: PublicKey,
  assetMint: PublicKey,
  programId: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('position'), account.toBuffer(), assetMint.toBuffer()],
    programId,
  )[0]
}

export function grindersStatePda(grindersProgramId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('grinders')], grindersProgramId)[0]
}

export function escrowPda(user: PublicKey, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), user.toBuffer()],
    programId,
  )[0]
}

export function referrerPda(locker: PublicKey, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('referrer'), locker.toBuffer()],
    programId,
  )[0]
}

export function treasuryNftMintPda(locker: PublicKey, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('treasury-nft'), locker.toBuffer()],
    programId,
  )[0]
}

export function metadataPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID,
  )[0]
}

export function masterEditionPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
      Buffer.from('edition'),
    ],
    TOKEN_METADATA_PROGRAM_ID,
  )[0]
}

/** Metaplex cashflow NFT accounts required on every `deposit` / `deposit_sol`. */
export function treasuryNftDepositAccounts(locker: PublicKey, programId: PublicKey) {
  const treasuryNftMint = treasuryNftMintPda(locker, programId)
  return {
    treasuryNftMint,
    treasuryNftMetadata: metadataPda(treasuryNftMint),
    treasuryNftEdition: masterEditionPda(treasuryNftMint),
    treasuryNftAta: getAssociatedTokenAddress(treasuryNftMint, locker),
    tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
  }
}

export function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0]
}
