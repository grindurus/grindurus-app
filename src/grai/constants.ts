import { PublicKey } from '@solana/web3.js'
import {
  createGraiConnection,
  getDefaultGraiSolanaCluster,
  getGraiSolanaConfigOrThrow,
  graiStatePda as graiStatePdaFromDeployment,
  type GraiSolanaConfig,
} from './deployments'

export type { GraiSolanaConfig }

/** @deprecated Prefer `useGraiDeployment().solana` */
export function getDefaultGraiSolanaConfig(): GraiSolanaConfig {
  return getGraiSolanaConfigOrThrow(getDefaultGraiSolanaCluster())
}

/** @deprecated Prefer `useGraiDeployment().solana.programId` */
export const GRAI_PROGRAM_ID = getDefaultGraiSolanaConfig().programId

/** @deprecated Prefer `useGraiDeployment().connection` */
export function createGraiRegistryConnection(config: GraiSolanaConfig = getDefaultGraiSolanaConfig()) {
  return createGraiConnection(config)
}

/** @deprecated Prefer `useGraiDeployment().solana` */
export const GRAI_REGISTRY_RPC_URL = getDefaultGraiSolanaConfig().rpcUrl

export function graiStatePda(programId: PublicKey = GRAI_PROGRAM_ID): PublicKey {
  return graiStatePdaFromDeployment(programId)
}

/** @deprecated Prefer `useGraiDeployment().solana.graiMint` */
export const GRAI_MINT = getDefaultGraiSolanaConfig().graiMint
