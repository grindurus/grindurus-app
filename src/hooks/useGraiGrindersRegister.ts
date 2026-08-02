import { useCallback } from 'react'
import { isAddress } from 'viem'
import { executeEvmGrindersRegister } from '../grai/evm/executeTransactions'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { useGraiEvmTransaction } from './useGraiEvmTransaction'
import type { GraiTransactionStatus } from './useGraiTransaction'

export type GraiGrindersRegisterStatus = GraiTransactionStatus

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

function parseAddress(input: string, label: string, allowZero = false): `0x${string}` {
  const trimmed = input.trim()
  if (!trimmed) {
    if (allowZero) return ZERO_ADDRESS
    throw new Error(`Enter ${label}`)
  }
  if (!isAddress(trimmed)) {
    throw new Error(`${label} must be a valid address`)
  }
  return trimmed as `0x${string}`
}

export function useGraiGrindersRegister() {
  const { chainKind, evm } = useGraiDeployment()
  const { run, reset, status, error, lastHash, isPending } = useGraiEvmTransaction()

  const register = useCallback(
    async (params: { custodianInput: string; ownerInput: string }) => {
      if (chainKind !== 'evm') {
        throw new Error('Grinders.register is only available on EVM')
      }
      if (!evm) throw new Error('GRAI is not configured for this EVM network')

      const custodian = parseAddress(params.custodianInput, 'custodian')
      if (custodian === ZERO_ADDRESS) {
        throw new Error('Custodian cannot be the zero address')
      }
      const owner = parseAddress(params.ownerInput, 'owner', true)

      const { hash } = await run({
        connectMessage: 'Connect the Grinders owner wallet to register a custodian',
        chainAction: 'register custodian',
        failureMessage: 'Grinders register transaction failed',
        execute: () =>
          executeEvmGrindersRegister({
            config: evm,
            custodian,
            owner,
          }),
      })
      return hash
    },
    [chainKind, evm, run],
  )

  return {
    register,
    reset,
    status,
    error,
    lastSignature: lastHash,
    isRegistering: isPending,
  }
}
