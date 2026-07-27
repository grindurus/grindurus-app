import { useCallback } from 'react'
import { executeEvmBribe } from '../grai/evm/executeTransactions'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { useGraiEvmTransaction } from './useGraiEvmTransaction'

export function useGraiBribe() {
  const { chainKind, evm } = useGraiDeployment()
  const { run, reset, status, error, lastHash, isPending } = useGraiEvmTransaction()

  const bribe = useCallback(
    async (params: { voter: `0x${string}`; amountInput: string; graiDecimals: number }) => {
      if (chainKind !== 'evm' || !evm) {
        throw new Error('Bribing is only available on EVM networks')
      }

      const { hash } = await run({
        connectMessage: 'Connect an EVM wallet to bribe against liquidation',
        chainAction: 'bribe against liquidation',
        failureMessage: 'Bribe transaction failed',
        amountInput: params.amountInput,
        emptyAmountMessage: 'Enter a GRAI amount to bribe',
        execute: () =>
          executeEvmBribe({
            config: evm,
            voter: params.voter,
            amountInput: params.amountInput,
            graiDecimals: params.graiDecimals,
          }),
      })

      return hash
    },
    [chainKind, evm, run],
  )

  return {
    bribe,
    reset,
    status,
    error,
    lastHash,
    isBribing: isPending,
  }
}
