import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { useMemo, useCallback } from 'react'
import type { Connection, Transaction, TransactionSignature } from '@solana/web3.js'
import { VersionedTransaction } from '@solana/web3.js'
import { useWalletContext } from '../providers/walletContext'
import { shortenAddress } from '../utils/shortenAddress'
import { clusterFromRpcEndpoint } from '../solana/sendWalletTransaction'
import {
  chainIdsForCluster,
  getStandardWallet,
  pickStandardAccount,
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
      const standardWallet = (
        wallet.adapter as { wallet?: { accounts?: ReadonlyArray<{ chains: readonly string[] }> } }
      ).wallet
      const chains = standardWallet?.accounts?.[0]?.chains ?? []
      if (chains.some((c) => c.includes('devnet') || c.includes('EtWTRAB'))) return 'devnet'
      if (chains.some((c) => c.includes('mainnet') || c.includes('5eykt4Us'))) return 'mainnet-beta'
      return null
    }
    if (walletName.includes('solflare')) {
      return detectClusterFromRpcEndpoint(globalAny.solflare?.connection?.rpcEndpoint)
    }
    if (walletName.includes('metamask')) {
      const standard = getStandardWallet(wallet.adapter)
      const accounts = standard?.accounts ?? []
      const prefer = publicKey?.toBase58()
      const active = prefer
        ? accounts.find((a) => a.address === prefer) ?? accounts[0]
        : accounts[0]
      const chains = active?.chains ?? []
      if (chains.some((c) => chainIdsForCluster('devnet').includes(c))) return 'devnet'
      if (chains.some((c) => chainIdsForCluster('mainnet-beta').includes(c))) return 'mainnet-beta'
      if (chains.some((c) => chainIdsForCluster('testnet').includes(c))) return 'testnet'
      return null
    }

    return null
  }, [wallet, connected, publicKey])

  const normalizedSolanaCluster = toWalletSolanaCluster(solanaCluster)
  const normalizedWalletCluster =
    walletDetectedCluster && walletDetectedCluster !== 'testnet'
      ? toWalletSolanaCluster(walletDetectedCluster)
      : null
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
      await new Promise((resolve) => setTimeout(resolve, 0))
      try {
        await connect()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const isNotSelected =
          message.includes('Wallet not selected') || message.includes('WalletNotSelectedError')
        if (isNotSelected) {
          try {
            await new Promise((resolve) => setTimeout(resolve, 50))
            await connect()
          } catch {
            // User rejected / locked / still initializing.
          }
          return
        }
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
      const liveStandard = standardWallet ?? (wallet ? getStandardWallet(wallet.adapter) : null)
      if (liveStandard && tx instanceof VersionedTransaction) {
        return signVersionedTxWithChain(
          liveStandard,
          tx,
          connection,
          effectiveCluster,
          publicKey?.toBase58() ?? null,
        )
      }
      // Always pass Wallet Standard chain (CAIP-2 for MetaMask). Omitting → mainnet UI.
      if (liveStandard && 'instructions' in tx) {
        return signLegacyTxWithChain(
          liveStandard,
          tx as Transaction,
          connection,
          effectiveCluster,
          publicKey?.toBase58() ?? null,
        )
      }
      if (isMetaMaskSolana) {
        throw new Error(
          'MetaMask Solana Wallet Standard is unavailable. Update MetaMask, enable Solana, reconnect on Devnet.',
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
      standardWallet,
      wallet,
      connection,
      effectiveCluster,
      publicKey,
      isMetaMaskSolana,
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
      const liveStandard = standardWallet ?? (wallet ? getStandardWallet(wallet.adapter) : null)
      const cluster =
        clusterFromRpcEndpoint(conn.rpcEndpoint) === 'devnet' || effectiveCluster === 'devnet'
          ? 'devnet'
          : effectiveCluster

      // MetaMask: SignAndSend + CAIP-2 genesis hash (docs). Alias `solana:devnet` → mainnet UI.
      // Mirror header TESTNET→Sepolia switch for EVM: pin the Devnet scope on every send.
      if (isMetaMaskSolana && liveStandard) {
        if (!pickStandardAccount(liveStandard, cluster, publicKey?.toBase58())) {
          throw new Error(
            `Header is on ${cluster === 'devnet' ? 'Testnet' : 'Mainnet'}: open MetaMask → Solana → switch to ${cluster === 'devnet' ? 'Devnet' : 'Mainnet'}, then reconnect.`,
          )
        }
        return signAndSendLegacyTxWithChain(
          liveStandard,
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

      if (liveStandard) {
        const signed = await signLegacyTxWithChain(
          liveStandard,
          transaction,
          conn,
          cluster,
          publicKey?.toBase58() ?? null,
        )
        return conn.sendRawTransaction(signed.serialize(), {
          skipPreflight: options?.skipPreflight ?? true,
          preflightCommitment: options?.preflightCommitment ?? 'confirmed',
          maxRetries: options?.maxRetries ?? 3,
        })
      }

      if (isMetaMaskSolana) {
        throw new Error(
          'MetaMask Solana Wallet Standard is unavailable. Update MetaMask, enable Solana, reconnect on Devnet.',
        )
      }

      if (typeof adapterSendTransaction !== 'function') {
        throw new Error('Connected Solana wallet cannot send transactions.')
      }
      return adapterSendTransaction(transaction, conn, options)
    },
    [
      adapterSendTransaction,
      isMetaMaskSolana,
      standardWallet,
      wallet,
      effectiveCluster,
      publicKey,
    ],
  )

  const prefersChainedSend = Boolean(standardWallet) || isMetaMaskSolana

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
      Boolean(standardWallet) ||
      isMetaMaskSolana
        ? signTransactionOrAll
        : signTransaction,
    sendTransaction: prefersChainedSend ? sendTransaction : null,
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
