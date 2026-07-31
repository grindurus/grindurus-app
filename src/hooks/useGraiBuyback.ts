import { useCallback } from 'react'
import { PublicKey } from '@solana/web3.js'
import { executeBuyback } from '../grai/buildBuybackTransaction'
import { executeEvmBuyback } from '../grai/evm/executeTransactions'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { useGraiEvmTransaction } from './useGraiEvmTransaction'
import { useGraiTransaction, type GraiTransactionStatus } from './useGraiTransaction'

export type GraiBuybackStatus = GraiTransactionStatus

export function useGraiBuyback() {
  const { chainKind, evm } = useGraiDeployment()
  const {
    run: runSolana,
    reset: resetSolana,
    status: solanaStatus,
    error: solanaError,
    lastSignature: solanaLastSignature,
    isPending: isSolanaPending,
  } = useGraiTransaction()
  const {
    run: runEvm,
    reset: resetEvm,
    status: evmStatus,
    error: evmError,
    lastHash: evmLastHash,
    isPending: isEvmPending,
  } = useGraiEvmTransaction()

  const buyback = useCallback(
    async (params: {
      assetMint: string
      amountInput: string
      assetDecimals?: number
      /** Solana slippage ceiling in GRAI base units. */
      paymentMaxGrai?: bigint
    }) => {
      if (chainKind === 'evm') {
        if (!evm) throw new Error('GRAI is not configured for this EVM network')
        if (params.assetDecimals === undefined) {
          throw new Error('Asset decimals are required for EVM buyback')
        }

        const { hash } = await runEvm({
          connectMessage: 'Connect an EVM wallet to buyback',
          chainAction: 'buyback',
          failureMessage: 'Buyback transaction failed',
          amountInput: params.amountInput,
          emptyAmountMessage: 'Enter an amount to buyback',
          execute: () =>
            executeEvmBuyback({
              config: evm,
              assetAddress: params.assetMint,
              amountInput: params.amountInput,
              assetDecimals: params.assetDecimals!,
            }),
        })
        return hash
      }

      if (chainKind !== 'solana') {
        throw new Error('Buyback is not available on this network')
      }

      const paymentMaxGrai = params.paymentMaxGrai
      if (paymentMaxGrai == null || paymentMaxGrai <= 0n) {
        throw new Error('Buyback payment max is required')
      }

      const assetMint = new PublicKey(params.assetMint)
      const { signature } = await runSolana({
        connectMessage: 'Connect a Solana wallet to buyback',
        clusterAction: 'buyback',
        failureMessage: 'Buyback transaction failed',
        amountInput: params.amountInput,
        emptyAmountMessage: 'Enter an amount to buyback',
        execute: ({ connection, solana, publicKey, signTransaction }) =>
          executeBuyback({
            connection,
            config: solana,
            buyer: publicKey,
            assetMint,
            amountInput: params.amountInput.trim(),
            assetDecimals: params.assetDecimals,
            paymentMaxGrai,
            signTransaction,
          }),
      })
      return signature
    },
    [chainKind, evm, runEvm, runSolana],
  )

  const reset = useCallback(() => {
    resetSolana()
    resetEvm()
  }, [resetEvm, resetSolana])

  const isEvm = chainKind === 'evm'

  return {
    buyback,
    reset,
    status: isEvm ? evmStatus : solanaStatus,
    error: isEvm ? evmError : solanaError,
    lastSignature: isEvm ? evmLastHash : solanaLastSignature,
    isBuyingBack: isEvm ? isEvmPending : isSolanaPending,
  }
}
