import type { Connection, PublicKey, Transaction, TransactionSignature } from '@solana/web3.js'

export type WalletSolanaCluster = 'mainnet-beta' | 'devnet'

/** Minimal wallet-adapter surface used by the app when Solana stack is loaded. */
export type SolanaAdapterWallet = {
  adapter: { name: string; icon?: string }
  readyState?: string
}

export type SolanaWalletSnapshot = {
  address: string
  shortAddress: string
  publicKey: PublicKey | null
  isConnected: boolean
  isConnecting: boolean
  cluster: WalletSolanaCluster
  clusterName: string
  walletClusterMismatch: boolean
  wallet: SolanaAdapterWallet | null
  signTransaction: ((transaction: Transaction) => Promise<Transaction>) | undefined | null
  sendTransaction:
    | ((
        transaction: Transaction,
        connection: Connection,
        options?: {
          skipPreflight?: boolean
          preflightCommitment?: 'processed' | 'confirmed' | 'finalized'
          maxRetries?: number
        },
      ) => Promise<TransactionSignature>)
    | null
  wallets: SolanaAdapterWallet[]
  detectedWallets: SolanaAdapterWallet[]
  connection: Connection | null
  rpcEndpoint: string
  supportedClusters: Array<{ id: WalletSolanaCluster; name: string; icon: string }>
  connect: () => void
  disconnect: () => Promise<void>
  switchCluster: (cluster: WalletSolanaCluster) => void
  selectWallet: (walletName: string) => Promise<void>
}

export const DEFAULT_SOLANA_WALLET: SolanaWalletSnapshot = {
  address: '',
  shortAddress: '',
  publicKey: null,
  isConnected: false,
  isConnecting: false,
  cluster: 'devnet',
  clusterName: 'Devnet',
  walletClusterMismatch: false,
  wallet: null,
  signTransaction: null,
  sendTransaction: null,
  wallets: [],
  detectedWallets: [],
  connection: null,
  rpcEndpoint: '',
  supportedClusters: [],
  connect: () => {},
  disconnect: async () => {},
  switchCluster: () => {},
  selectWallet: async () => {
    throw new Error('Solana wallet stack is not loaded yet')
  },
}
