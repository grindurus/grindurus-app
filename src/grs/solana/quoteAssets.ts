import { PublicKey } from '@solana/web3.js'
import { getAddress } from 'viem'
import { KNOWN_MINT_METADATA } from '../../grai/knownMints'

/** Circle USDC (Solana mainnet). */
export const SOLANA_USDC_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
/** Circle USDC (Solana devnet). */
export const SOLANA_USDC_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'

const USDC_ICON = 'https://assets.coingecko.com/coins/images/6319/small/usdc.png'
const SOL_ICON = 'https://assets.coingecko.com/coins/images/4128/small/solana.png'

const EVM_USDC: Record<number, string> = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
}

export function solanaUsdcMint(cluster: string | undefined): string {
  return cluster === 'mainnet-beta' ? SOLANA_USDC_MAINNET : SOLANA_USDC_DEVNET
}

/** EVM address left-padded into a 32-byte Solana pubkey (invalid SPL mint). */
export function isEvmPackedPubkey(key: PublicKey): boolean {
  const bytes = key.toBytes()
  const prefixZero = bytes.subarray(0, 12).every((b) => b === 0)
  const suffixNonZero = bytes.subarray(12).some((b) => b !== 0)
  return prefixZero && suffixNonZero
}

export function evmAddressFromPackedPubkey(key: PublicKey): `0x${string}` | null {
  if (!isEvmPackedPubkey(key)) return null
  const hex = `0x${Buffer.from(key.toBytes().subarray(12)).toString('hex')}`
  try {
    return getAddress(hex)
  } catch {
    return null
  }
}

export function resolveSolanaSaleQuoteMeta(asset: PublicKey): {
  quoteSymbol: string
  quoteDecimals: number
  quoteIcon: string
  native: boolean
  /** True when asset is an EVM address packed as pubkey — cannot pay with SPL. */
  unpayableEvmAsset: boolean
} {
  if (asset.equals(PublicKey.default)) {
    return {
      quoteSymbol: 'SOL',
      quoteDecimals: 9,
      quoteIcon: SOL_ICON,
      native: true,
      unpayableEvmAsset: false,
    }
  }

  const mint = asset.toBase58()
  const known = KNOWN_MINT_METADATA[mint]
  if (known) {
    return {
      quoteSymbol: known.symbol,
      quoteDecimals: known.symbol === 'USDC' || known.symbol === 'USDT' ? 6 : 9,
      quoteIcon: known.icon.src,
      native: false,
      unpayableEvmAsset: false,
    }
  }

  const evm = evmAddressFromPackedPubkey(asset)
  if (evm) {
    const usdc = Object.values(EVM_USDC).some((a) => a.toLowerCase() === evm.toLowerCase())
    return {
      quoteSymbol: usdc ? 'USDC (EVM)' : 'token (EVM)',
      quoteDecimals: 6,
      quoteIcon: USDC_ICON,
      native: false,
      unpayableEvmAsset: true,
    }
  }

  return {
    quoteSymbol: 'token',
    quoteDecimals: 6,
    quoteIcon: USDC_ICON,
    native: false,
    unpayableEvmAsset: false,
  }
}
