import { useCallback } from 'react'
import {
  executeEvmClaim,
  executeEvmClaimAll,
  executeEvmLock,
  executeEvmUnlock,
} from '../grai/evm/executeTransactions'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { useGraiEvmTransaction } from './useGraiEvmTransaction'

export function useGraiLock() {
  const { chainKind, evm } = useGraiDeployment()
  const { run, reset, status, error, lastHash, isPending } = useGraiEvmTransaction()

  const lock = useCallback(
    async (params: { amountInput: string; graiDecimals: number }) => {
      if (chainKind !== 'evm' || !evm) {
        throw new Error('Locking GRAI is only available on EVM networks')
      }

      const { hash } = await run({
        connectMessage: 'Connect an EVM wallet to lock GRAI',
        chainAction: 'lock GRAI',
        failureMessage: 'Lock transaction failed',
        amountInput: params.amountInput,
        emptyAmountMessage: 'Enter a GRAI amount to lock',
        execute: () =>
          executeEvmLock({
            config: evm,
            amountInput: params.amountInput,
            graiDecimals: params.graiDecimals,
          }),
      })

      return hash
    },
    [chainKind, evm, run],
  )

  const unlock = useCallback(
    async (params: { amountInput: string; graiDecimals: number }) => {
      if (chainKind !== 'evm' || !evm) {
        throw new Error('Unlocking GRAI is only available on EVM networks')
      }

      const { hash } = await run({
        connectMessage: 'Connect an EVM wallet to unlock GRAI',
        chainAction: 'unlock GRAI',
        failureMessage: 'Unlock transaction failed',
        amountInput: params.amountInput,
        emptyAmountMessage: 'Enter a GRAI amount to unlock',
        execute: () =>
          executeEvmUnlock({
            config: evm,
            amountInput: params.amountInput,
            graiDecimals: params.graiDecimals,
          }),
      })

      return hash
    },
    [chainKind, evm, run],
  )

  const claim = useCallback(
    async (params: { assetAddress: string; amountInput: string; assetDecimals: number }) => {
      if (chainKind !== 'evm' || !evm) {
        throw new Error('Claiming dividends is only available on EVM networks')
      }

      const { hash } = await run({
        connectMessage: 'Connect an EVM wallet to claim dividends',
        chainAction: 'claim dividends',
        failureMessage: 'Claim transaction failed',
        amountInput: params.amountInput,
        emptyAmountMessage: 'Enter an amount to claim',
        execute: () =>
          executeEvmClaim({
            config: evm,
            assetAddress: params.assetAddress,
            amountInput: params.amountInput,
            assetDecimals: params.assetDecimals,
          }),
      })

      return hash
    },
    [chainKind, evm, run],
  )

  const claimAll = useCallback(async () => {
    if (chainKind !== 'evm' || !evm) {
      throw new Error('Claiming dividends is only available on EVM networks')
    }

    const { hash } = await run({
      connectMessage: 'Connect an EVM wallet to claim dividends',
      chainAction: 'claim dividends',
      failureMessage: 'Claim transaction failed',
      execute: () => executeEvmClaimAll({ config: evm }),
    })

    return hash
  }, [chainKind, evm, run])

  return {
    lock,
    unlock,
    claim,
    claimAll,
    reset,
    status,
    error,
    lastHash,
    isPending,
  }
}
