import { useCallback, useState } from 'react'
import { PublicKey, Transaction } from '@solana/web3.js'
import { executeAllocate } from '../grai/buildAllocateTransaction'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { useSolanaWallet } from './useSolanaWallet'

export type GraiAllocateStatus = 'idle' | 'building' | 'signing' | 'confirming' | 'success' | 'error'

export function useGraiAllocate() {
  const solanaWallet = useSolanaWallet()
  const { connection, solana, clusterMismatch } = useGraiDeployment()
  const [status, setStatus] = useState<GraiAllocateStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastSignature, setLastSignature] = useState<string | null>(null)

  const allocate = useCallback(
    async (params: { assetMint: string; custodyWallet: string; amountInput: string }) => {
      setError(null)
      setLastSignature(null)

      if (!solanaWallet.publicKey) {
        solanaWallet.connect()
        throw new Error('Connect a Solana wallet to allocate capital')
      }

      if (!solanaWallet.signTransaction) {
        throw new Error('Connected wallet cannot sign transactions')
      }

      if (!connection || !solana) {
        throw new Error('GRAI is not configured for this network')
      }

      if (clusterMismatch) {
        throw new Error(`Switch your Solana wallet to ${solana.cluster} to allocate capital`)
      }

      const amountInput = params.amountInput.trim()
      if (!amountInput || amountInput === '0' || amountInput === '0.') {
        throw new Error('Enter an amount to allocate')
      }

      let custodyWallet: PublicKey
      try {
        custodyWallet = new PublicKey(params.custodyWallet.trim())
      } catch {
        throw new Error('Enter a valid custody wallet address')
      }

      const authority = solanaWallet.publicKey
      const assetMint = new PublicKey(params.assetMint)

      try {
        setStatus('building')
        const signTransaction = async (transaction: Transaction) => {
          setStatus('signing')
          return solanaWallet.signTransaction!(transaction)
        }

        setStatus('confirming')
        const { signature } = await executeAllocate({
          connection,
          config: solana,
          authority,
          assetMint,
          custodyWallet,
          amountInput,
          signTransaction,
        })

        setLastSignature(signature)
        setStatus('success')
        return signature
      } catch (allocateError) {
        const message =
          allocateError instanceof Error ? allocateError.message : 'Allocate transaction failed'
        setError(message)
        setStatus('error')
        throw allocateError
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
    allocate,
    reset,
    status,
    error,
    lastSignature,
    isAllocating: status === 'building' || status === 'signing' || status === 'confirming',
  }
}
