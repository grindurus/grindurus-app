import { useCallback, useState } from 'react'
import { executeBurn } from '../grai/buildBurnTransaction'
import { executeEvmBurn } from '../grai/evm/executeTransactions'
import { GRAI_DECIMALS_EVM } from '../grai/evm/constants'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { useGraiTransaction, type GraiTransactionStatus } from './useGraiTransaction'
import { useGraiEvmTransaction } from './useGraiEvmTransaction'

export type GraiBurnStatus = GraiTransactionStatus

export function useGraiBurn() {
  const { chainKind, evm } = useGraiDeployment()
  const {
    run: runSolanaTx,
    reset: resetSolanaTx,
    status: solanaStatus,
    error: solanaError,
    lastSignature: solanaLastSignature,
    isPending: isSolanaPending,
  } = useGraiTransaction()
  const {
    run: runEvmTx,
    reset: resetEvmTx,
    status: evmStatus,
    error: evmError,
    lastHash: evmLastHash,
    isPending: isEvmPending,
  } = useGraiEvmTransaction()
  const [lastAmountLabel, setLastAmountLabel] = useState<string | null>(null)

  const burnSolana = useCallback(
    async (params: { amountInput: string }) => {
      setLastAmountLabel(null)
      const amountInput = params.amountInput.trim()

      const { signature } = await runSolanaTx({
        connectMessage: 'Connect a Solana wallet to burn GRAI',
        clusterAction: 'burn GRAI',
        failureMessage: 'Burn transaction failed',
        amountInput: params.amountInput,
        emptyAmountMessage: 'Enter an amount to burn',
        execute: async ({ connection, solana, publicKey, signTransaction, sendTransaction }) => {
          const result = await executeBurn({
            connection,
            config: solana,
            burner: publicKey,
            amountInput,
            signTransaction,
            sendTransaction,
          })
          setLastAmountLabel(result.amountLabel)
          return result
        },
      })

      return signature
    },
    [runSolanaTx],
  )

  const burnEvm = useCallback(
    async (params: { amountInput: string; graiDecimals?: number }) => {
      if (!evm) throw new Error('GRAI is not configured for this EVM network')
      setLastAmountLabel(null)

      const { hash } = await runEvmTx({
        connectMessage: 'Connect an EVM wallet to burn GRAI',
        chainAction: 'burn GRAI',
        failureMessage: 'Burn transaction failed',
        amountInput: params.amountInput,
        emptyAmountMessage: 'Enter an amount to burn',
        execute: async () => {
          const result = await executeEvmBurn({
            config: evm,
            amountInput: params.amountInput,
            graiDecimals: params.graiDecimals ?? GRAI_DECIMALS_EVM,
          })
          setLastAmountLabel(result.amountLabel)
          return result
        },
      })

      return hash
    },
    [evm, runEvmTx],
  )

  const burn = useCallback(
    async (params: { amountInput: string; graiDecimals?: number }) => {
      if (chainKind === 'evm') {
        return burnEvm(params)
      }
      return burnSolana(params)
    },
    [burnEvm, burnSolana, chainKind],
  )

  const reset = useCallback(() => {
    resetSolanaTx()
    resetEvmTx()
    setLastAmountLabel(null)
  }, [resetEvmTx, resetSolanaTx])

  const isEvm = chainKind === 'evm'

  return {
    burn,
    reset,
    status: isEvm ? evmStatus : solanaStatus,
    error: isEvm ? evmError : solanaError,
    lastSignature: isEvm ? evmLastHash : solanaLastSignature,
    lastAmountLabel,
    isBurning: isEvm ? isEvmPending : isSolanaPending,
  }
}
