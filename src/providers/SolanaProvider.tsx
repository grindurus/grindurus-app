import { ReactNode, useEffect, useMemo, useState } from 'react'
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
import '@solana/wallet-adapter-react-ui/styles.css'

export type SolanaNetwork = 'mainnet-beta' | 'testnet' | 'devnet'

interface SolanaProviderProps {
  children: ReactNode
}

export function SolanaProvider({ children }: SolanaProviderProps) {
  const endpoint = useMemo(() => resolveSolanaRpcUrl(getDefaultGraiSolanaCluster()), [])
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
    <ConnectionProvider endpoint={endpoint} config={connectionConfig}>
      <WalletProvider wallets={wallets} autoConnect={autoConnect}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
