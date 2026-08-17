export const GRS_DECIMALS = 18
export const GRS_MAX_SUPPLY = 1_000_000_000n * 10n ** 18n
export const NATIVE_QUOTE = '0x0000000000000000000000000000000000000000' as const

export const TOKEN_SALES_BUCKET = 0
export const HOLDER_BUCKET = 11

export const BUCKET_LABELS = [
  'Token sales',
  'Pre-seed',
  'Revenue share',
  'Airdrops',
  'Core team',
  'Advisors',
  'Growth fund',
  'LP / MM',
  'Long-term reserve',
  'Audits',
  'Legal',
  'Holder',
] as const

export const GATE_LABELS = ['Instant', 'Linear', 'Proprietary', 'Vote-gated'] as const

export const MAX_CLIFF_SECONDS = 365 * 24 * 60 * 60
export const MAX_DURATION_SECONDS = 4 * 365 * 24 * 60 * 60

/** LayerZero V2 endpoint ids used by GRS OFT peers. */
export const LZ_EID_BY_CHAIN_ID: Record<number, number> = {
  1: 30101,
  42161: 30110,
  8453: 30184,
  11155111: 40161,
  84532: 40245,
  421614: 40231,
}

export type LzEndpointMeta = {
  name: string
  chainId?: number
  solana?: boolean
}

export const LZ_EID_META: Record<number, LzEndpointMeta> = {
  30101: { name: 'Ethereum', chainId: 1 },
  30110: { name: 'Arbitrum', chainId: 42161 },
  30184: { name: 'Base', chainId: 8453 },
  30102: { name: 'BNB Chain' },
  30106: { name: 'Avalanche' },
  30111: { name: 'Optimism' },
  30109: { name: 'Polygon' },
  30168: { name: 'Solana', solana: true },
  40161: { name: 'Sepolia', chainId: 11155111 },
  40245: { name: 'Base Sepolia', chainId: 84532 },
  40231: { name: 'Arbitrum Sepolia', chainId: 421614 },
  40168: { name: 'Solana Devnet', solana: true },
}

export function lzEndpointLabel(eid: number): string {
  return LZ_EID_META[eid]?.name ?? `Endpoint ${eid}`
}

export function isSolanaLzEid(eid: number): boolean {
  return LZ_EID_META[eid]?.solana === true
}

export function isTestnetChainId(chainId: number): boolean {
  return chainId === 11155111 || chainId === 84532 || chainId === 421614
}

export type GrsBridgeDestination = {
  eid: number
  name: string
  chainId?: number
  solana?: boolean
}

export const GRS_BRIDGE_DESTINATIONS: GrsBridgeDestination[] = [
  { eid: 30101, name: 'Ethereum', chainId: 1 },
  { eid: 30110, name: 'Arbitrum', chainId: 42161 },
  { eid: 30184, name: 'Base', chainId: 8453 },
  { eid: 30168, name: 'Solana', solana: true },
  { eid: 40161, name: 'Sepolia', chainId: 11155111 },
  { eid: 40245, name: 'Base Sepolia', chainId: 84532 },
  { eid: 40168, name: 'Solana Devnet', solana: true },
]

export const GRS_BRIDGE_SOURCES: { chainId: number; name: string }[] = [
  { chainId: 1, name: 'Ethereum' },
  { chainId: 8453, name: 'Base' },
  { chainId: 42161, name: 'Arbitrum' },
  { chainId: 11155111, name: 'Sepolia' },
  { chainId: 84532, name: 'Base Sepolia' },
]

export function bucketLabel(bucket: number): string {
  return BUCKET_LABELS[bucket] ?? `Bucket ${bucket}`
}
