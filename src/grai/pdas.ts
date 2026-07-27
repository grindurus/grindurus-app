import { PublicKey } from '@solana/web3.js'

export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')

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

/** @deprecated Use `positionPda`. */
export function yieldByPda(
  custodyWallet: PublicKey,
  assetMint: PublicKey,
  programId: PublicKey,
): PublicKey {
  return positionPda(custodyWallet, assetMint, programId)
}

export function grindersStatePda(grindersProgramId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('grinders')], grindersProgramId)[0]
}

/** Grinders Allocation PDA — lives on the grinders program. */
export function allocationPda(
  custodianState: PublicKey,
  assetMint: PublicKey,
  grindersProgramId: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('allocation'), custodianState.toBuffer(), assetMint.toBuffer()],
    grindersProgramId,
  )[0]
}

export function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0]
}

/** @deprecated Senior vaults removed — use `assetConfigPda`. */
export function seniorVaultPda(assetMint: PublicKey, programId: PublicKey): PublicKey {
  return assetConfigPda(assetMint, programId)
}

/** @deprecated Senior vault ATAs removed — use `vaultAtaPda`. */
export function seniorVaultAtaPda(assetMint: PublicKey, programId: PublicKey): PublicKey {
  return vaultAtaPda(assetMint, programId)
}

/** @deprecated Junior vaults removed. */
export function juniorVaultPda(assetMint: PublicKey, programId: PublicKey): PublicKey {
  return assetConfigPda(assetMint, programId)
}

/** @deprecated Junior vault ATAs removed — reserves live on grinders ATA. */
export function juniorVaultAtaPda(assetMint: PublicKey, programId: PublicKey): PublicKey {
  return vaultAtaPda(assetMint, programId)
}

/** @deprecated Custody allocation moved to grinders `allocation` PDA. */
export function custodyAllocationPda(
  custodyWallet: PublicKey,
  assetMint: PublicKey,
  programId: PublicKey,
): PublicKey {
  return allocationPda(custodyWallet, assetMint, programId)
}
