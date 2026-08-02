import { useCallback } from 'react'
import { PublicKey } from '@solana/web3.js'
import { executeDeallocate } from '../grai/buildDeallocateTransaction'
import { useGraiTransaction, type GraiTransactionStatus } from './useGraiTransaction'

export type GraiDeallocateStatus = GraiTransactionStatus

export function useGraiDeallocate() {
  const { run, reset, status, error, lastSignature, isPending } = useGraiTransaction()

  const deallocate = useCallback(
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
        connectMessage: 'Connect the custodian NFT owner wallet to deallocate',
        clusterAction: 'deallocate capital',
        failureMessage: 'Deallocate transaction failed',
        amountInput: params.amountInput,
        emptyAmountMessage: 'Enter an amount to deallocate',
        execute: ({ connection, solana, publicKey, signTransaction }) =>
          executeDeallocate({
            connection,
            config: solana,
            owner: publicKey,
            custodyWallet,
            assetMint,
            amountInput,
            signTransaction,
          }),
      })

      return signature
    },
    [run],
  )

  return {
    deallocate,
    reset,
    status,
    error,
    lastSignature,
    isDeallocating: isPending,
  }
}
