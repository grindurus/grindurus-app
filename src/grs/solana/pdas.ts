import { PublicKey } from '@solana/web3.js'
import type { GrsSolanaConfig } from '../deployments'

/** OFT token_escrow PDA: `["OftEscrow", mint]`. */
export function oftTokenEscrowPda(mint: PublicKey, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('OftEscrow'), mint.toBuffer()], programId)[0]
}

export function oftStorePda(escrow: PublicKey, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('OFT'), escrow.toBuffer()], programId)[0]
}

/** Derive escrow + oft_store from mint (new GRS init). */
export function oftStoreFromMint(
  mint: PublicKey,
  programId: PublicKey,
): { escrow: PublicKey; oftStore: PublicKey } {
  const escrow = oftTokenEscrowPda(mint, programId)
  return { escrow, oftStore: oftStorePda(escrow, programId) }
}

export function grsConfigPda(oftStore: PublicKey, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('grs'), oftStore.toBuffer()], programId)[0]
}

export function saleRegistryPda(oftStore: PublicKey, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('sales'), oftStore.toBuffer()], programId)[0]
}

export function salePda(oftStore: PublicKey, id: bigint | number, programId: PublicKey): PublicKey {
  const idBuf = Buffer.alloc(8)
  idBuf.writeBigUInt64LE(BigInt(id))
  return PublicKey.findProgramAddressSync([Buffer.from('sale'), oftStore.toBuffer(), idBuf], programId)[0]
}

export function saleEscrowPda(oftStore: PublicKey, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('sale_escrow'), oftStore.toBuffer()], programId)[0]
}

export function peerRegistryPda(oftStore: PublicKey, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('peers'), oftStore.toBuffer()], programId)[0]
}

export function vestingPda(oftStore: PublicKey, id: bigint | number, programId: PublicKey): PublicKey {
  const idBuf = Buffer.alloc(8)
  idBuf.writeBigUInt64LE(BigInt(id))
  return PublicKey.findProgramAddressSync([Buffer.from('vest'), oftStore.toBuffer(), idBuf], programId)[0]
}

export function vestEscrowPda(oftStore: PublicKey, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('vest_escrow'), oftStore.toBuffer()], programId)[0]
}

export function peerConfigPda(oftStore: PublicKey, eid: number, programId: PublicKey): PublicKey {
  const eidBuf = Buffer.alloc(4)
  eidBuf.writeUInt32BE(eid)
  return PublicKey.findProgramAddressSync([Buffer.from('Peer'), oftStore.toBuffer(), eidBuf], programId)[0]
}

export function resolveGrsSolanaPdas(config: GrsSolanaConfig) {
  const { programId, oftStore } = config
  return {
    oftStore,
    grsConfig: grsConfigPda(oftStore, programId),
    saleRegistry: saleRegistryPda(oftStore, programId),
    saleEscrow: saleEscrowPda(oftStore, programId),
    peerRegistry: peerRegistryPda(oftStore, programId),
    vestEscrow: vestEscrowPda(oftStore, programId),
  }
}
