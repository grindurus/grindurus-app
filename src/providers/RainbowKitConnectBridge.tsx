import { useEffect } from 'react'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useWalletContext } from './AppWalletProvider'

/** Opens RainbowKit QR modal after lazy RainbowKitShell has mounted. */
export function RainbowKitConnectBridge() {
  const { openConnectModal } = useConnectModal()
  const { pendingWalletConnectOpen, clearPendingWalletConnectOpen } = useWalletContext()

  useEffect(() => {
    if (!pendingWalletConnectOpen || !openConnectModal) return
    openConnectModal()
    clearPendingWalletConnectOpen()
  }, [pendingWalletConnectOpen, openConnectModal, clearPendingWalletConnectOpen])

  return null
}
