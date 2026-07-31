import { useCallback } from 'react'
import { PublicKey } from '@solana/web3.js'
import { executeBribe } from '../grai/buildBribeTransaction'
import { executeEvmBribe } from '../grai/evm/executeTransactions'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { useGraiEvmTransaction } from './useGraiEvmTransaction'
import { useGraiTransaction, type GraiTransactionStatus } from './useGraiTransaction'

export type GraiBribeStatus = GraiTransactionStatus

export function useGraiBribe() {
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

  const bribe = useCallback(
    async (params: { voter: string; amountInput: string; graiDecimals: number }) => {
      if (chainKind === 'evm') {
        if (!evm) throw new Error('GRAI is not configured for this EVM network')

        const { hash } = await runEvm({
          connectMessage: 'Connect an EVM wallet to bribe against liquidation',
          chainAction: 'bribe against liquidation',
          failureMessage: 'Bribe transaction failed',
          amountInput: params.amountInput,
          emptyAmountMessage: 'Enter a GRAI amount to bribe',
          execute: () =>
            executeEvmBribe({
              config: evm,
              voter: params.voter as `0x${string}`,
              amountInput: params.amountInput,
              graiDecimals: params.graiDecimals,
            }),
        })
        return hash
      }

      if (chainKind !== 'solana') {
        throw new Error('Bribing is not available on this network')
      }

      const voter = new PublicKey(params.voter)
      const { signature } = await runSolana({
        connectMessage: 'Connect a Solana wallet to bribe against liquidation',
        clusterAction: 'bribe against liquidation',
        failureMessage: 'Bribe transaction failed',
        amountInput: params.amountInput,
        emptyAmountMessage: 'Enter a GRAI amount to bribe',
        execute: ({ connection, solana, publicKey, signTransaction }) =>
          executeBribe({
            connection,
            config: solana,
            briber: publicKey,
            voter,
            amountInput: params.amountInput.trim(),
            graiDecimals: params.graiDecimals,
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
    bribe,
    reset,
    status: isEvm ? evmStatus : solanaStatus,
    error: isEvm ? evmError : solanaError,
    lastSignature: isEvm ? evmLastHash : solanaLastSignature,
    isBribing: isEvm ? isEvmPending : isSolanaPending,
  }
}
