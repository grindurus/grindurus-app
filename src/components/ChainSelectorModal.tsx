import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useWalletContext } from '../providers/AppWalletProvider'
import { useEvmWallet } from '../hooks/useEvmWallet'
import { useSolanaWallet } from '../hooks/useSolanaWallet'
import { WalletIcon } from './WalletIcon'
import './WalletStyles.css'

type TabType = 'evm' | 'solana' | 'movevm'

interface ChainSelectorModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ChainSelectorModal({ isOpen, onClose }: ChainSelectorModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('evm')
  const [evmConnectError, setEvmConnectError] = useState('')
  const { setSelectedChainType } = useWalletContext()
  const evmWallet = useEvmWallet()
  const solanaWallet = useSolanaWallet()

  useEffect(() => {
    const html = document.documentElement
    if (isOpen) {
      html.style.overflow = 'hidden'
    } else {
      html.style.overflow = ''
    }
    return () => {
      html.style.overflow = ''
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }, [isOpen])

  const handleEvmConnectorSelect = useCallback(
    async (connectorId: string) => {
      setEvmConnectError('')
      setSelectedChainType('evm')
      try {
        await evmWallet.connectWithConnector(connectorId)
        onClose()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!message.toLowerCase().includes('user rejected')) {
          setEvmConnectError('WalletConnect failed. Check WalletConnect Project ID and try again.')
        }
      }
    },
    [setSelectedChainType, evmWallet, onClose]
  )

  const handleSolanaWalletSelect = useCallback(async (walletName: string) => {
    setSelectedChainType('solana')
    await solanaWallet.selectWallet(walletName)
    onClose()
  }, [setSelectedChainType, solanaWallet, onClose])

  const handleWalletConnectFallback = useCallback(() => {
    setSelectedChainType('evm')
    evmWallet.connect()
    onClose()
  }, [setSelectedChainType, evmWallet, onClose])

  const getConnectorIcon = (connector: { id: string; name: string; icon?: string }) => {
    if (connector.icon) return connector.icon
    
    const iconMap: Record<string, string> = {
      'metaMask': 'https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg',
      'walletConnect': 'https://avatars.githubusercontent.com/u/37784886?s=200&v=4',
      'walletConnectLegacy': 'https://avatars.githubusercontent.com/u/37784886?s=200&v=4',
      'coinbaseWallet': 'https://www.coinbase.com/img/favicon/favicon-256.png',
      'coinbaseWalletSDK': 'https://www.coinbase.com/img/favicon/favicon-256.png',
      'brave': 'https://brave.com/static-assets/images/brave-logo-sans-text.svg',
      'rabby': 'https://rabby.io/assets/images/logo.svg',
    }
    
    return iconMap[connector.id] || `https://api.dicebear.com/7.x/identicon/svg?seed=${connector.name}`
  }

  const isSolanaMetamask = (walletName: string) => walletName.toLowerCase().includes('metamask')

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }, [onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="wallet-modal-backdrop" onClick={handleBackdropClick}>
      <div className="wallet-modal">
        <div className="wallet-modal-header">
          <h2>
            <WalletIcon size={20} />
            Connect Wallet
          </h2>
          <button className="wallet-modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="wallet-modal-tabs">
          <button 
            className={`wallet-tab ${activeTab === 'evm' ? 'active' : ''}`}
            onClick={() => setActiveTab('evm')}
          >
            <div className="wallet-tab-icon ethereum-icon">
              <img
                className="wallet-tab-icon-img"
                src="https://assets.coingecko.com/coins/images/279/small/ethereum.png"
                alt=""
                width={22}
                height={22}
                decoding="async"
                draggable={false}
              />
            </div>
            EVM
          </button>
          <button 
            className={`wallet-tab ${activeTab === 'solana' ? 'active' : ''}`}
            onClick={() => setActiveTab('solana')}
          >
            <div className="wallet-tab-icon solana-icon">
              <svg width="16" height="16" viewBox="0 0 397 311" fill="currentColor">
                <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"/>
                <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"/>
                <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"/>
              </svg>
            </div>
            Solana
          </button>
          <button 
            className={`wallet-tab ${activeTab === 'movevm' ? 'active' : ''}`}
            onClick={() => setActiveTab('movevm')}
          >
            <div className="wallet-tab-icon movevm-icon">
              <svg width="16" height="16" viewBox="0 0 100 100" fill="currentColor">
                <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8"/>
                <path d="M30 50 L45 65 L70 35" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            MoveVM
          </button>
        </div>

        <div className="wallet-modal-content">
          {activeTab === 'evm' && (
            <div className="wallet-options">
              {evmWallet.connectors.length > 0 ? (
                evmWallet.connectors.map((connector) => (
                  <button
                    key={connector.uid} 
                    className="wallet-option-btn"
                    onClick={() => {
                      void handleEvmConnectorSelect(connector.uid)
                    }}
                  >
                    <img 
                      src={getConnectorIcon(connector)} 
                      alt={connector.name} 
                      className="wallet-icon"
                    />
                    <div className="wallet-option-info">
                      <span className="wallet-option-name">{connector.name}</span>
                      <span className="wallet-option-desc wallet-detected">Detected</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="no-wallets-message">
                  <p>No EVM wallets detected</p>
                  <p className="no-wallets-hint">
                    Install MetaMask or use WalletConnect (Rainbow) to continue
                  </p>
                  <button
                    type="button"
                    className="wallet-option-btn wallet-option-btn--walletconnect"
                    onClick={handleWalletConnectFallback}
                  >
                    <img
                      src="https://avatars.githubusercontent.com/u/37784886?s=200&v=4"
                      alt="WalletConnect"
                      className="wallet-icon"
                    />
                    <div className="wallet-option-info">
                      <span className="wallet-option-name">WalletConnect (Rainbow)</span>
                      <span className="wallet-option-desc wallet-detected">Open QR modal</span>
                    </div>
                  </button>
                </div>
              )}
              {evmConnectError && <p className="wallet-evm-error">{evmConnectError}</p>}
            </div>
          )}
          {activeTab === 'solana' && (
            <div className="wallet-options">
              {solanaWallet.detectedWallets.length > 0 ? (
                solanaWallet.detectedWallets.map((w) => (
                  <button 
                    key={w.adapter.name} 
                    className="wallet-option-btn"
                    onClick={() => handleSolanaWalletSelect(w.adapter.name)}
                  >
                    <span className={`wallet-icon-wrap ${isSolanaMetamask(w.adapter.name) ? 'has-solana-badge' : ''}`}>
                      <img 
                        src={w.adapter.icon} 
                        alt={w.adapter.name} 
                        className="wallet-icon"
                      />
                      {isSolanaMetamask(w.adapter.name) && (
                        <img
                          src="https://upload.wikimedia.org/wikipedia/en/b/b9/Solana_logo.png"
                          alt="Solana"
                          className="wallet-icon-badge wallet-icon-badge--solana"
                        />
                      )}
                    </span>
                    <div className="wallet-option-info">
                      <span className="wallet-option-name">{w.adapter.name}</span>
                      <span className="wallet-option-desc wallet-detected">Detected</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="no-wallets-message">
                  <p>No Solana wallets detected</p>
                  <p className="no-wallets-hint">Install Phantom, Solflare, or Coinbase Wallet to continue</p>
                </div>
              )}
            </div>
          )}
          {activeTab === 'movevm' && (
            <div className="wallet-options">
              <div className="no-wallets-message">
                <p>MoveVM wallets coming soon</p>
                <p className="no-wallets-hint">Support for Aptos and Sui wallets is in development</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
