import { useCallback } from 'react'
import { PublicKey } from '@solana/web3.js'
import { executeDistribute } from '../grai/buildDistributeTransaction'
import { executeProtocolDistribute } from '../grai/buildProtocolDistributeTransaction'
import { executeEvmDistribute } from '../grai/evm/executeTransactions'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { useGraiEvmTransaction } from './useGraiEvmTransaction'
import { useGraiTransaction, type GraiTransactionStatus } from './useGraiTransaction'

export type GraiDistributeStatus = GraiTransactionStatus

export function useGraiDistribute() {
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

  /** Protocol `distribute` — connected wallet pays listed asset (ops panel). */
  const distribute = useCallback(
    async (params: { assetMint: string; amountInput: string; assetDecimals?: number }) => {
      if (chainKind === 'evm') {
        if (!evm) throw new Error('GRAI is not configured for this EVM network')
        if (params.assetDecimals === undefined) {
          throw new Error('Asset decimals are required for EVM distribute')
        }

        const { hash } = await runEvm({
          connectMessage: 'Connect an EVM wallet to distribute yield',
          chainAction: 'distribute yield',
          failureMessage: 'Distribute transaction failed',
          amountInput: params.amountInput,
          emptyAmountMessage: 'Enter a yield amount to distribute',
          execute: () =>
            executeEvmDistribute({
              config: evm,
              assetAddress: params.assetMint,
              amountInput: params.amountInput,
              assetDecimals: params.assetDecimals!,
            }),
        })
        return hash
      }

      if (chainKind !== 'solana') {
        throw new Error('Distribute is not available on this network')
      }

      const assetMint = new PublicKey(params.assetMint)
      const { signature } = await runSolana({
        connectMessage: 'Connect a Solana wallet to distribute yield',
        clusterAction: 'distribute yield',
        failureMessage: 'Distribute transaction failed',
        amountInput: params.amountInput,
        emptyAmountMessage: 'Enter a yield amount to distribute',
        execute: ({ connection, solana, publicKey, signTransaction }) =>
          executeProtocolDistribute({
            connection,
            config: solana,
            custodyWallet: publicKey,
            assetMint,
            amountInput: params.amountInput.trim(),
            assetDecimals: params.assetDecimals,
            signTransaction,
          }),
      })
      return signature
    },
    [chainKind, evm, runEvm, runSolana],
  )

  /** Grinders custodian CPI — manage page (custody wallet + NFT owner). */
  const custodianDistribute = useCallback(
    async (params: { assetMint: string; amountInput: string }) => {
      const amountInput = params.amountInput.trim()
      const assetMint = new PublicKey(params.assetMint)

      const { signature } = await runSolana({
        connectMessage: 'Connect the custody wallet to distribute yield',
        clusterAction: 'distribute yield',
        failureMessage: 'Distribute transaction failed',
        amountInput: params.amountInput,
        emptyAmountMessage: 'Enter a yield amount to distribute',
        execute: ({ connection, solana, publicKey, signTransaction }) =>
          executeDistribute({
            connection,
            config: solana,
            custodyWallet: publicKey,
            assetMint,
            amountInput,
            signTransaction,
          }),
      })

      return signature
    },
    [runSolana],
  )

  const reset = useCallback(() => {
    resetSolana()
    resetEvm()
  }, [resetEvm, resetSolana])

  const isEvm = chainKind === 'evm'

  return {
    distribute,
    custodianDistribute,
    reset,
    status: isEvm ? evmStatus : solanaStatus,
    error: isEvm ? evmError : solanaError,
    lastSignature: isEvm ? evmLastHash : solanaLastSignature,
    isDistributing: isEvm ? isEvmPending : isSolanaPending,
  }
}
