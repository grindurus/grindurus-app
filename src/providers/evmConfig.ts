import { createConfig } from 'wagmi'
import { mainnet, base, arbitrum, sepolia } from 'wagmi/chains'
import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import { metaMaskWallet, walletConnectWallet } from '@rainbow-me/rainbowkit/wallets'
import { evmHttpTransport } from './evmTransports'

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
  // Moves Hydrate.onMount into useEffect so reconnect does not setState during render
  // when AppWalletProvider re-renders (e.g. selecting MetaMask → setSelectedChainType).
  ssr: true,
  connectors,
  chains: [mainnet, base, arbitrum, sepolia],
  transports: {
    [mainnet.id]: evmHttpTransport(mainnet.id),
    [base.id]: evmHttpTransport(base.id),
    [arbitrum.id]: evmHttpTransport(arbitrum.id),
    [sepolia.id]: evmHttpTransport(sepolia.id),
  },
})
