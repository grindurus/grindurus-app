import { useCallback, useState } from 'react'
import { PublicKey, Transaction } from '@solana/web3.js'
import { executeMint } from '../grai/buildMintTransaction'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { useSolanaWallet } from './useSolanaWallet'

export type GraiMintStatus = 'idle' | 'building' | 'signing' | 'confirming' | 'success' | 'error'

export function useGraiMint() {
  const solanaWallet = useSolanaWallet()
  const { connection, solana, clusterMismatch } = useGraiDeployment()
  const [status, setStatus] = useState<GraiMintStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastSignature, setLastSignature] = useState<string | null>(null)

  const mint = useCallback(
    async (params: { assetMint: string; amountInput: string }) => {
      setError(null)
      setLastSignature(null)

      if (!solanaWallet.publicKey) {
        solanaWallet.connect()
        throw new Error('Connect a Solana wallet to mint GRAI')
      }

      if (!solanaWallet.signTransaction) {
        throw new Error('Connected wallet cannot sign transactions')
      }

      if (!connection || !solana) {
        throw new Error('GRAI is not configured for this network')
      }

      if (clusterMismatch) {
        throw new Error(`Switch your Solana wallet to ${solana.cluster} to mint GRAI`)
      }

      const amountInput = params.amountInput.trim()
      if (!amountInput || amountInput === '0' || amountInput === '0.') {
        throw new Error('Enter an amount to mint')
      }

      const minter = solanaWallet.publicKey
      const assetMint = new PublicKey(params.assetMint)

      try {
        setStatus('building')
        const signTransaction = async (transaction: Transaction) => {
          setStatus('signing')
          return solanaWallet.signTransaction!(transaction)
        }

        setStatus('confirming')
        const { signature } = await executeMint({
          connection,
          config: solana,
          minter,
          assetMint,
          amountInput,
          signTransaction,
        })

        setLastSignature(signature)
        setStatus('success')
        return signature
      } catch (mintError) {
        const message =
          mintError instanceof Error ? mintError.message : 'Mint transaction failed'
        setError(message)
        setStatus('error')
        throw mintError
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
    mint,
    reset,
    status,
    error,
    lastSignature,
    isMinting: status === 'building' || status === 'signing' || status === 'confirming',
  }
}
