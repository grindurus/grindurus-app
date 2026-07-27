import { Connection, PublicKey } from '@solana/web3.js'
import type { GraiSolanaConfig } from './deployments'
import { fetchGraiProtocol, type GraiStateFixedFields } from './fetchGraiProtocol'

export type { GraiStateFixedFields }

export async function fetchGraiStateFixedFields(
  connection: Connection,
  config: GraiSolanaConfig,
): Promise<GraiStateFixedFields> {
  const protocol = await fetchGraiProtocol(connection, config.graiMint)
  return {
    authority: protocol.authority,
    treasury: protocol.treasury,
    treasuryWallet: protocol.treasury,
    grinders: protocol.grinders,
    settlementAsset: protocol.settlementAsset,
  }
}

export async function fetchGraiStateAssetMints(
  connection: Connection,
  config: GraiSolanaConfig,
): Promise<PublicKey[]> {
  const protocol = await fetchGraiProtocol(connection, config.graiMint)
  return protocol.assetMints
}

export { clearGraiProtocolCache as clearGraiStateCache } from './fetchGraiProtocol'
