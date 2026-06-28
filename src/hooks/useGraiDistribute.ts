import { useCallback, useState } from 'react'
import { PublicKey, Transaction } from '@solana/web3.js'
import { executeDistribute } from '../grai/buildDistributeTransaction'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { useSolanaWallet } from './useSolanaWallet'

export type GraiDistributeStatus = 'idle' | 'building' | 'signing' | 'confirming' | 'success' | 'error'

export function useGraiDistribute() {
  const solanaWallet = useSolanaWallet()
  const { connection, solana, clusterMismatch } = useGraiDeployment()
  const [status, setStatus] = useState<GraiDistributeStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastSignature, setLastSignature] = useState<string | null>(null)

  const distribute = useCallback(
    async (params: { assetMint: string; amountInput: string }) => {
      setError(null)
      setLastSignature(null)

      if (!solanaWallet.publicKey) {
        solanaWallet.connect()
        throw new Error('Connect the custody wallet to distribute yield')
      }

      if (!solanaWallet.signTransaction) {
        throw new Error('Connected wallet cannot sign transactions')
      }

      if (!connection || !solana) {
        throw new Error('GRAI is not configured for this network')
      }

      if (clusterMismatch) {
        throw new Error(`Switch your Solana wallet to ${solana.cluster} to distribute yield`)
      }

      const amountInput = params.amountInput.trim()
      if (!amountInput || amountInput === '0' || amountInput === '0.') {
        throw new Error('Enter a yield amount to distribute')
      }

      const custodyWallet = solanaWallet.publicKey
      const assetMint = new PublicKey(params.assetMint)

      try {
        setStatus('building')
        const signTransaction = async (transaction: Transaction) => {
          setStatus('signing')
          return solanaWallet.signTransaction!(transaction)
        }

        setStatus('confirming')
        const { signature } = await executeDistribute({
          connection,
          config: solana,
          custodyWallet,
          assetMint,
          amountInput,
          signTransaction,
        })

        setLastSignature(signature)
        setStatus('success')
        return signature
      } catch (distributeError) {
        const message =
          distributeError instanceof Error ? distributeError.message : 'Distribute transaction failed'
        setError(message)
        setStatus('error')
        throw distributeError
      }
    },
    [clusterMismatch, connection, solana, solanaWallet],
  )

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setLastSignature(null)
  }, [])

  return {
    distribute,
    reset,
    status,
    error,
    lastSignature,
    isDistributing: status === 'building' || status === 'signing' || status === 'confirming',
  }
}
