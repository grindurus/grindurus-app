import { ReactNode, useEffect, useMemo, useState, type ComponentType } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import { resolveSolanaRpcUrl, getDefaultGraiSolanaCluster } from '../grai/deployments'
import { getSharedJsonRpcBatchFetch } from '../grai/jsonRpcBatchFetch'
import { deferAfterPaint } from '../utils/deferAfterPaint'
import { useWalletContext } from './walletContext'
import '@solana/wallet-adapter-react-ui/styles.css'

export type SolanaNetwork = 'mainnet-beta' | 'testnet' | 'devnet'

interface SolanaProviderProps {
  children: ReactNode
}

// wallet-adapter ships nested @types/react that conflict with the app's React 18 types (TS2786).
const SolanaConnectionProvider = ConnectionProvider as ComponentType<{
  endpoint: string
  config?: { commitment?: 'processed' | 'confirmed' | 'finalized'; fetch?: typeof fetch }
  children?: ReactNode
}>
const SolanaWalletProvider = WalletProvider as ComponentType<{
  wallets: Array<PhantomWalletAdapter | SolflareWalletAdapter | CoinbaseWalletAdapter>
  autoConnect?: boolean
  children?: ReactNode
}>
const SolanaWalletModalProvider = WalletModalProvider as ComponentType<{ children?: ReactNode }>

export function SolanaProvider({ children }: SolanaProviderProps) {
  const { solanaCluster } = useWalletContext()
  const cluster = solanaCluster || getDefaultGraiSolanaCluster()
  const endpoint = useMemo(() => resolveSolanaRpcUrl(cluster), [cluster])
  const connectionConfig = useMemo(
    () => ({
      commitment: 'confirmed' as const,
      fetch: getSharedJsonRpcBatchFetch(),
    }),
    [],
  )
  const [autoConnect, setAutoConnect] = useState(false)

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter(), new CoinbaseWalletAdapter()],
    [],
  )

  useEffect(() => {
    return deferAfterPaint(() => setAutoConnect(true))
  }, [])

  return (
    // Remount connection when cluster/RPC changes so wallets never stay on a stale network.
    <SolanaConnectionProvider key={endpoint} endpoint={endpoint} config={connectionConfig}>
      <SolanaWalletProvider wallets={wallets} autoConnect={autoConnect}>
        <SolanaWalletModalProvider>{children}</SolanaWalletModalProvider>
      </SolanaWalletProvider>
    </SolanaConnectionProvider>
  )
}
