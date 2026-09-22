import binanceLogo from '@landing/assets/binance-logo.png'
import cowLogo from '@landing/assets/cow-logo.png'
import arbitrumLogo from '@landing/assets/arbitrum-logo.svg'
import logoLifiDark from '@landing/assets/logo_lifi_dark.svg'
import logoLifiLight from '@landing/assets/logo_lifi_light.svg'

export interface Partner {
  id: string
  name: string
  href: string
  img: string
  imgLight?: string
}

export const INTEGRATED_PARTNERS: Partner[] = [
  {
    id: 'ethereum',
    name: 'ETHEREUM',
    href: 'https://ethereum.org',
    img: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  },
  {
    id: 'arbitrum',
    name: 'ARBITRUM',
    href: 'https://arbitrum.io',
    img: arbitrumLogo,
  },
  {
    id: 'binance',
    name: 'BINANCE',
    href: 'https://binance.com',
    img: binanceLogo,
  },
  {
    id: 'cow',
    name: 'COW PROTOCOL',
    href: 'https://cow.fi',
    img: cowLogo,
  },
  {
    id: 'solana',
    name: 'SOLANA',
    href: 'https://solana.com',
    img: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  },
  {
    id: 'lifi',
    name: 'LI.FI',
    href: 'https://li.fi',
    img: logoLifiDark,
    imgLight: logoLifiLight,
  },
]
