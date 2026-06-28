import type { GraiSolanaConfig } from './deployments'
import { fetchGraiStateAssetMints } from './graiStateCache'
import { resolveGraiAsset, type GraiAsset } from './knownMints'

export async function fetchGraiRegistryAssetMints(
  connection: Parameters<typeof fetchGraiStateAssetMints>[0],
  config: GraiSolanaConfig,
) {
  return fetchGraiStateAssetMints(connection, config)
}

export async function fetchGraiRegistryAssets(
  connection: Parameters<typeof fetchGraiStateAssetMints>[0],
  config: GraiSolanaConfig,
): Promise<GraiAsset[]> {
  const assetMints = await fetchGraiRegistryAssetMints(connection, config)
  return assetMints.map((mint) => resolveGraiAsset(mint.toBase58()))
}
