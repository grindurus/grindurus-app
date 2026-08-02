import { useCallback } from 'react'
import { PublicKey } from '@solana/web3.js'
import { executeClaim, executeClaimAll } from '../grai/buildClaimTransaction'
import { executeLock, executeUnlock } from '../grai/buildLockTransaction'
import { estimateSolanaClaimAll } from '../grai/estimateSolanaClaim'
import {
  executeEvmClaim,
  executeEvmClaimAll,
  executeEvmLock,
  executeEvmUnlock,
} from '../grai/evm/executeTransactions'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { useGraiEvmTransaction } from './useGraiEvmTransaction'
import { useGraiTransaction } from './useGraiTransaction'

export function useGraiLock() {
  const { chainKind, evm } = useGraiDeployment()
  const {
    run: runEvm,
    reset: resetEvm,
    status: evmStatus,
    error: evmError,
    lastHash: evmLastHash,
    isPending: isEvmPending,
  } = useGraiEvmTransaction()
  const {
    run: runSolana,
    reset: resetSolana,
    status: solanaStatus,
    error: solanaError,
    lastSignature: solanaLastSignature,
    isPending: isSolanaPending,
  } = useGraiTransaction()

  const lock = useCallback(
    async (params: { amountInput: string; graiDecimals: number }) => {
      if (chainKind === 'solana') {
        const { signature } = await runSolana({
          connectMessage: 'Connect a Solana wallet to lock GRAI',
          clusterAction: 'lock GRAI',
          failureMessage: 'Lock transaction failed',
          amountInput: params.amountInput,
          emptyAmountMessage: 'Enter a GRAI amount to lock',
          execute: ({ connection, solana, publicKey, signTransaction }) =>
            executeLock({
              connection,
              config: solana,
              locker: publicKey,
              amountInput: params.amountInput,
              graiDecimals: params.graiDecimals,
              signTransaction,
            }),
        })
        return signature
      }

      if (chainKind !== 'evm' || !evm) {
        throw new Error('Locking GRAI is not available on this network')
      }

      const { hash } = await runEvm({
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
    [chainKind, evm, runEvm, runSolana],
  )

  const unlock = useCallback(
    async (params: { amountInput: string; graiDecimals: number }) => {
      if (chainKind === 'solana') {
        const { signature } = await runSolana({
          connectMessage: 'Connect a Solana wallet to unlock GRAI',
          clusterAction: 'unlock GRAI',
          failureMessage: 'Unlock transaction failed',
          amountInput: params.amountInput,
          emptyAmountMessage: 'Enter a GRAI amount to unlock',
          execute: ({ connection, solana, publicKey, signTransaction }) =>
            executeUnlock({
              connection,
              config: solana,
              account: publicKey,
              amountInput: params.amountInput,
              graiDecimals: params.graiDecimals,
              signTransaction,
            }),
        })
        return signature
      }

      if (chainKind !== 'evm' || !evm) {
        throw new Error('Unlocking GRAI is not available on this network')
      }

      const { hash } = await runEvm({
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
    [chainKind, evm, runEvm, runSolana],
  )

  const claim = useCallback(
    async (params: {
      assetAddress: string
      amountInput: string
      assetDecimals: number
      holder?: string
    }) => {
      if (chainKind === 'solana') {
        const { signature } = await runSolana({
          connectMessage: 'Connect a Solana wallet to claim dividends',
          clusterAction: 'claim dividends',
          failureMessage: 'Claim transaction failed',
          amountInput: params.amountInput,
          emptyAmountMessage: 'Enter an amount to claim',
          execute: ({ connection, solana: runtime, publicKey, signTransaction }) => {
            const holder = params.holder ? new PublicKey(params.holder) : publicKey
            return executeClaim({
              connection,
              config: runtime,
              holder,
              assetMint: new PublicKey(params.assetAddress),
              amountInput: params.amountInput,
              assetDecimals: params.assetDecimals,
              signTransaction,
            })
          },
        })
        return signature
      }

      if (chainKind !== 'evm' || !evm) {
        throw new Error('Claiming dividends is not available on this network')
      }

      const { hash } = await runEvm({
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
            holder: params.holder?.startsWith('0x')
              ? (params.holder.toLowerCase() as `0x${string}`)
              : undefined,
          }),
      })

      return hash
    },
    [chainKind, evm, runEvm, runSolana],
  )

  const claimAll = useCallback(
    async (params?: { holder?: string }) => {
      if (chainKind === 'solana') {
        const { signature } = await runSolana({
          connectMessage: 'Connect a Solana wallet to claim dividends',
          clusterAction: 'claim dividends',
          failureMessage: 'Claim transaction failed',
          execute: async ({ connection, solana: runtime, publicKey, signTransaction }) => {
            const holder = params?.holder ? new PublicKey(params.holder) : publicKey
            const pending = await estimateSolanaClaimAll(connection, runtime, holder)
            const assetMints = pending
              .filter((row) => row.amountRaw > 0n)
              .map((row) => new PublicKey(row.assetAddress))
            return executeClaimAll({
              connection,
              config: runtime,
              holder,
              assetMints,
              signTransaction,
            })
          },
        })
        return signature
      }

      if (chainKind !== 'evm' || !evm) {
        throw new Error('Claiming dividends is not available on this network')
      }

      const { hash } = await runEvm({
        connectMessage: 'Connect an EVM wallet to claim dividends',
        chainAction: 'claim dividends',
        failureMessage: 'Claim transaction failed',
        execute: () =>
          executeEvmClaimAll({
            config: evm,
            holder: params?.holder?.startsWith('0x')
              ? (params.holder.toLowerCase() as `0x${string}`)
              : undefined,
          }),
      })

      return hash
    },
    [chainKind, evm, runEvm, runSolana],
  )

  const reset = useCallback(() => {
    resetEvm()
    resetSolana()
  }, [resetEvm, resetSolana])

  const isEvm = chainKind === 'evm'

  return {
    lock,
    unlock,
    claim,
    claimAll,
    reset,
    status: isEvm ? evmStatus : solanaStatus,
    error: isEvm ? evmError : solanaError,
    lastHash: isEvm ? evmLastHash : solanaLastSignature,
    isPending: isEvm ? isEvmPending : isSolanaPending,
  }
}
