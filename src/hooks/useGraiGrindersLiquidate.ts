import { useCallback } from 'react'
import { executeEvmGrindersLiquidate } from '../grai/evm/executeTransactions'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { useGraiEvmTransaction } from './useGraiEvmTransaction'
import type { GraiTransactionStatus } from './useGraiTransaction'

export type GraiGrindersLiquidateStatus = GraiTransactionStatus

function parseCustodianId(input: string, label: string): bigint {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error(`Enter ${label}`)
  }
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${label} must be a non-negative integer`)
  }
  return BigInt(trimmed)
}

export function useGraiGrindersLiquidate() {
  const { chainKind, evm } = useGraiDeployment()
  const { run, reset, status, error, lastHash, isPending } = useGraiEvmTransaction()

  const liquidate = useCallback(
    async (params: { fromIdInput: string; toIdInput: string }) => {
      if (chainKind !== 'evm') {
        throw new Error('Grinders.liquidate(fromId, toId) is only available on EVM')
      }
      if (!evm) throw new Error('GRAI is not configured for this EVM network')

      const fromId = parseCustodianId(params.fromIdInput, 'from id')
      const toId = parseCustodianId(params.toIdInput, 'to id')

      const { hash } = await run({
        connectMessage: 'Connect an EVM wallet to liquidate custodians',
        chainAction: 'liquidate custodians',
        failureMessage: 'Grinders liquidate transaction failed',
        execute: () =>
          executeEvmGrindersLiquidate({
            config: evm,
            fromId,
            toId,
          }),
      })
      return hash
    },
    [chainKind, evm, run],
  )

  return {
    liquidate,
    reset,
    status,
    error,
    lastSignature: lastHash,
    isLiquidating: isPending,
  }
}
