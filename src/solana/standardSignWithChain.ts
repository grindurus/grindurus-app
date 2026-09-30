import { getChainForEndpoint } from '@solana/wallet-standard-util'
import {
  SolanaSignAndSendTransaction,
  SolanaSignTransaction,
} from '@solana/wallet-standard-features'
import { SOLANA_DEVNET_CHAIN, SOLANA_MAINNET_CHAIN, SOLANA_TESTNET_CHAIN } from '@solana/wallet-standard-chains'
import { Transaction, VersionedTransaction, type Connection } from '@solana/web3.js'
import { getWallets } from '@wallet-standard/app'
import bs58 from 'bs58'
import type { SolanaCluster } from '../providers/AppWalletProvider'
import { clusterFromRpcEndpoint } from './sendWalletTransaction'

/**
 * MetaMask Multichain uses CAIP-2 genesis hashes, not Wallet Standard aliases
 * (`solana:devnet`). Passing the alias makes MetaMask ignore `chain` → mainnet UI.
 * @see https://docs.metamask.io/metamask-connect/solana/guides/send-transactions/legacy/
 */
export const SOLANA_MAINNET_CAIP2 = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
export const SOLANA_DEVNET_CAIP2 = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'
export const SOLANA_TESTNET_CAIP2 = 'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z'

type StandardAccount = {
  address: string
  chains: readonly string[]
  features: readonly string[]
}

type SignTransactionFeature = {
  signTransaction: (
    ...inputs: Array<{
      account: StandardAccount
      chain?: string
      transaction: Uint8Array
    }>
  ) => Promise<ReadonlyArray<{ signedTransaction: Uint8Array }>>
}

type SignAndSendFeature = {
  signAndSendTransaction: (
    ...inputs: Array<{
      account: StandardAccount
      chain: string
      transaction: Uint8Array
      options?: {
        skipPreflight?: boolean
        preflightCommitment?: string
        maxRetries?: number
      }
    }>
  ) => Promise<ReadonlyArray<{ signature: Uint8Array }>>
}

type StandardWalletLike = {
  name?: string
  accounts: readonly StandardAccount[]
  features: Record<string, unknown>
}

/** Alias + MetaMask CAIP-2 for a cluster. */
export function chainIdsForCluster(cluster: SolanaCluster): readonly string[] {
  if (cluster === 'devnet') return [SOLANA_DEVNET_CAIP2, SOLANA_DEVNET_CHAIN]
  if (cluster === 'testnet') return [SOLANA_TESTNET_CAIP2, SOLANA_TESTNET_CHAIN]
  return [SOLANA_MAINNET_CAIP2, SOLANA_MAINNET_CHAIN]
}

export function clusterLabel(cluster: SolanaCluster): string {
  if (cluster === 'devnet') return 'Devnet'
  if (cluster === 'testnet') return 'Testnet'
  return 'Mainnet'
}

function accountSupportsCluster(account: StandardAccount, cluster: SolanaCluster): boolean {
  const ids = chainIdsForCluster(cluster)
  return account.chains.some((c) => ids.includes(c))
}

/** Prefer CAIP-2 genesis hash (MetaMask). Alias `solana:devnet` is ignored → mainnet UI. */
export function chainIdForAccount(_account: StandardAccount, cluster: SolanaCluster): string {
  return chainIdsForCluster(cluster)[0]
}

function isStandardWalletLike(value: unknown): value is StandardWalletLike {
  if (!value || typeof value !== 'object') return false
  const wallet = value as StandardWalletLike
  return Array.isArray(wallet.accounts) && Boolean(wallet.features)
}

