import { useCallback, useState } from 'react'
import type { Connection } from '@solana/web3.js'
import { PublicKey, Transaction } from '@solana/web3.js'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import type { GraiSolanaRuntime } from '../grai/deployments'
import { useWalletContext } from '../providers/walletContext'
import type { SolanaSendTransaction } from '../solana/sendWalletTransaction'
import { useSolanaWallet } from './useSolanaWallet'

export type GraiTransactionStatus = 'idle' | 'building' | 'signing' | 'confirming' | 'success' | 'error'

export function isGraiTransactionPending(status: GraiTransactionStatus): boolean {
  return status === 'building' || status === 'signing' || status === 'confirming'
}

type GraiTransactionContext = {
  connection: Connection
  solana: GraiSolanaRuntime
  publicKey: PublicKey
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  sendTransaction: SolanaSendTransaction | null
  setStatus: (status: GraiTransactionStatus) => void
}

type RunGraiTransactionOptions<TResult extends { signature: string }> = {
  connectMessage: string
  clusterAction: string
  failureMessage: string
  amountInput?: string
  emptyAmountMessage?: string
  beforeExecute?: () => void
  execute: (ctx: GraiTransactionContext) => Promise<TResult>
}

/** Same cluster-pinning + sendTransaction path as `useGrsSolanaTransaction`. */
export function useGraiTransaction() {
  const solanaWallet = useSolanaWallet()
  const { setSelectedChainType, setSolanaCluster } = useWalletContext()
  const { connection, solana, clusterMismatch } = useGraiDeployment()
  const [status, setStatus] = useState<GraiTransactionStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastSignature, setLastSignature] = useState<string | null>(null)

  const run = useCallback(
    async <TResult extends { signature: string }>(
      options: RunGraiTransactionOptions<TResult>,
    ): Promise<TResult> => {
      setError(null)
      setLastSignature(null)

      setSelectedChainType('solana')
      // Pin Devnet before signing so Wallet Standard / MetaMask get the right chain.
      if (solana?.cluster === 'devnet' || solana?.cluster === 'mainnet-beta') {
        setSolanaCluster(solana.cluster)
      }

      if (!solanaWallet.publicKey) {
        solanaWallet.connect()
        throw new Error(options.connectMessage)
      }

      if (!solanaWallet.signTransaction && !solanaWallet.sendTransaction) {
        throw new Error('Connected wallet cannot sign transactions')
      }

      if (!connection || !solana) {
        throw new Error('GRAI is not configured for this network')
      }

      if (clusterMismatch) {
        throw new Error(`Switch your Solana wallet to ${solana.cluster} to ${options.clusterAction}`)
      }

      if (options.amountInput !== undefined) {
        const amountInput = options.amountInput.trim()
        if (!amountInput || amountInput === '0' || amountInput === '0.') {
          throw new Error(options.emptyAmountMessage ?? 'Enter an amount')
        }
      }

      options.beforeExecute?.()

      const publicKey = solanaWallet.publicKey

      try {
        setStatus('building')
        const signTransaction = async (transaction: Transaction) => {
          setStatus('signing')
          if (!solanaWallet.signTransaction) {
            throw new Error('Connected wallet cannot sign transactions')
          }
          return solanaWallet.signTransaction(transaction)
        }
        const sendTransaction: SolanaSendTransaction | null = solanaWallet.sendTransaction
          ? async (transaction, conn, sendOptions) => {
              setStatus('signing')
              return solanaWallet.sendTransaction!(transaction, conn, sendOptions)
            }
          : null

        setStatus('confirming')
        const result = await options.execute({
          connection,
          solana,
          publicKey,
          signTransaction,
          sendTransaction,
          setStatus,
        })

        setLastSignature(result.signature)
        setStatus('success')
        return result
      } catch (txError) {
        const raw =
          txError instanceof Error
            ? txError.message
            : typeof txError === 'object' &&
                txError &&
                'message' in txError &&
                typeof (txError as { message: unknown }).message === 'string'
              ? (txError as { message: string }).message
              : options.failureMessage
        const message = /unexpected error/i.test(raw)
          ? `${options.failureMessage}: wallet rejected or could not sign (check fee payer / tx size)`
          : raw
        setError(message)
        setStatus('error')
        throw txError instanceof Error ? txError : new Error(message)
      }
    },
    [clusterMismatch, connection, setSelectedChainType, setSolanaCluster, solana, solanaWallet],
  )

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setLastSignature(null)
  }, [])

  return {
    run,
    reset,
    status,
    error,
    lastSignature,
    isPending: isGraiTransactionPending(status),
  }
}
