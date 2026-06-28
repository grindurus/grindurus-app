export const NATIVE_MINT = 'So11111111111111111111111111111111111111112'

export type GraiAssetIcon = {
  src: string
  alt: string
}

export type GraiAsset = {
  mint: string
  symbol: string
  icon: GraiAssetIcon
}

const COINGECKO = {
  usdc: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  sol: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  usdt: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  eth: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  btc: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  arb: 'https://assets.coingecko.com/coins/images/16547/small/arb.jpg',
  matic: 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
} as const

export const KNOWN_MINT_METADATA: Record<string, { symbol: string; icon: GraiAssetIcon }> = {
  [NATIVE_MINT]: { symbol: 'SOL', icon: { src: COINGECKO.sol, alt: 'SOL' } },
  // Circle USDC mainnet
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
    symbol: 'USDC',
    icon: { src: COINGECKO.usdc, alt: 'USDC' },
  },
  // Circle USDC devnet
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU': {
    symbol: 'USDC',
    icon: { src: COINGECKO.usdc, alt: 'USDC' },
  },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: {
    symbol: 'USDT',
    icon: { src: COINGECKO.usdt, alt: 'USDT' },
  },
}

export const FALLBACK_GRAI_ASSETS: GraiAsset[] = [
  { mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', symbol: 'USDC', icon: { src: COINGECKO.usdc, alt: 'USDC' } },
  { mint: NATIVE_MINT, symbol: 'SOL', icon: { src: COINGECKO.sol, alt: 'SOL' } },
  { mint: 'mock-usdt', symbol: 'USDT', icon: { src: COINGECKO.usdt, alt: 'USDT' } },
  { mint: 'mock-eth', symbol: 'ETH', icon: { src: COINGECKO.eth, alt: 'ETH' } },
  { mint: 'mock-btc', symbol: 'BTC', icon: { src: COINGECKO.btc, alt: 'BTC' } },
  { mint: 'mock-arb', symbol: 'ARB', icon: { src: COINGECKO.arb, alt: 'ARB' } },
  { mint: 'mock-matic', symbol: 'MATIC', icon: { src: COINGECKO.matic, alt: 'MATIC' } },
]

export function resolveGraiAsset(mint: string): GraiAsset {
  const known = KNOWN_MINT_METADATA[mint]
  if (known) {
    return { mint, symbol: known.symbol, icon: known.icon }
  }

  const short = `${mint.slice(0, 4)}…${mint.slice(-4)}`
  return {
    mint,
    symbol: short.toUpperCase(),
    icon: { src: COINGECKO.usdc, alt: short },
  }
}
