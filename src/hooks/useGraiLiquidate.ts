import { useCallback } from 'react'
import { executeConfirm } from '../grai/buildConfirmTransaction'
import { executeLiquidate } from '../grai/buildLiquidateTransaction'
import { executeEvmGrindersConfirm, executeEvmLiquidate } from '../grai/evm/executeTransactions'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { useGraiEvmTransaction } from './useGraiEvmTransaction'
import { useGraiTransaction, type GraiTransactionStatus } from './useGraiTransaction'

export type GraiLiquidateStatus = GraiTransactionStatus

export function useGraiLiquidate() {
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

  const confirmLiquidation = useCallback(
    async (params?: { connectMessage?: string; chainAction?: string; failureMessage?: string }) => {
      const connectMessage =
        params?.connectMessage ?? 'Connect a wallet to confirm liquidation'
      const chainAction = params?.chainAction ?? 'confirm liquidation'
      const failureMessage = params?.failureMessage ?? 'Confirm transaction failed'

      if (chainKind === 'evm') {
        if (!evm) throw new Error('GRAI is not configured for this EVM network')
        const { hash } = await runEvm({
          connectMessage,
          chainAction,
          failureMessage,
          execute: () => executeEvmGrindersConfirm({ config: evm }),
        })
        return hash
      }

      if (chainKind !== 'solana') {
        throw new Error('Confirm is not available on this network')
      }

      const { signature } = await runSolana({
        connectMessage,
        clusterAction: chainAction,
        failureMessage,
        execute: ({ connection, solana, publicKey, signTransaction }) =>
          executeConfirm({
            connection,
            config: solana,
            owner: publicKey,
            signTransaction,
          }),
      })
      return signature
    },
    [chainKind, evm, runEvm, runSolana],
  )

  const liquidate = useCallback(
    async (params?: { connectMessage?: string; chainAction?: string; failureMessage?: string }) => {
      const connectMessage =
        params?.connectMessage ?? 'Connect a wallet to open liquidation'
      const chainAction = params?.chainAction ?? 'open liquidation'
      const failureMessage = params?.failureMessage ?? 'Liquidate transaction failed'

      if (chainKind === 'evm') {
        if (!evm) throw new Error('GRAI is not configured for this EVM network')

        const { hash } = await runEvm({
          connectMessage,
          chainAction,
          failureMessage,
          execute: () => executeEvmLiquidate({ config: evm }),
        })
        return hash
      }

      if (chainKind !== 'solana') {
        throw new Error('Liquidate is not available on this network')
      }

      const { signature } = await runSolana({
        connectMessage,
        clusterAction: chainAction,
        failureMessage,
        execute: ({ connection, solana, publicKey, signTransaction }) =>
          executeLiquidate({
            connection,
            config: solana,
            caller: publicKey,
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
    confirmLiquidation,
    liquidate,
    reset,
    status: isEvm ? evmStatus : solanaStatus,
    error: isEvm ? evmError : solanaError,
    lastSignature: isEvm ? evmLastHash : solanaLastSignature,
    isLiquidating: isEvm ? isEvmPending : isSolanaPending,
  }
}
