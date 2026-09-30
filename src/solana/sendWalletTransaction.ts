import {
  SendTransactionError,
  type Connection,
  type PublicKey,
  type Transaction,
  type TransactionSignature,
} from '@solana/web3.js'
import { confirmSignatureViaHttp } from '../grai/onchain'
import type { SolanaCluster } from '../providers/AppWalletProvider'

/** Wallet Standard / Mobile Wallet Adapter: missing chain defaults to mainnet. */
export function clusterFromRpcEndpoint(endpoint: string): SolanaCluster {
  if (/\bdevnet\b/i.test(endpoint)) return 'devnet'
  if (/\btestnet\b/i.test(endpoint)) return 'testnet'
  return 'mainnet-beta'
}

export function assertConnectionCluster(
  connection: Connection,
  expected: SolanaCluster,
  action: string,
): void {
  const actual = clusterFromRpcEndpoint(connection.rpcEndpoint)
  if (actual !== expected) {
    throw new Error(
      `App RPC is ${actual} but ${action} requires ${expected}. Check VITE_SOLANA_*_RPC_URL / cluster.`,
    )
  }
}

export type SolanaSendTransaction = (
  transaction: Transaction,
  connection: Connection,
  options?: {
    skipPreflight?: boolean
    preflightCommitment?: 'processed' | 'confirmed' | 'finalized'
    maxRetries?: number
  },
) => Promise<TransactionSignature>

function formatFailureLogs(logs: string[] | null | undefined, err: unknown): string {
  const joined = (logs ?? []).join('\n')
  const errText = typeof err === 'string' ? err : JSON.stringify(err)
  if (/insufficient funds|InsufficientFunds|insufficient lamports/i.test(`${joined}\n${errText}`)) {
    return 'Insufficient Devnet SOL (fees/rent) or USDC for this purchase.'
  }
  if (/Error: (?:custom program error|insufficient)/i.test(joined)) {
    const hint = logs?.filter((line) => /Error|error|failed|Program log/i.test(line)).slice(-4).join(' · ')
    return hint || 'Transaction failed on Devnet.'
  }
  if (logs?.length) {
    const hint = logs.filter((line) => /Error|error|failed|Program log/i.test(line)).slice(-4).join(' · ')
    if (hint) return hint
  }
  return errText && errText !== '{}' ? `Transaction failed: ${errText}` : 'Transaction failed on Devnet.'
}

async function explainSendError(error: unknown, connection?: Connection): Promise<Error> {
  if (error instanceof SendTransactionError) {
    try {
      const logs = connection ? await error.getLogs(connection) : error.logs
      return new Error(formatFailureLogs(logs, error.message))
    } catch {
      return new Error(formatFailureLogs(error.logs, error.message))
    }
  }
  const message = error instanceof Error ? error.message : String(error)
  if (/reverted during simulation|unknown error|transactionScan/i.test(message)) {
    return new Error(
      'Wallet simulation failed on Solana Devnet. Fund the wallet with Devnet SOL + USDC, enable Devnet in MetaMask, or use Phantom.',
    )
  }
  return error instanceof Error ? error : new Error(message)
}

/**
 * Prefer wallet `sendTransaction` so Wallet Standard adapters pass `chain`
 * (MetaMask/Phantom default the approval UI to solana:mainnet when chain is omitted).
 * MetaMask uses sign-with-chain + dapp sendRaw (SignAndSend Devnet sim is unreliable).
 * Fall back to sign + dapp `sendRawTransaction` only when sendTransaction is unavailable.
 *
 * Do not pre-simulate before signing — that blocks MetaMask's approval modal.
 */
export async function sendWalletTransaction(params: {
  connection: Connection
  transaction: Transaction
  feePayer: PublicKey
  expectedCluster?: SolanaCluster
  action?: string
  sendTransaction?: SolanaSendTransaction | null
  signTransaction?: ((transaction: Transaction) => Promise<Transaction>) | null
}): Promise<string> {
  const action = params.action ?? 'this action'
  if (params.expectedCluster) {
    assertConnectionCluster(params.connection, params.expectedCluster, action)
  }

  const { blockhash, lastValidBlockHeight } = await params.connection.getLatestBlockhash('confirmed')
  params.transaction.feePayer = params.feePayer
  params.transaction.recentBlockhash = blockhash

  // Soft balance check — do not block the wallet modal on RPC simulate quirks.
  const balance = await params.connection.getBalance(params.feePayer, 'confirmed')
  if (balance < 5_000) {
    throw new Error('Need Devnet SOL for fees (airdrop or bridge a little SOL first).')
  }

  let signature: string
  try {
    if (params.sendTransaction) {
      signature = await params.sendTransaction(params.transaction, params.connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      })
    } else if (params.signTransaction) {
      const signed = await params.signTransaction(params.transaction)
      signature = await params.connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      })
    } else {
      throw new Error('Connected wallet cannot send transactions')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const expected = params.expectedCluster
    if (
      expected &&
      expected !== 'mainnet-beta' &&
      (/WalletSendTransactionError/i.test(message) ||
        (/chain/i.test(message) && /not (supported|included)/i.test(message)) ||
        message.trim() === '')
    ) {
      throw new Error(
        `Switch your Solana wallet to ${expected === 'devnet' ? 'Devnet' : expected} to ${action}`,
      )
    }
    throw await explainSendError(error, params.connection)
  }

  // HTTP poll — `confirmTransaction` WebSocket hangs on the local /solana-devnet-rpc proxy.
  try {
    await confirmSignatureViaHttp(params.connection, signature, 'confirmed')
  } catch (confirmError) {
    const statuses = await params.connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    })
    const status = statuses?.value?.[0]
    if (status?.err) throw await explainSendError(confirmError, params.connection)
    if (!status && lastValidBlockHeight) {
      throw await explainSendError(confirmError, params.connection)
    }
  }
  return signature
}
