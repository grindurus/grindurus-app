import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { useMemo, useCallback } from 'react'
import type { Connection, Transaction, TransactionSignature } from '@solana/web3.js'
import { VersionedTransaction } from '@solana/web3.js'
import { useWalletContext } from '../providers/walletContext'
import { shortenAddress } from '../utils/shortenAddress'
import { clusterFromRpcEndpoint } from '../solana/sendWalletTransaction'
import {
  getStandardWallet,
  signAndSendLegacyTxWithChain,
  signLegacyTxWithChain,
  signVersionedTxWithChain,
} from '../solana/standardSignWithChain'
import {
  networkEnvFromSolanaCluster,
  solanaClusterMatchesNetworkEnv,
} from '../wallet/networkEnv'

function detectClusterFromRpcEndpoint(endpoint?: string): 'mainnet-beta' | 'testnet' | 'devnet' | null {
  if (!endpoint) return null
  return clusterFromRpcEndpoint(endpoint)
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
    signAllTransactions,
    sendTransaction: adapterSendTransaction,
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
    return shortenAddress(address, { tail: 4 })
  }, [address])

  const walletDetectedCluster = useMemo(() => {
    if (!wallet) return null

    const globalAny = window as unknown as {
      phantom?: { solana?: { connection?: { rpcEndpoint?: string } } }
      solflare?: { connection?: { rpcEndpoint?: string } }
    }

    const walletName = wallet.adapter.name.toLowerCase()
    if (walletName.includes('phantom')) {
      const fromRpc = detectClusterFromRpcEndpoint(
        globalAny.phantom?.solana?.connection?.rpcEndpoint,
      )
      if (fromRpc) return fromRpc
      // Wallet Standard Phantom: inspect active account chains (solana:devnet / solana:mainnet).
      const standardWallet = (
        wallet.adapter as { wallet?: { accounts?: ReadonlyArray<{ chains: readonly string[] }> } }
      ).wallet
      const chains = standardWallet?.accounts?.[0]?.chains ?? []
      if (chains.some((c) => c.includes('devnet'))) return 'devnet'
      if (chains.some((c) => c.includes('mainnet'))) return 'mainnet-beta'
      return null
    }
    if (walletName.includes('solflare')) {
      return detectClusterFromRpcEndpoint(globalAny.solflare?.connection?.rpcEndpoint)
    }

    return null
  }, [wallet, connected])

  const normalizedSolanaCluster = toWalletSolanaCluster(solanaCluster)
  const normalizedWalletCluster =
    walletDetectedCluster && walletDetectedCluster !== 'testnet'
      ? toWalletSolanaCluster(walletDetectedCluster)
      : null
  // App-selected cluster is source of truth for RPC / tx routing. Wallet-reported
  // cluster is only a mismatch signal (Phantom/Solflare may still be on mainnet).
  const effectiveCluster = normalizedSolanaCluster
  const effectiveClusterName = useMemo(() => {
    if (effectiveCluster === 'mainnet-beta') return 'Mainnet'
    return 'Devnet'
  }, [effectiveCluster])
  const walletClusterMismatch =
    normalizedWalletCluster != null && normalizedWalletCluster !== normalizedSolanaCluster

  const supportedClusters = useMemo(() => {
    const all = [
      { id: 'mainnet-beta' as const, name: 'Mainnet', icon: '🟢' },
      { id: 'devnet' as const, name: 'Devnet', icon: '🟣' },
    ]
    const env = networkEnvFromSolanaCluster(solanaCluster)
    return all.filter((cluster) => solanaClusterMatchesNetworkEnv(cluster.id, env))
  }, [solanaCluster])

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
    [setSolanaCluster],
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
    [wallets, select, connect],
  )

  const standardWallet = useMemo(
    () => (wallet ? getStandardWallet(wallet.adapter) : null),
    [wallet],
  )
  const isMetaMaskSolana = Boolean(wallet?.adapter.name.toLowerCase().includes('metamask'))

  const signTransactionOrAll = useCallback(
    async (tx: Parameters<NonNullable<typeof signTransaction>>[0]) => {
      // Wallet Standard + explicit chain: sign only (never SignAndSend).
      // x402 Exact SVM deserializes a VersionedTransaction with facilitator as
      // fee payer — broadcasting that incomplete tx would fail / confuse wallets.
      if (standardWallet && tx instanceof VersionedTransaction) {
        return signVersionedTxWithChain(
          standardWallet,
          tx,
          connection,
          effectiveCluster,
          publicKey?.toBase58() ?? null,
        )
      }
      // MetaMask: adapter signTransaction omits chain and often uses accounts[0]
      // (mainnet). Force account + chain from app cluster.
      if (isMetaMaskSolana && standardWallet && 'instructions' in tx) {
        return signLegacyTxWithChain(
          standardWallet,
          tx as Transaction,
          connection,
          effectiveCluster,
          publicKey?.toBase58() ?? null,
        )
      }
      if (typeof signTransaction === 'function') {
        return signTransaction(tx)
      }
      if (typeof signAllTransactions === 'function') {
        const [signed] = await signAllTransactions([tx])
        return signed
      }
      throw new Error('Connected Solana wallet cannot sign transactions.')
    },
    [
      signTransaction,
      signAllTransactions,
      isMetaMaskSolana,
      standardWallet,
      connection,
      effectiveCluster,
      publicKey,
    ],
  ) as NonNullable<typeof signTransaction>

  const sendTransaction = useCallback(
    async (
      transaction: Transaction,
      conn: Connection,
      options?: {
        skipPreflight?: boolean
        preflightCommitment?: 'processed' | 'confirmed' | 'finalized'
        maxRetries?: number
      },
    ): Promise<TransactionSignature> => {
      // MetaMask: pick the Devnet account (not accounts[0]=mainnet) and pass
      // chain explicitly. Prefer SignAndSend so the approval UI shows Devnet.
      if (isMetaMaskSolana && standardWallet) {
        const cluster =
          clusterFromRpcEndpoint(conn.rpcEndpoint) === 'devnet' || effectiveCluster === 'devnet'
            ? 'devnet'
            : effectiveCluster
        return signAndSendLegacyTxWithChain(
          standardWallet,
          transaction,
          conn,
          cluster,
          {
            skipPreflight: options?.skipPreflight ?? true,
            preflightCommitment: options?.preflightCommitment ?? 'confirmed',
            maxRetries: options?.maxRetries ?? 3,
          },
          publicKey?.toBase58() ?? null,
        )
      }
      if (typeof adapterSendTransaction !== 'function') {
        throw new Error('Connected Solana wallet cannot send transactions.')
      }
      return adapterSendTransaction(transaction, conn, options)
    },
    [adapterSendTransaction, isMetaMaskSolana, standardWallet, effectiveCluster, publicKey],
  )

  // Wallet Standard adapters: use sendTransaction so `chain` is set from RPC URL.
  // MetaMask uses our custom send (sign+chain + sendRaw) above — not SignAndSend.
  const prefersChainedSend = Boolean(standardWallet)

  return {
    address,
    shortAddress,
    publicKey,
    isConnected: connected,
    isConnecting: connecting,
    cluster: effectiveCluster,
    clusterName: effectiveClusterName,
    walletClusterMismatch,
    wallet,
    signTransaction:
      typeof signTransaction === 'function' ||
      typeof signAllTransactions === 'function' ||
      (isMetaMaskSolana && standardWallet)
        ? signTransactionOrAll
        : signTransaction,
    sendTransaction:
      prefersChainedSend &&
      (typeof adapterSendTransaction === 'function' || (isMetaMaskSolana && standardWallet))
        ? sendTransaction
        : null,
    wallets: allWallets,
    detectedWallets,
    connection,
    rpcEndpoint: connection.rpcEndpoint,
    supportedClusters,
    connect: openModal,
    disconnect,
    switchCluster,
    selectWallet,
  }
}