export function getStandardWallet(adapter: unknown): StandardWalletLike | null {
  if (!adapter || typeof adapter !== 'object') return null
  const fromAdapter = (adapter as { wallet?: unknown }).wallet
  if (isStandardWalletLike(fromAdapter)) return fromAdapter

  const adapterName =
    typeof (adapter as { name?: unknown }).name === 'string'
      ? ((adapter as { name: string }).name || '').toLowerCase()
      : ''
  if (!adapterName) return null
  try {
    const match = getWallets().get().find((wallet) => {
      const name = (wallet.name || '').toLowerCase()
      if (!name) return false
      if (name === adapterName) return true
      return adapterName.includes('metamask') && name.includes('metamask')
    })
    if (isStandardWalletLike(match)) return match
  } catch {
    // SSR / registry unavailable
  }
  return null
}

export function walletStandardChainForCluster(cluster: SolanaCluster): string {
  return chainIdsForCluster(cluster)[0]
}

export function resolveWalletStandardCluster(
  connection: Connection,
  expectedCluster?: SolanaCluster,
): SolanaCluster {
  if (expectedCluster) return expectedCluster
  const fromRpc = clusterFromRpcEndpoint(connection.rpcEndpoint)
  if (fromRpc === 'devnet' || fromRpc === 'testnet' || fromRpc === 'mainnet-beta') return fromRpc
  const mapped = getChainForEndpoint(connection.rpcEndpoint)
  if (mapped === SOLANA_DEVNET_CHAIN) return 'devnet'
  if (mapped === SOLANA_TESTNET_CHAIN) return 'testnet'
  return 'mainnet-beta'
}

export function resolveWalletStandardChain(
  connection: Connection,
  expectedCluster?: SolanaCluster,
): string {
  return walletStandardChainForCluster(resolveWalletStandardCluster(connection, expectedCluster))
}

export function pickStandardAccount(
  standardWallet: StandardWalletLike,
  chainOrCluster: string | SolanaCluster,
  preferredAddress?: string | null,
): StandardAccount | null {
  const cluster: SolanaCluster =
    chainOrCluster === 'devnet' ||
    chainOrCluster === 'testnet' ||
    chainOrCluster === 'mainnet-beta'
      ? chainOrCluster
      : chainOrCluster === SOLANA_DEVNET_CHAIN ||
          chainOrCluster === SOLANA_DEVNET_CAIP2 ||
          chainOrCluster.includes('devnet') ||
          chainOrCluster.includes('EtWTRAB')
        ? 'devnet'
        : chainOrCluster === SOLANA_TESTNET_CHAIN ||
            chainOrCluster === SOLANA_TESTNET_CAIP2 ||
            chainOrCluster.includes('testnet')
          ? 'testnet'
          : 'mainnet-beta'

  const withChain = standardWallet.accounts.filter((account) =>
    accountSupportsCluster(account, cluster),
  )
  if (preferredAddress) {
    const matched = withChain.find((account) => account.address === preferredAddress)
    if (matched) return matched
  }
  return withChain[0] ?? null
}

function serializeLegacyTx(transaction: Transaction): Uint8Array {
  return new Uint8Array(
    transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    }),
  )
}

function assertAccountOnCluster(
  account: StandardAccount,
  cluster: SolanaCluster,
  preferredAddress?: string | null,
): void {
  if (!accountSupportsCluster(account, cluster)) {
    throw new Error(`Switch your Solana wallet to ${clusterLabel(cluster)} and try again`)
  }
  if (preferredAddress && account.address !== preferredAddress) {
    throw new Error(
      `Connected wallet account is not on ${clusterLabel(cluster)}. Open MetaMask → Solana → switch to ${clusterLabel(cluster)}, then reconnect.`,
    )
  }
}

