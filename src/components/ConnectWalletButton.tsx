import { useCallback, useRef } from 'react'
import { useActiveWallet } from '../hooks/useActiveWallet'
import { useWalletContext } from '../providers/AppWalletProvider'
import { WalletIcon } from './WalletIcon'
import { WalletInfo } from './WalletInfo'
import './WalletStyles.css'

export function ConnectWalletButton() {
  const { isChainSelectorOpen, openChainSelector } = useWalletContext()
  const activeWallet = useActiveWallet()
  const showConnecting = isChainSelectorOpen && activeWallet.isConnecting
  const touchOpenedRef = useRef(false)

  const handleOpen = useCallback(() => {
    if (showConnecting) return
    openChainSelector()
  }, [openChainSelector, showConnecting])

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType !== 'touch' || showConnecting) return
      touchOpenedRef.current = true
      handleOpen()
    },
    [handleOpen, showConnecting],
  )

  const handleClick = useCallback(() => {
    if (touchOpenedRef.current) {
      touchOpenedRef.current = false
      return
    }
    handleOpen()
  }, [handleOpen])

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
        onPointerUp={handlePointerUp}
        onClick={handleClick}
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
