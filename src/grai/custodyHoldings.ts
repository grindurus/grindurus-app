import type { SolanaCluster } from '../wallets/AppWalletProvider'
import type { CustodyAssetBalances } from './fetchCustodyWalletBalances'
import { NATIVE_MINT, resolveGraiAsset, type GraiAsset } from './knownMints'
import { resolveGrinderCustodyWallet } from './grinders'

/** Matches backend `networkType`. */
export type CustodyNetworkType = 'solana' | 'evm'

/** Matches backend `network` identifiers. */
export type CustodyNetwork =
  | 'solana-mainnet'
  | 'solana-devnet'
  | 'solana-testnet'
  | 'ethereum'
  | 'arbitrum'
  | 'base'
  | 'sepolia'
  | 'base-sepolia'

/** Raw holding row from backend API. Amounts are decimal strings for JSON transport. */
export type CustodyHoldingDto = {
  networkType: CustodyNetworkType
  network: CustodyNetwork
  address: string
  assetId: string
  symbol: string
  balanceRaw: string
  yieldRaw: string
  allocatedRaw?: string
  decimals: number
}

export type GrinderCustodyHoldingsDto = {
  grinderId: string
  holdings: CustodyHoldingDto[]
}

export type NormalizedCustodyHolding = {
  key: string
  networkType: CustodyNetworkType
  network: CustodyNetwork
  address: string
  asset: GraiAsset
  balanceRaw: bigint
  yieldRaw: bigint
  allocatedRaw: bigint
  decimals: number
}

const DEVNET_USDC = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'

/** Placeholder until backend endpoint is wired. */
const MOCK_GRINDER_CUSTODY_HOLDINGS: Record<string, CustodyHoldingDto[]> = {
  grinder1: [
    {
      networkType: 'solana',
      network: 'solana-devnet',
      address: resolveGrinderCustodyWallet('grinder1') ?? '',
      assetId: NATIVE_MINT,
      symbol: 'SOL',
      balanceRaw: '2500000000',
      yieldRaw: '120000000',
      allocatedRaw: '500000000',
      decimals: 9,
    },
    {
      networkType: 'solana',
      network: 'solana-devnet',
      address: resolveGrinderCustodyWallet('grinder1') ?? '',
      assetId: DEVNET_USDC,
      symbol: 'USDC',
      balanceRaw: '1842500000',
      yieldRaw: '32500000',
      allocatedRaw: '100000000',
      decimals: 6,
    },
  ],
}

export function solanaClusterToCustodyNetwork(cluster: SolanaCluster): CustodyNetwork {
  if (cluster === 'mainnet-beta') return 'solana-mainnet'
  if (cluster === 'testnet') return 'solana-testnet'
  return 'solana-devnet'
}

export function custodyHoldingKey(holding: Pick<CustodyHoldingDto, 'networkType' | 'network' | 'address' | 'assetId'>): string {
  return `${holding.networkType}:${holding.network}:${holding.address}:${holding.assetId}`
}

function parseRawAmount(value: string | undefined): bigint {
  if (!value?.trim()) return 0n
  try {
    return BigInt(value.trim())
  } catch {
    return 0n
  }
}

function normalizeDto(holding: CustodyHoldingDto): NormalizedCustodyHolding {
  return {
    key: custodyHoldingKey(holding),
    networkType: holding.networkType,
    network: holding.network,
    address: holding.address,
    asset: resolveGraiAsset(holding.assetId),
    balanceRaw: parseRawAmount(holding.balanceRaw),
    yieldRaw: parseRawAmount(holding.yieldRaw),
    allocatedRaw: parseRawAmount(holding.allocatedRaw),
    decimals: holding.decimals,
  }
}

function onChainToHolding(
  mint: string,
  entry: CustodyAssetBalances,
  custodyAddress: string,
  solanaNetwork: CustodyNetwork,
): NormalizedCustodyHolding {
  return {
    key: custodyHoldingKey({
      networkType: 'solana',
      network: solanaNetwork,
      address: custodyAddress,
      assetId: mint,
    }),
    networkType: 'solana',
    network: solanaNetwork,
    address: custodyAddress,
    asset: resolveGraiAsset(mint),
    balanceRaw: entry.balanceRaw,
    yieldRaw: entry.yieldRaw,
    allocatedRaw: entry.allocatedRaw,
    decimals: entry.decimals,
  }
}

export function hasCustodyHoldingActivity(holding: Pick<NormalizedCustodyHolding, 'balanceRaw' | 'yieldRaw' | 'allocatedRaw'>): boolean {
  return holding.balanceRaw > 0n || holding.yieldRaw > 0n || holding.allocatedRaw > 0n
}

/**
 * Merge backend custody rows with live Solana on-chain balances.
 * On-chain Solana rows win when the mint + address match.
 */
export function mergeGrinderCustodyHoldings(params: {
  backendHoldings: CustodyHoldingDto[]
  onChainBalances: Record<string, CustodyAssetBalances>
  custodyAddress: string
  solanaNetwork: CustodyNetwork
}): NormalizedCustodyHolding[] {
  const { backendHoldings, onChainBalances, custodyAddress, solanaNetwork } = params
  const merged = new Map<string, NormalizedCustodyHolding>()

  for (const holding of backendHoldings) {
    merged.set(custodyHoldingKey(holding), normalizeDto(holding))
  }

  for (const [mint, entry] of Object.entries(onChainBalances)) {
    const normalized = onChainToHolding(mint, entry, custodyAddress, solanaNetwork)
    merged.set(normalized.key, normalized)
  }

  return [...merged.values()].filter(hasCustodyHoldingActivity)
}

/**
 * Fetch grinder custody holdings from backend.
 * Replace mock implementation with `fetch('/api/grinders/custody-holdings')` when ready.
 */
export async function fetchGrinderCustodyHoldings(grinderIds: string[]): Promise<GrinderCustodyHoldingsDto[]> {
  await Promise.resolve()

  return grinderIds.flatMap((grinderId) => {
    const holdings = MOCK_GRINDER_CUSTODY_HOLDINGS[grinderId]
    if (!holdings?.length) return []
    return [{ grinderId, holdings }]
  })
}

export function indexGrinderCustodyHoldings(
  rows: GrinderCustodyHoldingsDto[],
): Record<string, CustodyHoldingDto[]> {
  return Object.fromEntries(rows.map((row) => [row.grinderId, row.holdings]))
}
