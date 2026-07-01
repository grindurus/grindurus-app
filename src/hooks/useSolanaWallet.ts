import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { useMemo, useCallback } from 'react'
import { useWalletContext } from '../providers/AppWalletProvider'

function detectClusterFromRpcEndpoint(endpoint?: string): 'mainnet-beta' | 'testnet' | 'devnet' | null {
  if (!endpoint) return null
  const e = endpoint.toLowerCase()
  if (e.includes('devnet')) return 'devnet'
  if (e.includes('testnet')) return 'testnet'
  if (e.includes('mainnet')) return 'mainnet-beta'
  return null
}

export type WalletSolanaCluster = 'mainnet-beta' | 'devnet'

function toWalletSolanaCluster(cluster: 'mainnet-beta' | 'testnet' | 'devnet'): WalletSolanaCluster {
  return cluster === 'testnet' ? 'devnet' : cluster
}

export function useSolanaWallet() {
  const {
    publicKey,
    connected,
    connecting,
    disconnect: walletDisconnect,
    signTransaction,
    wallet,
    wallets,
    select,
    connect,
  } = useWallet()
  const { connection } = useConnection()
  const { setVisible } = useWalletModal()
  const { solanaCluster, setSolanaCluster } = useWalletContext()

  const address = useMemo(() => {
    return publicKey?.toBase58() || ''
  }, [publicKey])

  const shortAddress = useMemo(() => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }, [address])

  const walletDetectedCluster = useMemo(() => {
    if (!wallet) return null

    // Prefer wallet-selected RPC endpoint when wallet exposes it (Phantom/Solflare and similar).
    const globalAny = window as unknown as {
      phantom?: { solana?: { connection?: { rpcEndpoint?: string } } }
      solflare?: { connection?: { rpcEndpoint?: string } }
    }

    const walletName = wallet.adapter.name.toLowerCase()
    if (walletName.includes('phantom')) {
      return detectClusterFromRpcEndpoint(globalAny.phantom?.solana?.connection?.rpcEndpoint)
    }
    if (walletName.includes('solflare')) {
      return detectClusterFromRpcEndpoint(globalAny.solflare?.connection?.rpcEndpoint)
    }

    return null
  }, [wallet])

  const walletDetectedRpcEndpoint = useMemo(() => {
    if (!wallet) return null

    const globalAny = window as unknown as {
      phantom?: { solana?: { connection?: { rpcEndpoint?: string } } }
      solflare?: { connection?: { rpcEndpoint?: string } }
    }

    const walletName = wallet.adapter.name.toLowerCase()
    if (walletName.includes('phantom')) {
      return globalAny.phantom?.solana?.connection?.rpcEndpoint ?? null
    }
    if (walletName.includes('solflare')) {
      return globalAny.solflare?.connection?.rpcEndpoint ?? null
    }

    return null
  }, [wallet])

  const normalizedSolanaCluster = toWalletSolanaCluster(solanaCluster)
  const normalizedWalletCluster =
    walletDetectedCluster && walletDetectedCluster !== 'testnet'
      ? toWalletSolanaCluster(walletDetectedCluster)
      : null

  const effectiveCluster = normalizedWalletCluster ?? normalizedSolanaCluster
  const effectiveClusterName = useMemo(() => {
    if (effectiveCluster === 'mainnet-beta') return 'Mainnet'
    return 'Devnet'
  }, [effectiveCluster])

  const supportedClusters = useMemo(
    () => [
      { id: 'mainnet-beta' as const, name: 'Mainnet', icon: '🟢' },
      { id: 'devnet' as const, name: 'Devnet', icon: '🟣' },
    ],
    []
  )

  const detectedWallets = useMemo(() => {
    return wallets.filter((w) => w.readyState === 'Installed' || w.readyState === 'Loadable')
  }, [wallets])

  const allWallets = useMemo(() => wallets, [wallets])

  const openModal = useCallback(() => {
    setVisible(true)
  }, [setVisible])

  const disconnect = useCallback(async () => {
    try {
      await walletDisconnect()
    } finally {
      // Prevent wallet-adapter autoConnect from immediately reconnecting
      // after manual disconnect (even if disconnect throws).
      select(null)
    }
  }, [select, walletDisconnect])

  const switchCluster = useCallback(
    (cluster: 'mainnet-beta' | 'devnet') => {
      setSolanaCluster(cluster)
    },
    [setSolanaCluster]
  )

  const selectWallet = useCallback(
    async (walletName: string) => {
      const found = wallets.find((w) => w.adapter.name === walletName)
      if (!found) return

      select(found.adapter.name)

      // Wallet adapter updates selected wallet state asynchronously.
      // A tiny delay prevents WalletNotSelectedError race on immediate connect().
      await new Promise((resolve) => setTimeout(resolve, 0))
      try {
        await connect()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const isNotSelected = message.includes('Wallet not selected') || message.includes('WalletNotSelectedError')
        if (isNotSelected) {
          try {
            await new Promise((resolve) => setTimeout(resolve, 50))
            await connect()
          } catch {
            // User rejected, wallet locked, or adapter still initializing.
          }
          return
        }
        // User rejected or wallet still initializing.
      }
    },
    [wallets, select, connect]
  )

  return {
    address,
    shortAddress,
    publicKey,
    isConnected: connected,
    isConnecting: connecting,
    cluster: effectiveCluster,
    clusterName: effectiveClusterName,
    wallet,
    signTransaction,
    wallets: allWallets,
    detectedWallets,
    connection,
    rpcEndpoint: walletDetectedRpcEndpoint ?? connection.rpcEndpoint,
    supportedClusters,
    connect: openModal,
    disconnect,
    switchCluster,
    selectWallet,
  }
}
