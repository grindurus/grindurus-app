import { getChainForEndpoint } from '@solana/wallet-standard-util'
import {
  SolanaSignAndSendTransaction,
  SolanaSignTransaction,
} from '@solana/wallet-standard-features'
import { SOLANA_DEVNET_CHAIN, SOLANA_MAINNET_CHAIN, SOLANA_TESTNET_CHAIN } from '@solana/wallet-standard-chains'
import { Transaction, VersionedTransaction, type Connection } from '@solana/web3.js'
import bs58 from 'bs58'
import type { SolanaCluster } from '../providers/AppWalletProvider'
import { clusterFromRpcEndpoint } from './sendWalletTransaction'

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
  accounts: readonly StandardAccount[]
  features: Record<string, unknown>
}

/** Wallet Standard account object from a wallet-adapter StandardWalletAdapter. */
export function getStandardWallet(adapter: unknown): StandardWalletLike | null {
  if (!adapter || typeof adapter !== 'object' || !('wallet' in adapter)) return null
  const wallet = (adapter as { wallet?: StandardWalletLike }).wallet
  if (!wallet?.accounts || !wallet.features) return null
  return wallet
}

export function walletStandardChainForCluster(cluster: SolanaCluster): string {
  if (cluster === 'devnet') return SOLANA_DEVNET_CHAIN
  if (cluster === 'testnet') return SOLANA_TESTNET_CHAIN
  return SOLANA_MAINNET_CHAIN
}

export function resolveWalletStandardChain(
  connection: Connection,
  expectedCluster?: SolanaCluster,
): string {
  if (expectedCluster) return walletStandardChainForCluster(expectedCluster)
  const fromRpc = clusterFromRpcEndpoint(connection.rpcEndpoint)
  if (fromRpc === 'devnet') return SOLANA_DEVNET_CHAIN
  if (fromRpc === 'testnet') return SOLANA_TESTNET_CHAIN
  // Prefer util mapping, but never trust a bare URL that omitted "devnet".
  const mapped = getChainForEndpoint(connection.rpcEndpoint)
  return mapped || SOLANA_MAINNET_CHAIN
}

/** Prefer the account that advertises the target chain (MetaMask lists one per network). */
export function pickStandardAccount(
  standardWallet: StandardWalletLike,
  chain: string,
  preferredAddress?: string | null,
): StandardAccount | null {
  const withChain = standardWallet.accounts.filter((account) => account.chains.includes(chain))
  if (preferredAddress) {
    const matched = withChain.find((account) => account.address === preferredAddress)
    if (matched) return matched
    const anyPreferred = standardWallet.accounts.find((account) => account.address === preferredAddress)
    if (anyPreferred?.chains.includes(chain)) return anyPreferred
  }
  if (withChain[0]) return withChain[0]
  const needle = chain.replace(/^solana:/, '')
  const fuzzy = standardWallet.accounts.find((account) =>
    account.chains.some((c) => c.includes(needle)),
  )
  if (fuzzy) return fuzzy
  if (preferredAddress) {
    const anyPreferred = standardWallet.accounts.find((account) => account.address === preferredAddress)
    if (anyPreferred) return anyPreferred
  }
  return standardWallet.accounts[0] ?? null
}

function serializeLegacyTx(transaction: Transaction): Uint8Array {
  return new Uint8Array(
    transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    }),
  )
}

/**
 * Sign a legacy Transaction via Wallet Standard with an explicit `chain`.
 * Adapter `signTransaction` omits chain → MetaMask/Phantom default to mainnet UI.
 * Always pick the account that lists the target chain (not blindly accounts[0]).
 */
export async function signLegacyTxWithChain(
  standardWallet: StandardWalletLike,
  transaction: Transaction,
  connection: Connection,
  expectedCluster?: SolanaCluster,
  preferredAddress?: string | null,
): Promise<Transaction> {
  const chain = resolveWalletStandardChain(connection, expectedCluster)
  const account = pickStandardAccount(standardWallet, chain, preferredAddress)
  if (!account) throw new Error('Solana wallet is not connected')

  if (!account.chains.includes(chain)) {
    const label = chain === SOLANA_DEVNET_CHAIN ? 'Devnet' : chain.replace(/^solana:/, '')
    throw new Error(`Switch your Solana wallet to ${label} and try again`)
  }

  const feature = standardWallet.features[SolanaSignTransaction] as SignTransactionFeature | undefined
  if (!feature?.signTransaction) {
    throw new Error('Connected wallet cannot sign Solana transactions')
  }
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

/**
 * Sign a VersionedTransaction via Wallet Standard (`solana:signTransaction` only).
 * Used by x402 Exact SVM: client partially signs; facilitator fee-pays and broadcasts.
 * Never use SignAndSend here — broadcasting a fee-payer-incomplete tx breaks the flow.
 */
export async function signVersionedTxWithChain(
  standardWallet: StandardWalletLike,
  transaction: VersionedTransaction,
  connection: Connection,
  expectedCluster?: SolanaCluster,
  preferredAddress?: string | null,
): Promise<VersionedTransaction> {
  const chain = resolveWalletStandardChain(connection, expectedCluster)
  const account = pickStandardAccount(standardWallet, chain, preferredAddress)
  if (!account) throw new Error('Solana wallet is not connected')

  if (!account.chains.includes(chain)) {
    const label = chain === SOLANA_DEVNET_CHAIN ? 'Devnet' : chain.replace(/^solana:/, '')
    throw new Error(`Switch your Solana wallet to ${label} and try again`)
  }

  const feature = standardWallet.features[SolanaSignTransaction] as SignTransactionFeature | undefined
  if (!feature?.signTransaction) {
    throw new Error('Connected wallet cannot sign Solana transactions')
  }
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

/**
 * MetaMask: SignAndSend shows the correct network in the approval UI when `chain` is set.
 * Prefer the Devnet account (not accounts[0], which is often mainnet).
 */
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
  const chain = resolveWalletStandardChain(connection, expectedCluster)
  const account = pickStandardAccount(standardWallet, chain, preferredAddress)
  if (!account) throw new Error('Solana wallet is not connected')

  if (!account.chains.includes(chain)) {
    const label = chain === SOLANA_DEVNET_CHAIN ? 'Devnet' : chain.replace(/^solana:/, '')
    throw new Error(`Switch your Solana wallet to ${label} and try again`)
  }

  const signAndSend = standardWallet.features[SolanaSignAndSendTransaction] as
    | SignAndSendFeature
    | undefined

  if (signAndSend?.signAndSendTransaction && account.features.includes(SolanaSignAndSendTransaction)) {
    const [output] = await signAndSend.signAndSendTransaction({
      account,
      chain,
      transaction: serializeLegacyTx(transaction),
      options: {
        // MetaMask Devnet scanner often fails with "unknown error" — skip wallet preflight.
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
