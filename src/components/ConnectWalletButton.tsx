import { useEffect, useState } from 'react'
import { useActiveWallet } from '../hooks/useActiveWallet'
import { ChainSelectorModal } from './ChainSelectorModal'
import { WalletIcon } from './WalletIcon'
import { WalletInfo } from './WalletInfo'
import './WalletStyles.css'

export function ConnectWalletButton() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [connectRequested, setConnectRequested] = useState(false)
  const activeWallet = useActiveWallet()
  const showConnecting = connectRequested && activeWallet.isConnecting

  useEffect(() => {
    if (!activeWallet.isConnecting || activeWallet.isConnected) {
      setConnectRequested(false)
    }
  }, [activeWallet.isConnected, activeWallet.isConnecting])

  if (activeWallet.isConnected) {
    return <WalletInfo />
  }

  return (
    <>
      <button
        className="connect-wallet-btn"
        type="button"
        onClick={() => {
          setConnectRequested(true)
          setIsModalOpen(true)
        }}
        disabled={showConnecting}
      >
        {showConnecting ? (
          <>
            <span className="wallet-spinner" />
            Connecting...
          </>
        ) : (
          <>
            <WalletIcon />
            Connect Wallet
          </>
        )}
      </button>

      <ChainSelectorModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  )
}
