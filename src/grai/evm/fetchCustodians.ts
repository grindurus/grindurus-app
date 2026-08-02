import { erc20Abi, zeroAddress, type Hex } from 'viem'
import type { GraiEvmConfig } from '../deployments'
import type { NormalizedCustodyHolding } from '../custodyHoldings'
import type { GrinderCustodyState } from '../grinderCustodyState'
import { graiAbi, grindersAbi } from './abi'
import { createGraiEvmPublicClient, resolveGraiContractAddress } from './client'
import { NATIVE_EVM_ASSET } from './constants'
import { KNOWN_CUSTODIAN_KINDS } from './custodianKinds'
import { isNativeEvmAsset, resolveEvmGraiAsset } from './knownAssets'

export type EvmCustodianData = {
  custodian: `0x${string}`
  id: bigint
  owner: `0x${string}`
  kind: Hex
  baseAsset: `0x${string}`
  quoteAsset: `0x${string}`
  ethBalance: bigint
  baseBalance: bigint
  quoteBalance: bigint
}

function custodyNetworkForChainId(chainId: number): NormalizedCustodyHolding['network'] {
  if (chainId === 1) return 'ethereum'
  if (chainId === 42161) return 'arbitrum'
  if (chainId === 8453) return 'base'
  if (chainId === 11155111) return 'sepolia'
  if (chainId === 84532) return 'base-sepolia'
  return 'ethereum'
}

function kindLabel(kind: Hex): string {
  const known = KNOWN_CUSTODIAN_KINDS.find((entry) => entry.kindHash === kind)
  return known?.label ?? 'Custodian'
}

async function readDecimals(
  client: ReturnType<typeof createGraiEvmPublicClient>,
  asset: `0x${string}`,
  cache: Map<string, number>,
): Promise<number> {
  const key = asset.toLowerCase()
  const cached = cache.get(key)
  if (cached !== undefined) return cached
  if (isNativeEvmAsset(asset)) {
    cache.set(key, 18)
    return 18
  }
  try {
    const decimals = await client.readContract({
      address: asset,
      abi: erc20Abi,
      functionName: 'decimals',
    })
    const value = Number(decimals)
    cache.set(key, value)
    return value
  } catch {
    cache.set(key, 18)
    return 18
  }
}

function holdingKey(network: string, address: string, assetId: string): string {
  return `${network}:${address.toLowerCase()}:${assetId.toLowerCase()}`
}

async function toHoldings(
  client: ReturnType<typeof createGraiEvmPublicClient>,
  config: GraiEvmConfig,
  row: EvmCustodianData,
  decimalsCache: Map<string, number>,
): Promise<NormalizedCustodyHolding[]> {
  const network = custodyNetworkForChainId(config.chainId)
  const address = row.custodian
  const holdings: NormalizedCustodyHolding[] = []
  const seen = new Set<string>()

  const pushAsset = async (asset: `0x${string}`, balanceRaw: bigint) => {
    const assetId = isNativeEvmAsset(asset) ? NATIVE_EVM_ASSET : asset.toLowerCase()
    const key = holdingKey(network, address, assetId)
    if (seen.has(key)) return
    seen.add(key)
    const decimals = await readDecimals(client, asset, decimalsCache)
    holdings.push({
      key,
      networkType: 'evm',
      network,
      address,
      asset: resolveEvmGraiAsset(asset),
      balanceRaw,
      yieldRaw: 0n,
      allocatedRaw: 0n,
      decimals,
    })
  }

  await pushAsset(row.baseAsset, row.baseBalance)
  if (row.quoteAsset.toLowerCase() !== row.baseAsset.toLowerCase()) {
    await pushAsset(row.quoteAsset, row.quoteBalance)
  }
  if (
    row.ethBalance > 0n &&
    !isNativeEvmAsset(row.baseAsset) &&
    !isNativeEvmAsset(row.quoteAsset)
  ) {
    await pushAsset(NATIVE_EVM_ASSET, row.ethBalance)
  }

  return holdings
}

export async function fetchEvmCustodiansData(
  config: GraiEvmConfig,
  fromId = 0n,
  toId?: bigint,
): Promise<{ grindersAddress: `0x${string}`; rows: GrinderCustodyState[] }> {
  const client = createGraiEvmPublicClient(config)
  const graiAddress = resolveGraiContractAddress(config)
  const grindersAddress = await client.readContract({
    address: graiAddress,
    abi: graiAbi,
    functionName: 'grinders',
  })

  if (!grindersAddress || grindersAddress === zeroAddress) {
    throw new Error('Grinders is not set on this GRAI deployment')
  }

  const totalSupply = await client.readContract({
    address: grindersAddress,
    abi: grindersAbi,
    functionName: 'totalSupply',
  })

  if (totalSupply === 0n) {
    return { grindersAddress, rows: [] }
  }

  const end = toId === undefined || toId > totalSupply ? totalSupply : toId
  if (fromId >= end) {
    return { grindersAddress, rows: [] }
  }

  const list = await client.readContract({
    address: grindersAddress,
    abi: grindersAbi,
    functionName: 'getCustodiansData',
    args: [fromId, end],
  })

  const decimalsCache = new Map<string, number>()
  const rows: GrinderCustodyState[] = []

  for (const item of list) {
    if (!item.custodian || item.custodian === zeroAddress) continue

    const data: EvmCustodianData = {
      custodian: item.custodian,
      id: item.id,
      owner: item.owner,
      kind: item.kind,
      baseAsset: item.baseAsset,
      quoteAsset: item.quoteAsset,
      ethBalance: item.ethBalance,
      baseBalance: item.baseBalance,
      quoteBalance: item.quoteBalance,
    }

    const holdings = await toHoldings(client, config, data, decimalsCache)
    const balances: GrinderCustodyState['balances'] = {}
    for (const holding of holdings) {
      balances[holding.asset.mint] = {
        balanceRaw: holding.balanceRaw,
        allocatedRaw: holding.allocatedRaw,
        yieldRaw: holding.yieldRaw,
        decimals: holding.decimals,
      }
    }

    rows.push({
      id: `evm-${data.id.toString()}`,
      name: `${kindLabel(data.kind)} #${data.id.toString()}`,
      custodyWallet: null,
      custodyWalletAddress: data.custodian,
      balances,
      holdings,
    })
  }

  return { grindersAddress, rows }
}
