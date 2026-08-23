import { useCallback, useState } from 'react'
import type { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { useSolanaWallet } from './useSolanaWallet'
import { useWalletContext } from '../providers/AppWalletProvider'
import { isGraiTransactionPending, type GraiTransactionStatus } from './useGraiTransaction'
import {
  createGrsSolanaConnection,
  getDefaultGrsSolanaCluster,
  resolveGrsSolanaConfig,
  type GrsSolanaConfig,
} from '../grs/deployments'

type RunOptions<TResult extends { signature: string }> = {
  connectMessage: string
  clusterAction: string
  failureMessage: string
  amountInput?: string
  emptyAmountMessage?: string
  execute: (ctx: {
    connection: Connection
    config: GrsSolanaConfig
    publicKey: PublicKey
    signTransaction: (transaction: Transaction) => Promise<Transaction>
  }) => Promise<TResult>
}

export function useGrsSolanaTransaction() {
  const solanaWallet = useSolanaWallet()
  const { setSelectedChainType, solanaCluster } = useWalletContext()
  const [status, setStatus] = useState<GraiTransactionStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastSignature, setLastSignature] = useState<string | null>(null)

  const config = resolveGrsSolanaConfig(solanaCluster ?? getDefaultGrsSolanaCluster())

  const run = useCallback(
    async <TResult extends { signature: string }>(options: RunOptions<TResult>): Promise<TResult> => {
      setError(null)
      setLastSignature(null)
      setSelectedChainType('solana')

      if (!solanaWallet.publicKey) {
        solanaWallet.connect()
        throw new Error(options.connectMessage)
      }
      if (!solanaWallet.signTransaction) {
        throw new Error('Connected wallet cannot sign transactions')
      }
      if (!config) {
        throw new Error('GRS is not configured for Solana. Set VITE_GRS_DEVNET_MINT / program env.')
      }

      if (options.amountInput !== undefined) {
        const amountInput = options.amountInput.trim()
        if (!amountInput || amountInput === '0' || amountInput === '0.') {
          throw new Error(options.emptyAmountMessage ?? 'Enter an amount')
        }
      }

      try {
        setStatus('building')
        const connection = createGrsSolanaConnection(config)
        const signTransaction = async (transaction: Transaction) => {
          setStatus('signing')
          return solanaWallet.signTransaction!(transaction)
        }
        setStatus('confirming')
        const result = await options.execute({
          connection,
          config,
          publicKey: solanaWallet.publicKey,
          signTransaction,
        })
        setLastSignature(result.signature)
        setStatus('success')
        return result
      } catch (txError) {
        const message = txError instanceof Error ? txError.message : options.failureMessage
        setError(message)
        setStatus('error')
        throw txError
      }
    },
    [config, setSelectedChainType, solanaWallet],
  )

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setLastSignature(null)
  }, [])

  return {
    config,
    run,
    reset,
    status,
    error,
    lastSignature,
    isPending: isGraiTransactionPending(status),
  }
}
