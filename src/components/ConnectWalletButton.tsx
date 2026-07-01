import { useActiveWallet } from '../hooks/useActiveWallet'
import { useWalletContext } from '../providers/AppWalletProvider'
import { WalletIcon } from './WalletIcon'
import { WalletInfo } from './WalletInfo'
import './WalletStyles.css'

export function ConnectWalletButton() {
  const { isChainSelectorOpen, openChainSelector } = useWalletContext()
  const activeWallet = useActiveWallet()
  const showConnecting = isChainSelectorOpen && activeWallet.isConnecting

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
          openChainSelector()
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
    </div>
  )
}
