import { useCallback, useState } from 'react'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { useEvmWallet } from '../wallets/useEvmWallet'
import { useWalletContext } from '../wallets/AppWalletProvider'
import { isGraiTransactionPending, type GraiTransactionStatus } from './useGraiTransaction'

export function useGraiEvmTransaction() {
  const evmWallet = useEvmWallet()
  const { evm, evmChainMismatch } = useGraiDeployment()
  const { openChainSelector, requestRainbowKit } = useWalletContext()
  const [status, setStatus] = useState<GraiTransactionStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastHash, setLastHash] = useState<string | null>(null)

  const run = useCallback(
    async <TResult extends { hash: string }>(options: {
      connectMessage: string
      chainAction: string
      failureMessage: string
      amountInput?: string
      emptyAmountMessage?: string
      execute: () => Promise<TResult>
    }): Promise<TResult> => {
      setError(null)
      setLastHash(null)

      if (!evmWallet.isConnected) {
        requestRainbowKit()
        openChainSelector()
        throw new Error(options.connectMessage)
      }

      if (!evm) {
        throw new Error('GRAI is not configured for this EVM network')
      }

      if (evmChainMismatch) {
        try {
          await evmWallet.switchToChainAsync(evm.chainId)
        } catch {
          throw new Error(`Switch your wallet to ${evm.chainName} to ${options.chainAction}`)
        }
      }

      if (options.amountInput !== undefined) {
        const amountInput = options.amountInput.trim()
        if (!amountInput || amountInput === '0' || amountInput === '0.') {
          throw new Error(options.emptyAmountMessage ?? 'Enter an amount')
        }
      }

      try {
        setStatus('building')
        setStatus('signing')
        setStatus('confirming')
        const result = await options.execute()
        setLastHash(result.hash)
        setStatus('success')
        return result
      } catch (txError) {
        const message = txError instanceof Error ? txError.message : options.failureMessage
        setError(message)
        setStatus('error')
        throw txError
      }
    },
    [evm, evmChainMismatch, evmWallet, openChainSelector, requestRainbowKit],
  )

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setLastHash(null)
  }, [])

  return {
    run,
    reset,
    status,
    error,
    lastHash,
    isPending: isGraiTransactionPending(status),
  }
}
