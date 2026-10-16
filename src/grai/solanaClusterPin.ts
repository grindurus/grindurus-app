/**
 * TEMPORARY — GRAI Solana is Devnet-only until mainnet contracts ship.
 *
 * To unlock Solana mainnet later:
 * 1. Set `GRAI_SOLANA_DEVNET_ONLY` to `false` (or delete this file)
 * 2. Remove `<GraiSolanaDevnetPin />` from `GraiDeploymentProvider`
 * 3. Set `VITE_GRAI_MAINNET_MINT` (+ RPC) in env
 */
export const GRAI_SOLANA_DEVNET_ONLY = true

/** Active pin target, or `null` when Solana mainnet GRAI is allowed. */
export function pinnedGraiSolanaCluster(): 'devnet' | null {
  return GRAI_SOLANA_DEVNET_ONLY ? 'devnet' : null
}
