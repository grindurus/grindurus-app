import { useCallback, useState } from 'react'
import { useEvmWallet } from './useEvmWallet'
import { useWalletContext } from '../providers/AppWalletProvider'
import { isGraiTransactionPending, type GraiTransactionStatus } from './useGraiTransaction'
import type { GrsEvmConfig } from '../grs/deployments'

export function useGrsEvmTransaction() {
  const evmWallet = useEvmWallet()
  const { openChainSelector, requestRainbowKit, setSelectedChainType } = useWalletContext()
  const [status, setStatus] = useState<GraiTransactionStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastHash, setLastHash] = useState<string | null>(null)

  const run = useCallback(
    async <TResult extends { hash: string }>(options: {
      config: GrsEvmConfig | null
      connectMessage: string
      chainAction: string
      failureMessage: string
      amountInput?: string
      emptyAmountMessage?: string
      execute: () => Promise<TResult>
    }): Promise<TResult> => {
      setError(null)
      setLastHash(null)
      setSelectedChainType('evm')

      if (!evmWallet.isConnected) {
        requestRainbowKit()
        openChainSelector()
        throw new Error(options.connectMessage)
      }

      if (!options.config) {
        throw new Error('GRS is not configured for this EVM network. Set VITE_GRS_*_TOKEN.')
      }

      if (evmWallet.chainId !== options.config.chainId) {
        try {
          await evmWallet.switchToChainAsync(options.config.chainId)
        } catch {
          throw new Error(`Switch your wallet to ${options.config.chainName} to ${options.chainAction}`)
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
    [evmWallet, openChainSelector, requestRainbowKit, setSelectedChainType],
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
