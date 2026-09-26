import aaveSvg from '@landing/assets/token-aave.svg'
import usdcSvg from '@landing/assets/token-usdc.svg'
import usdtSvg from '@landing/assets/token-usdt.svg'
import uniSvg from '@landing/assets/token-uni.svg'
import wethSvg from '@landing/assets/token-weth.svg'
import ethSvg from '@landing/assets/token-eth.svg'
import solSvg from '@landing/assets/token-sol.svg'
import btcSvg from '@landing/assets/token-btc.svg'
import polSvg from '@landing/assets/token-pol.svg'
import grindurusLogo from '@landing/assets/logo.png'
import arbitrumLogo from '@landing/assets/arbitrum-logo.svg'

export interface OrbitToken {
  symbol: string
  color: string
  /** fraction of icon to show (for non-square logos) */
  imgSize?: number
  src: string
}

/**
 * Tokens that orbit the hero lemniscate.
 * Repeating the set (×4) gives us 20 evenly-distributed logos – same density as ICP landing.
 */
const BASE_TOKENS: OrbitToken[] = [
  { symbol: 'AAVE', color: '#2ebac6', src: aaveSvg },
  { symbol: 'USDT', color: '#26a17b', src: usdtSvg },
  { symbol: 'UNI', color: '#ff007a', src: uniSvg, imgSize: 0.80 },
  { symbol: 'USDC', color: '#2775ca', src: usdcSvg },
  { symbol: 'WETH', color: '#627eea', src: wethSvg, imgSize: 0.70 },
]

export const ORBIT_TOKENS: OrbitToken[] = [
  ...BASE_TOKENS, // offset 0
  ...BASE_TOKENS.slice(2).concat(BASE_TOKENS.slice(0, 2)), // offset 2
  ...BASE_TOKENS.slice(4).concat(BASE_TOKENS.slice(0, 4)), // offset 4
  ...BASE_TOKENS.slice(1).concat(BASE_TOKENS.slice(0, 1)), // offset 1
]

/** Purchasable hero ad-slot placements with live-style volatility metrics. */
export interface TokenAdSlot {
  id: string
  symbol: string
  src: string
  imgSize?: number
  /** logo.png has a black plate — use black chip so it doesn't look like a void */
  iconBg?: 'white' | 'black'
  /** % from left of banner */
  left: string
  /** % from top of banner */
  top: string
  /** metrics column sits left or right of the icon */
  metricsSide: 'left' | 'right'
  dailyVolatilityPct: number
  annualVolatilityPct: number
  priceVolatilityYieldPct: number
}

type TokenAdSlotSeed = Omit<TokenAdSlot, 'left' | 'top' | 'metricsSide'>

/**
 * Place tokens evenly on an ellipse.
 * Angle 0 = right, progressing clockwise; first token starts at top (-90°).
 * Metrics always face the center (inward).
 */
function placeOnEllipse(
  seeds: TokenAdSlotSeed[],
  opts: {
    cx?: number
    cy?: number
    rx: number
    ry: number
    /** degrees; 0 = right, -90 = top */
    startDeg?: number
  },
): TokenAdSlot[] {
  const { cx = 50, cy = 50, rx, ry, startDeg = -90 } = opts
  const n = seeds.length
  if (n === 0) return []

  return seeds.map((seed, i) => {
    const deg = startDeg + (360 * i) / n
    const rad = (deg * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const left = cx + rx * cos
    const top = cy + ry * sin
    // Metrics grow toward center: right half → left of icon, left half → right of icon
    const metricsSide: 'left' | 'right' = cos >= 0 ? 'left' : 'right'

    return {
      ...seed,
      left: `${left.toFixed(2)}%`,
      top: `${top.toFixed(2)}%`,
      metricsSide,
    }
  })
}

const DESKTOP_SEEDS: TokenAdSlotSeed[] = [
  {
    id: 'aave',
    symbol: 'AAVE',
    src: aaveSvg,
    dailyVolatilityPct: 3.7,
    annualVolatilityPct: 70.2,
    priceVolatilityYieldPct: 48,
  },
  {
    id: 'pol',
    symbol: 'POL',
    src: polSvg,
    dailyVolatilityPct: 3.8,
    annualVolatilityPct: 72.5,
    priceVolatilityYieldPct: 48,
  },
  {
    id: 'sol',
    symbol: 'SOL',
    src: solSvg,
    imgSize: 0.92,
    dailyVolatilityPct: 4.1,
    annualVolatilityPct: 78.4,
    priceVolatilityYieldPct: 53,
  },
  {
    id: 'grindurus',
    symbol: 'GRS',
    src: grindurusLogo,
    imgSize: 1,
    iconBg: 'black',
    dailyVolatilityPct: 5.2,
    annualVolatilityPct: 99.4,
    priceVolatilityYieldPct: 62,
  },
  {
    id: 'uni',
    symbol: 'UNI',
    src: uniSvg,
    imgSize: 0.8,
    dailyVolatilityPct: 4.2,
    annualVolatilityPct: 80.1,
    priceVolatilityYieldPct: 55,
  },
  {
    id: 'btc',
    symbol: 'BTC',
    src: btcSvg,
    dailyVolatilityPct: 2.5,
    annualVolatilityPct: 48.1,
    priceVolatilityYieldPct: 42,
  },
  {
    id: 'arb',
    symbol: 'ARB',
    src: arbitrumLogo,
    dailyVolatilityPct: 4.8,
    annualVolatilityPct: 91.8,
    priceVolatilityYieldPct: 65,
  },
  {
    id: 'usdc',
    symbol: 'USDC',
    src: usdcSvg,
    dailyVolatilityPct: 0.01,
    annualVolatilityPct: 0.2,
    priceVolatilityYieldPct: 51,
  },
  {
    id: 'eth',
    symbol: 'ETH',
    src: ethSvg,
    dailyVolatilityPct: 3.4,
    annualVolatilityPct: 65.2,
    priceVolatilityYieldPct: 50,
  },
  {
    id: 'usdt',
    symbol: 'USDT',
    src: usdtSvg,
    dailyVolatilityPct: 0.01,
    annualVolatilityPct: 0.2,
    priceVolatilityYieldPct: 51,
  },
]

/** Desktop hero — 10 slots on a wide oval around the headline. */
export const TOKEN_AD_SLOTS: TokenAdSlot[] = placeOnEllipse(DESKTOP_SEEDS, {
  rx: 46,
  ry: 40,
  startDeg: -90,
})

const MOBILE_SEEDS: TokenAdSlotSeed[] = DESKTOP_SEEDS.map((seed) => ({
  ...seed,
  id: `${seed.id}-m`,
}))

/** Mobile strip — same tokens as desktop on a tighter oval. */
export const TOKEN_AD_SLOTS_MOBILE: TokenAdSlot[] = placeOnEllipse(MOBILE_SEEDS, {
  rx: 38,
  ry: 34,
  startDeg: -90,
})

export function formatAdPct(value: number, signed = false): string {
  const digits = value < 1 ? 2 : 1
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: value < 1 ? 2 : 0,
    maximumFractionDigits: digits,
  })
  if (signed) return `+${formatted}%`
  return `${formatted}%`
}
