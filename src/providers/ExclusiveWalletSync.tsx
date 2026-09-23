import { useEffect, useRef } from 'react'
import { useEvmWallet } from '../hooks/useEvmWallet'
import { useSolanaWallet } from '../hooks/useSolanaWallet'
import { useWalletContext } from './walletContext'

/**
 * Enforce a single connected wallet: EVM XOR Solana.
 * When both are connected, keep the chain matching `selectedChainType`
 * (default EVM) and disconnect the other.
 */
export function ExclusiveWalletSync() {
  const { selectedChainType } = useWalletContext()
  const evmWallet = useEvmWallet()
  const solanaWallet = useSolanaWallet()
  const busyRef = useRef(false)

  const evmConnected = evmWallet.isConnected
  const solanaConnected = solanaWallet.isConnected
  const disconnectEvm = evmWallet.disconnect
  const disconnectSolana = solanaWallet.disconnect

  useEffect(() => {
    if (!evmConnected || !solanaConnected) return
    if (busyRef.current) return

    const keepSolana = selectedChainType === 'solana'
    busyRef.current = true
    const run = async () => {
      try {
        if (keepSolana) {
          await Promise.resolve(disconnectEvm())
        } else {
          await disconnectSolana()
        }
      } finally {
        busyRef.current = false
      }
    }
    void run()
  }, [evmConnected, solanaConnected, selectedChainType, disconnectEvm, disconnectSolana])

  return null
}
