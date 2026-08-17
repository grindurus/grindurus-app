import { GRS_DECIMALS } from './constants'

export type GrsCapGate = 0 | 1 | 2 | 3
export type GrsCapJump = 'sales' | 'vesting' | null

export type GrsCapBucketSpec = {
  bucket: number
  label: string
  short: string
  millions: number
  pct: number
  gate: GrsCapGate
  jump: GrsCapJump
}

export type GrsCapGroupSpec = {
  id: string
  label: string
  millions: number
  pct: number
  buckets: GrsCapBucketSpec[]
}

/** Genesis cap table from `GRS.md` / `grs.svg`: 1B on home, five groups of 20%. */
export const GRS_CAP_GROUPS: GrsCapGroupSpec[] = [
  {
    id: 'investments',
    label: 'Investments',
    millions: 200,
    pct: 20,
    buckets: [
      { bucket: 0, label: 'Token sales', short: 'Sales', millions: 150, pct: 15, gate: 0, jump: 'sales' },
      { bucket: 1, label: 'Pre-seed', short: 'Pre-seed', millions: 50, pct: 5, gate: 1, jump: 'vesting' },
    ],
  },
  {
    id: 'affiliates',
    label: 'Affiliates',
    millions: 200,
    pct: 20,
    buckets: [
      { bucket: 2, label: 'Revenue share', short: 'Rev share', millions: 150, pct: 15, gate: 2, jump: null },
      { bucket: 3, label: 'Airdrops', short: 'Airdrop', millions: 50, pct: 5, gate: 2, jump: null },
    ],
  },
  {
    id: 'team',
    label: 'Team',
    millions: 200,
    pct: 20,
    buckets: [
      { bucket: 4, label: 'Core team', short: 'Core', millions: 150, pct: 15, gate: 1, jump: 'vesting' },
      { bucket: 5, label: 'Advisors', short: 'Advisors', millions: 50, pct: 5, gate: 1, jump: 'vesting' },
    ],
  },
  {
    id: 'ecosystem',
    label: 'Ecosystem',
    millions: 200,
    pct: 20,
    buckets: [
      { bucket: 6, label: 'Growth fund', short: 'Growth', millions: 100, pct: 10, gate: 3, jump: null },
      { bucket: 7, label: 'LP / MM', short: 'LP', millions: 100, pct: 10, gate: 2, jump: null },
    ],
  },
  {
    id: 'foundation',
    label: 'Foundation',
    millions: 200,
    pct: 20,
    buckets: [
      { bucket: 8, label: 'Long-term reserve', short: 'Reserve', millions: 150, pct: 15, gate: 3, jump: null },
      { bucket: 9, label: 'Audits', short: 'Audits', millions: 30, pct: 3, gate: 3, jump: null },
      { bucket: 10, label: 'Legal', short: 'Legal', millions: 20, pct: 2, gate: 3, jump: null },
    ],
  },
]

/** TGE (M0): 200M free float, 400M gated, 400M locked. */
export const GRS_TGE_SPLIT = [
  { id: 'float', label: 'TGE float', millions: 200, pct: 20, hint: 'Sales 150M + Foundation 50M, unlocked at TGE' },
  { id: 'gated', label: 'Gated', millions: 400, pct: 40, hint: 'Revenue share, airdrops, growth, LP — allocated, not free float' },
  { id: 'locked', label: 'Locked', millions: 400, pct: 40, hint: '250M calendar vest + 150M Foundation vote-gated' },
] as const

export const GRS_CAP_SUPPLY_MILLIONS = 1000

const MILLION = 1_000_000n
const PCT_MICROS = 1_000_000n

export function millionsToRaw(millions: number, decimals = GRS_DECIMALS): bigint {
  return BigInt(millions) * MILLION * 10n ** BigInt(decimals)
}

/** `spent / cap * 100`, rounded half-up, always 6 fraction digits. */
export function formatUsedPercent(spent: bigint, cap: bigint): string {
  if (cap <= 0n || spent <= 0n) return '0.000000'
  const bounded = spent > cap ? cap : spent
  const micro = (bounded * 100n * PCT_MICROS + cap / 2n) / cap
  const capped = micro > 100n * PCT_MICROS ? 100n * PCT_MICROS : micro
  const whole = capped / PCT_MICROS
  const frac = (capped % PCT_MICROS).toString().padStart(6, '0')
  return `${whole}.${frac}`
}

export function formatGrsCompact(raw: bigint, decimals = GRS_DECIMALS): string {
  if (raw <= 0n) return '0'
  const tokens = raw / 10n ** BigInt(decimals)
  if (tokens >= 1_000_000_000n) {
    const whole = tokens / 1_000_000_000n
    const rem = tokens % 1_000_000_000n
    if (rem === 0n) return `${whole}B`
    return `${(Number(tokens) / 1e9).toFixed(2).replace(/\.?0+$/, '')}B`
  }
  if (tokens >= 1_000_000n) {
    const whole = tokens / MILLION
    const rem = tokens % MILLION
    if (rem === 0n) return `${whole}M`
    return `${(Number(tokens) / 1e6).toFixed(1).replace(/\.0$/, '')}M`
  }
  if (tokens >= 1_000n) {
    return `${(Number(tokens) / 1e3).toFixed(tokens >= 10_000n ? 0 : 1).replace(/\.0$/, '')}K`
  }
  return tokens.toString()
}
