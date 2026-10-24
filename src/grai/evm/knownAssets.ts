import type { GraiAsset, GraiAssetIcon } from '../knownMints'
import { NATIVE_EVM_ASSET } from './constants'
import wethPng from '../../assets/token-weth.png'

const COINGECKO = {
  usdc: 'https://assets.coingecko.com/coins/images/6319/large/usdc.png',
  eth: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
  usdt: 'https://assets.coingecko.com/coins/images/325/large/Tether.png',
} as const

/** CryptoRank WETH mark (bundled locally). */
const WETH_ICON: GraiAssetIcon = { src: wethPng, alt: 'WETH' }

export const KNOWN_EVM_ASSET_METADATA: Record<string, { symbol: string; icon: GraiAssetIcon }> = {
  [NATIVE_EVM_ASSET]: { symbol: 'ETH', icon: { src: COINGECKO.eth, alt: 'ETH' } },
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
    symbol: 'USDC',
    icon: { src: COINGECKO.usdc, alt: 'USDC' },
  },
  '0x1c7d4b196cb0c7b98cdad4a398ef40f4bd30d3a9': {
    symbol: 'USDC',
    icon: { src: COINGECKO.usdc, alt: 'USDC' },
  },
  '0xdac17f958d2ee523a2206206994597c13d831ec7': {
    symbol: 'USDT',
    icon: { src: COINGECKO.usdt, alt: 'USDT' },
  },
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': {
    symbol: 'WETH',
    icon: WETH_ICON,
  },
  '0x4200000000000000000000000000000000000006': {
    symbol: 'WETH',
    icon: WETH_ICON,
  },
  // Arbitrum One
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831': {
    symbol: 'USDC',
    icon: { src: COINGECKO.usdc, alt: 'USDC' },
  },
  '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': {
    symbol: 'WETH',
    icon: WETH_ICON,
  },
}

export function normalizeEvmAssetAddress(address: string): string {
  return address.toLowerCase()
}

export function isNativeEvmAsset(address: string): boolean {
  return normalizeEvmAssetAddress(address) === NATIVE_EVM_ASSET
}

export function resolveEvmGraiAsset(address: string): GraiAsset {
  const normalized = normalizeEvmAssetAddress(address)
  const known = KNOWN_EVM_ASSET_METADATA[normalized]
  if (known) {
    return { mint: normalized, symbol: known.symbol, icon: known.icon }
  }

  const short = `${address.slice(0, 6)}…${address.slice(-4)}`
  return {
    mint: normalized,
    symbol: short.toUpperCase(),
    icon: { src: COINGECKO.usdc, alt: short },
  }
}
