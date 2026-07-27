import { useCallback } from 'react'
import { executeEvmVote } from '../grai/evm/executeTransactions'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { useGraiEvmTransaction } from './useGraiEvmTransaction'

export function useGraiVote() {
  const { chainKind, evm } = useGraiDeployment()
  const { run, reset, status, error, lastHash, isPending } = useGraiEvmTransaction()

  const vote = useCallback(
    async (params: { amountInput: string; graiDecimals: number }) => {
      if (chainKind !== 'evm' || !evm) {
        throw new Error('Voting is only available on EVM networks')
      }

      const { hash } = await run({
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
    },
    [chainKind, evm, run],
  )

  return {
    vote,
    reset,
    status,
    error,
    lastHash,
    isVoting: isPending,
  }
}
