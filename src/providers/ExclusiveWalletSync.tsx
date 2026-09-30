import { useEffect, useRef } from 'react'
import { useEvmWallet } from '../hooks/useEvmWallet'
import { useSolanaWallet } from '../hooks/useSolanaWallet'
import { useWalletContext } from './walletContext'

function isMetaMaskName(name: string | undefined): boolean {
  return (name ?? '').toLowerCase().includes('metamask')
}

/**
 * Enforce a single *active* wallet for UX: EVM XOR Solana.
 *
 * Exception: MetaMask exposes both an EVM injected provider and a Solana
 * Wallet-Standard adapter from one extension session. Calling wagmi
 * `disconnect()` (or Solana adapter disconnect) tears down that shared
 * session and immediately drops the other chain — which surfaces as
 * `WalletDisconnectedError` right after connecting MetaMask on Solana.
 * In that case we keep both adapters connected and rely on
 * `selectedChainType` for which one the app uses.
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
  const sharedMetaMaskSession =
    isMetaMaskName(evmWallet.connector?.name) || isMetaMaskName(evmWallet.connector?.id)
      ? isMetaMaskName(solanaWallet.wallet?.adapter.name)
      : false

  useEffect(() => {
    if (!evmConnected || !solanaConnected) return
    if (busyRef.current) return
    if (sharedMetaMaskSession) return

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
  }, [
    evmConnected,
    solanaConnected,
    selectedChainType,
    disconnectEvm,
    disconnectSolana,
    sharedMetaMaskSession,
  ])

  return null
}
