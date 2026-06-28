import { createGraiRegistryConnection } from './constants'
import { fetchGraiStateAssetMints } from './graiStateCache'
import { resolveGraiAsset, type GraiAsset } from './knownMints'

export async function fetchGraiRegistryAssetMints(
  connection = createGraiRegistryConnection(),
) {
  return fetchGraiStateAssetMints(connection)
}

export async function fetchGraiRegistryAssets(): Promise<GraiAsset[]> {
  const connection = createGraiRegistryConnection()
  const assetMints = await fetchGraiRegistryAssetMints(connection)
  return assetMints.map((mint) => resolveGraiAsset(mint.toBase58()))
}
