import { useCallback, useState } from 'react'
import { Transaction } from '@solana/web3.js'
import { executeBurn } from '../grai/buildBurnTransaction'
import { createGraiRegistryConnection } from '../grai/constants'
import { useSolanaWallet } from './useSolanaWallet'

export type GraiBurnStatus = 'idle' | 'building' | 'signing' | 'confirming' | 'success' | 'error'

export function useGraiBurn() {
  const solanaWallet = useSolanaWallet()
  const [status, setStatus] = useState<GraiBurnStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastSignature, setLastSignature] = useState<string | null>(null)

  const burn = useCallback(
    async (params: { amountInput: string }) => {
      setError(null)
      setLastSignature(null)

      if (!solanaWallet.publicKey) {
        solanaWallet.connect()
        throw new Error('Connect a Solana wallet to burn GRAI')
      }

      if (!solanaWallet.signTransaction) {
        throw new Error('Connected wallet cannot sign transactions')
      }

      const amountInput = params.amountInput.trim()
      if (!amountInput || amountInput === '0' || amountInput === '0.') {
        throw new Error('Enter an amount to burn')
      }

      const connection = createGraiRegistryConnection()
      const burner = solanaWallet.publicKey

      try {
        setStatus('building')
        const signTransaction = async (transaction: Transaction) => {
          setStatus('signing')
          return solanaWallet.signTransaction!(transaction)
        }

        setStatus('confirming')
        const { signature } = await executeBurn({
          connection,
          burner,
          amountInput,
          signTransaction,
        })

        setLastSignature(signature)
        setStatus('success')
        return signature
      } catch (burnError) {
        const message =
          burnError instanceof Error ? burnError.message : 'Burn transaction failed'
        setError(message)
        setStatus('error')
        throw burnError
      }
    },
    [solanaWallet],
  )

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setLastSignature(null)
  }, [])

  return {
    burn,
    reset,
    status,
    error,
    lastSignature,
    isBurning: status === 'building' || status === 'signing' || status === 'confirming',
  }
}
