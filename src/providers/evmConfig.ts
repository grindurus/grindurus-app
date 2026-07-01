import { createConfig, http } from 'wagmi'
import { mainnet, base, arbitrum, sepolia, baseSepolia } from 'wagmi/chains'
import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import { metaMaskWallet, walletConnectWallet } from '@rainbow-me/rainbowkit/wallets'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo-project-id'

if (import.meta.env.DEV && projectId === 'demo-project-id') {
  console.warn('[GRAI] VITE_WALLETCONNECT_PROJECT_ID is missing; WalletConnect will not work.')
}

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [metaMaskWallet, walletConnectWallet],
    },
  ],
  {
    appName: 'GRAI',
    projectId,
  },
)

export const wagmiConfig = createConfig({
  connectors,
  chains: [mainnet, base, arbitrum, sepolia, baseSepolia],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
  },
})
