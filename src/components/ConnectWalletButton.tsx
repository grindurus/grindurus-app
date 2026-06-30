import { useState } from 'react'
import { useActiveWallet } from '../hooks/useActiveWallet'
import { ChainSelectorModal } from './ChainSelectorModal'
import { WalletIcon } from './WalletIcon'
import { WalletInfo } from './WalletInfo'
import './WalletStyles.css'

export function ConnectWalletButton() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const activeWallet = useActiveWallet()
  const showConnecting = isModalOpen && activeWallet.isConnecting

  const closeModal = () => {
    setIsModalOpen(false)
  }

  if (activeWallet.isConnected) {
    return (
      <div className="header-wallet-slot header-wallet-slot--connected">
        <WalletInfo />
      </div>
    )
  }

  return (
    <div className="header-wallet-slot">
      <button
        className="connect-wallet-btn"
        type="button"
        onClick={() => {
          setIsModalOpen(true)
        }}
        disabled={showConnecting}
      >
        {showConnecting ? (
          <>
            <span className="wallet-spinner" />
            <span className="connect-wallet-btn-label">Connecting...</span>
          </>
        ) : (
          <>
            <WalletIcon />
            <span className="connect-wallet-btn-label">Connect Wallet</span>
          </>
        )}
      </button>

      <ChainSelectorModal isOpen={isModalOpen} onClose={closeModal} />
    </div>
  )
}
