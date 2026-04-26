import { useEffect, useState } from 'react'
import { useActiveWallet } from '../hooks/useActiveWallet'
import { ChainSelectorModal } from './ChainSelectorModal'
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h13A2.5 2.5 0 0 1 21 8.5v7A2.5 2.5 0 0 1 18.5 18h-13A2.5 2.5 0 0 1 3 15.5v-7Z" />
              <path d="M15 12h6" />
              <circle cx="15.5" cy="12" r="1" fill="currentColor" stroke="none" />
            </svg>
            Connect Wallet
          </>
        )}
      </button>

      <ChainSelectorModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  )
}
