import { useCallback } from 'react'
import { PublicKey } from '@solana/web3.js'
import { executeAllocate } from '../grai/buildAllocateTransaction'
import { useGraiTransaction, type GraiTransactionStatus } from './useGraiTransaction'

export type GraiAllocateStatus = GraiTransactionStatus

export function useGraiAllocate() {
  const { run, reset, status, error, lastSignature, isPending } = useGraiTransaction()

  const allocate = useCallback(
    async (params: { assetMint: string; custodyWallet: string; amountInput: string }) => {
      const amountInput = params.amountInput.trim()
      const assetMint = new PublicKey(params.assetMint)

      let custodyWallet: PublicKey
      try {
        custodyWallet = new PublicKey(params.custodyWallet.trim())
      } catch {
        throw new Error('Enter a valid custody wallet address')
      }

      const { signature } = await run({
        connectMessage: 'Connect a Solana wallet to allocate capital',
        clusterAction: 'allocate capital',
        failureMessage: 'Allocate transaction failed',
        amountInput: params.amountInput,
        emptyAmountMessage: 'Enter an amount to allocate',
        execute: ({ connection, solana, publicKey, signTransaction, sendTransaction }) =>
          executeAllocate({
            connection,
            config: solana,
            authority: publicKey,
            assetMint,
            custodyWallet,
            amountInput,
            signTransaction,
            sendTransaction,
          }),
      })

      return signature
    },
    [run],
  )

  return {
    allocate,
    reset,
    status,
    error,
    lastSignature,
    isAllocating: isPending,
  }
}
