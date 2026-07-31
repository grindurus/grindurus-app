import { useCallback } from 'react'
import { executeVote } from '../grai/buildVoteTransaction'
import { executeEvmVote } from '../grai/evm/executeTransactions'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { useGraiEvmTransaction } from './useGraiEvmTransaction'
import { useGraiTransaction, type GraiTransactionStatus } from './useGraiTransaction'

export type GraiVoteStatus = GraiTransactionStatus

export function useGraiVote() {
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

  const vote = useCallback(
    async (params: { amountInput: string; graiDecimals: number }) => {
      if (chainKind === 'evm') {
        if (!evm) throw new Error('GRAI is not configured for this EVM network')

        const { hash } = await runEvm({
          connectMessage: 'Connect an EVM wallet to vote for liquidation',
          chainAction: 'vote for liquidation',
          failureMessage: 'Vote transaction failed',
          amountInput: params.amountInput,
          emptyAmountMessage: 'Enter a GRAI amount to vote',
          execute: () =>
            executeEvmVote({
              config: evm,
              amountInput: params.amountInput,
              graiDecimals: params.graiDecimals,
            }),
        })
        return hash
      }

      if (chainKind !== 'solana') {
        throw new Error('Voting is not available on this network')
      }

      const { signature } = await runSolana({
        connectMessage: 'Connect a Solana wallet to vote for liquidation',
        clusterAction: 'vote for liquidation',
        failureMessage: 'Vote transaction failed',
        amountInput: params.amountInput,
        emptyAmountMessage: 'Enter a GRAI amount to vote',
        execute: ({ connection, solana, publicKey, signTransaction }) =>
          executeVote({
            connection,
            config: solana,
            voter: publicKey,
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
    vote,
    reset,
    status: isEvm ? evmStatus : solanaStatus,
    error: isEvm ? evmError : solanaError,
    lastSignature: isEvm ? evmLastHash : solanaLastSignature,
    isVoting: isEvm ? isEvmPending : isSolanaPending,
  }
}
