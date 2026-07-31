import { useCallback } from 'react'
import { PublicKey } from '@solana/web3.js'
import { executeMint } from '../grai/buildMintTransaction'
import { executeEvmMint } from '../grai/evm/executeTransactions'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { useGraiTransaction, type GraiTransactionStatus } from './useGraiTransaction'
import { useGraiEvmTransaction } from './useGraiEvmTransaction'

export type GraiMintStatus = GraiTransactionStatus

export function useGraiMint() {
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

  const mintSolana = useCallback(
    async (params: {
      assetMint: string
      amountInput: string
      assetDecimals?: number
      lock?: boolean
    }) => {
      const amountInput = params.amountInput.trim()
      const assetMint = new PublicKey(params.assetMint)

      const { signature } = await runSolanaTx({
        connectMessage: 'Connect a Solana wallet to mint GRAI',
        clusterAction: 'mint GRAI',
        failureMessage: 'Mint transaction failed',
        amountInput: params.amountInput,
        emptyAmountMessage: 'Enter an amount to mint',
        execute: ({ connection, solana, publicKey, signTransaction }) =>
          executeMint({
            connection,
            config: solana,
            minter: publicKey,
            assetMint,
            amountInput,
            signTransaction,
            lock: params.lock ?? false,
          }),
      })

      return signature
    },
    [runSolanaTx],
  )

  const mintEvm = useCallback(
    async (params: {
      assetMint: string
      amountInput: string
      assetDecimals: number
      lock?: boolean
    }) => {
      if (!evm) throw new Error('GRAI is not configured for this EVM network')

      const { hash } = await runEvmTx({
        connectMessage: 'Connect an EVM wallet to mint GRAI',
        chainAction: 'mint GRAI',
        failureMessage: 'Mint transaction failed',
        amountInput: params.amountInput,
        emptyAmountMessage: 'Enter an amount to mint',
        execute: () =>
          executeEvmMint({
            config: evm,
            assetAddress: params.assetMint,
            amountInput: params.amountInput,
            assetDecimals: params.assetDecimals,
            lock: params.lock ?? false,
          }),
      })

      return hash
    },
    [evm, runEvmTx],
  )

  const mint = useCallback(
    async (params: {
      assetMint: string
      amountInput: string
      assetDecimals?: number
      lock?: boolean
    }) => {
      if (chainKind === 'evm') {
        if (params.assetDecimals === undefined) {
          throw new Error('Asset decimals are required for EVM mint')
        }
        return mintEvm({
          assetMint: params.assetMint,
          amountInput: params.amountInput,
          assetDecimals: params.assetDecimals,
          lock: params.lock,
        })
      }
      return mintSolana(params)
    },
    [chainKind, mintEvm, mintSolana],
  )

  const reset = useCallback(() => {
    resetSolanaTx()
    resetEvmTx()
  }, [resetEvmTx, resetSolanaTx])

  const isEvm = chainKind === 'evm'

  return {
    mint,
    reset,
    status: isEvm ? evmStatus : solanaStatus,
    error: isEvm ? evmError : solanaError,
    lastSignature: isEvm ? evmLastHash : solanaLastSignature,
    isMinting: isEvm ? isEvmPending : isSolanaPending,
  }
}
