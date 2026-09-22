import aaveSvg  from '@landing/assets/token-aave.svg'
import usdcSvg  from '@landing/assets/token-usdc.svg'
import usdtSvg  from '@landing/assets/token-usdt.svg'
import uniSvg   from '@landing/assets/token-uni.svg'
import wethSvg  from '@landing/assets/token-weth.svg'

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
  { symbol: 'AAVE',  color: '#2ebac6', src: aaveSvg },
  { symbol: 'USDT',  color: '#26a17b', src: usdtSvg },
  { symbol: 'UNI',   color: '#ff007a', src: uniSvg,  imgSize: 0.80 },
  { symbol: 'USDC',  color: '#2775ca', src: usdcSvg },
  { symbol: 'WETH',  color: '#627eea', src: wethSvg, imgSize: 0.70 },
]

export const ORBIT_TOKENS: OrbitToken[] = [
  ...BASE_TOKENS,                                          // offset 0
  ...BASE_TOKENS.slice(2).concat(BASE_TOKENS.slice(0, 2)), // offset 2
  ...BASE_TOKENS.slice(4).concat(BASE_TOKENS.slice(0, 4)), // offset 4
  ...BASE_TOKENS.slice(1).concat(BASE_TOKENS.slice(0, 1)), // offset 1
]