export async function signLegacyTxWithChain(
  standardWallet: StandardWalletLike,
  transaction: Transaction,
  connection: Connection,
  expectedCluster?: SolanaCluster,
  preferredAddress?: string | null,
): Promise<Transaction> {
  const cluster = resolveWalletStandardCluster(connection, expectedCluster)
  const account = pickStandardAccount(standardWallet, cluster, preferredAddress)
  if (!account) {
    throw new Error(
      `Switch MetaMask Solana to ${clusterLabel(cluster)} (Networks → Solana ${clusterLabel(cluster)}), then reconnect.`,
    )
  }
  assertAccountOnCluster(account, cluster, preferredAddress)

  const chain = chainIdForAccount(account, cluster)
  const feature = standardWallet.features[SolanaSignTransaction] as SignTransactionFeature | undefined
  if (!feature?.signTransaction) throw new Error('Connected wallet cannot sign Solana transactions')
  if (!account.features.includes(SolanaSignTransaction)) {
    throw new Error('Connected wallet account cannot sign Solana transactions')
  }

  const [output] = await feature.signTransaction({
    account,
    chain,
    transaction: serializeLegacyTx(transaction),
  })
  return Transaction.from(output.signedTransaction)
}

export async function signVersionedTxWithChain(
  standardWallet: StandardWalletLike,
  transaction: VersionedTransaction,
  connection: Connection,
  expectedCluster?: SolanaCluster,
  preferredAddress?: string | null,
): Promise<VersionedTransaction> {
  const cluster = resolveWalletStandardCluster(connection, expectedCluster)
  const account = pickStandardAccount(standardWallet, cluster, preferredAddress)
  if (!account) {
    throw new Error(
      `Switch MetaMask Solana to ${clusterLabel(cluster)} (Networks → Solana ${clusterLabel(cluster)}), then reconnect.`,
    )
  }
  assertAccountOnCluster(account, cluster, preferredAddress)

  const chain = chainIdForAccount(account, cluster)
  const feature = standardWallet.features[SolanaSignTransaction] as SignTransactionFeature | undefined
  if (!feature?.signTransaction) throw new Error('Connected wallet cannot sign Solana transactions')
  if (!account.features.includes(SolanaSignTransaction)) {
    throw new Error('Connected wallet account cannot sign Solana transactions')
  }

  const [output] = await feature.signTransaction({
    account,
    chain,
    transaction: transaction.serialize(),
  })
  return VersionedTransaction.deserialize(output.signedTransaction)
}

export async function signAndSendLegacyTxWithChain(
  standardWallet: StandardWalletLike,
  transaction: Transaction,
  connection: Connection,
  expectedCluster?: SolanaCluster,
  options?: {
    skipPreflight?: boolean
    preflightCommitment?: 'processed' | 'confirmed' | 'finalized'
    maxRetries?: number
  },
  preferredAddress?: string | null,
): Promise<string> {
  const cluster = resolveWalletStandardCluster(connection, expectedCluster)
  const account = pickStandardAccount(standardWallet, cluster, preferredAddress)
  if (!account) {
    throw new Error(
      `Switch MetaMask Solana to ${clusterLabel(cluster)} (Networks → Solana ${clusterLabel(cluster)}), then reconnect.`,
    )
  }
  assertAccountOnCluster(account, cluster, preferredAddress)

  const chain = chainIdForAccount(account, cluster)
  const signAndSend = standardWallet.features[SolanaSignAndSendTransaction] as
    | SignAndSendFeature
    | undefined

  if (signAndSend?.signAndSendTransaction && account.features.includes(SolanaSignAndSendTransaction)) {
    const [output] = await signAndSend.signAndSendTransaction({
      account,
      chain,
      transaction: serializeLegacyTx(transaction),
      options: {
        skipPreflight: options?.skipPreflight ?? true,
        preflightCommitment: options?.preflightCommitment ?? 'confirmed',
        maxRetries: options?.maxRetries ?? 3,
      },
    })
    return bs58.encode(output.signature)
  }

  const signed = await signLegacyTxWithChain(
    standardWallet,
    transaction,
    connection,
    expectedCluster,
    preferredAddress,
  )
  return connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: options?.skipPreflight ?? true,
    preflightCommitment: options?.preflightCommitment ?? 'confirmed',
    maxRetries: options?.maxRetries ?? 3,
  })
}
