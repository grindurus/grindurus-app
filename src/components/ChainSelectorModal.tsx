import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useWalletContext } from '../providers/AppWalletProvider'
import { useEvmWallet } from '../hooks/useEvmWallet'
import { useSolanaWallet } from '../hooks/useSolanaWallet'
import { WalletIcon } from './WalletIcon'
import './WalletStyles.css'

type TabType = 'evm' | 'solana' | 'movevm'

const EVM_LOADING_STEPS = [
  'Initializing EVM providers…',
  'Detecting installed wallets…',
  'Preparing WalletConnect…',
] as const

function EvmWalletsLoadingPanel() {
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setStepIndex((index) => (index + 1) % EVM_LOADING_STEPS.length)
    }, 1500)

    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="wallet-evm-loading" aria-busy="true" aria-live="polite">
      <div className="wallet-evm-loading-status">
        <span className="wallet-evm-loading-spinner" aria-hidden="true" />
        <span className="wallet-evm-loading-text" key={stepIndex}>
          {EVM_LOADING_STEPS[stepIndex]}
        </span>
      </div>

      <div className="wallet-evm-loading-skeletons">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="wallet-evm-loading-row"
            style={{ animationDelay: `${index * 0.12}s` }}
          >
            <div className="wallet-evm-loading-icon wallet-evm-shimmer" style={{ animationDelay: `${index * 0.18}s` }} />
            <div className="wallet-evm-loading-lines">
              <div
                className="wallet-evm-loading-line wallet-evm-loading-line--title wallet-evm-shimmer"
                style={{ animationDelay: `${index * 0.18 + 0.08}s` }}
              />
              <div
                className="wallet-evm-loading-line wallet-evm-loading-line--desc wallet-evm-shimmer"
                style={{ animationDelay: `${index * 0.18 + 0.16}s` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface ChainSelectorModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ChainSelectorModal({ isOpen, onClose }: ChainSelectorModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('evm')
  const [evmConnectError, setEvmConnectError] = useState('')
  const backdropDismissArmedRef = useRef(false)
  const { setSelectedChainType, requestRainbowKit, isEvmStackReady } = useWalletContext()
  const evmWallet = useEvmWallet()
  const solanaWallet = useSolanaWallet()

  const openRainbowKit = useCallback(() => {
    requestRainbowKit()
    onClose()
  }, [onClose, requestRainbowKit])

  const isWalletConnectConnector = useCallback((connector: { id: string; name: string }) => {
    const id = connector.id.toLowerCase()
    const name = connector.name.toLowerCase()
    return id.includes('walletconnect') || name.includes('walletconnect')
  }, [])

  const getConnectorDisplayName = useCallback(
    (connector: { id: string; name: string }) => {
      if (isWalletConnectConnector(connector)) return 'Rainbow Kit (Wallet Connect)'
      return connector.name
    },
    [isWalletConnectConnector],
  )

  const handleEvmConnectorSelect = useCallback(
    async (connector: { id: string; uid: string; name: string }) => {
      setEvmConnectError('')
      setSelectedChainType('evm')

      try {
        if (isWalletConnectConnector(connector)) {
          if (!evmWallet.canOpenConnectModal) {
            setEvmConnectError('WalletConnect failed. Check WalletConnect Project ID and try again.')
            return
          }
          openRainbowKit()
          return
        }

        await evmWallet.connectWithConnector(connector.uid)
        onClose()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!message.toLowerCase().includes('user rejected')) {
          setEvmConnectError('WalletConnect failed. Check WalletConnect Project ID and try again.')
        }
      }
    },
    [isWalletConnectConnector, openRainbowKit, setSelectedChainType, evmWallet, onClose]
  )

  const handleSolanaWalletSelect = useCallback(async (walletName: string) => {
    setSelectedChainType('solana')
    await solanaWallet.selectWallet(walletName)
    onClose()
  }, [setSelectedChainType, solanaWallet, onClose])

  const handleWalletConnectFallback = useCallback(() => {
    setSelectedChainType('evm')
    if (!evmWallet.canOpenConnectModal) {
      setEvmConnectError('WalletConnect failed. Check WalletConnect Project ID and try again.')
      return
    }
    openRainbowKit()
  }, [evmWallet, openRainbowKit, setSelectedChainType])

  const getConnectorIcon = (connector: { id: string; name: string; icon?: string }) => {
    if (isWalletConnectConnector(connector)) {
      return 'https://raw.githubusercontent.com/rainbow-me/rainbowkit/main/site/public/rainbow.svg'
    }
    if (connector.icon) return connector.icon
    
    const iconMap: Record<string, string> = {
      'metaMask': 'https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg',
      'walletConnect': 'https://avatars.githubusercontent.com/u/37784886?s=200&v=4',
      'walletConnectLegacy': 'https://avatars.githubusercontent.com/u/37784886?s=200&v=4',
      'brave': 'https://brave.com/static-assets/images/brave-logo-sans-text.svg',
      'rabby': 'https://rabby.io/assets/images/logo.svg',
    }
    
    return iconMap[connector.id] || `https://api.dicebear.com/7.x/identicon/svg?seed=${connector.name}`
  }

  const isSolanaMetamask = (walletName: string) => walletName.toLowerCase().includes('metamask')

  useEffect(() => {
    if (!isOpen) {
      backdropDismissArmedRef.current = false
      return
    }

    backdropDismissArmedRef.current = false
    const armTimer = window.setTimeout(() => {
      backdropDismissArmedRef.current = true
    }, 400)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.clearTimeout(armTimer)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (!backdropDismissArmedRef.current) return
    if (e.target === e.currentTarget) {
      onClose()
    }
  }, [onClose])

  return createPortal(
    <div
      className={`wallet-modal-backdrop${isOpen ? ' is-open' : ''}`}
      onClick={handleBackdropClick}
      aria-hidden={!isOpen}
    >
      <div className="wallet-modal" onClick={(e) => e.stopPropagation()}>
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
            type="button"
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
            type="button"
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
            type="button"
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
            <div
              className={`wallet-modal-panel${activeTab === 'evm' ? ' is-active' : ''}`}
              role="tabpanel"
              hidden={activeTab !== 'evm'}
            >
              <div className="wallet-options">
                {!isEvmStackReady ? (
                  <EvmWalletsLoadingPanel />
                ) : evmWallet.connectors.length > 0 ? (
                  evmWallet.connectors.map((connector) => (
                    <button
                      key={connector.uid}
                      className="wallet-option-btn"
                      onClick={() => {
                        void handleEvmConnectorSelect(connector)
                      }}
                    >
                      <img
                        src={getConnectorIcon(connector)}
                        alt={getConnectorDisplayName(connector)}
                        className="wallet-icon"
                      />
                      <div className="wallet-option-info">
                        <span className="wallet-option-name">{getConnectorDisplayName(connector)}</span>
                        <span className="wallet-option-desc wallet-detected">Detected</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="no-wallets-message">
                    <p>No EVM wallets detected</p>
                    <p className="no-wallets-hint">
                      Install MetaMask or use Rainbow Kit to continue
                    </p>
                    <button
                      type="button"
                      className="wallet-option-btn wallet-option-btn--walletconnect"
                      onClick={handleWalletConnectFallback}
                    >
                      <img
                        src="https://raw.githubusercontent.com/rainbow-me/rainbowkit/main/site/public/rainbow.svg"
                        alt="Rainbow Kit (Wallet Connect)"
                        className="wallet-icon"
                      />
                      <div className="wallet-option-info">
                        <span className="wallet-option-name">Rainbow Kit (Wallet Connect)</span>
                        <span className="wallet-option-desc wallet-detected">Open QR modal</span>
                      </div>
                    </button>
                  </div>
                )}
                {evmConnectError && <p className="wallet-evm-error">{evmConnectError}</p>}
              </div>
            </div>

            <div
              className={`wallet-modal-panel${activeTab === 'solana' ? ' is-active' : ''}`}
              role="tabpanel"
              hidden={activeTab !== 'solana'}
            >
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
            </div>

            <div
              className={`wallet-modal-panel${activeTab === 'movevm' ? ' is-active' : ''}`}
              role="tabpanel"
              hidden={activeTab !== 'movevm'}
            >
              <div className="wallet-options">
                <div className="no-wallets-message">
                  <p>MoveVM wallets coming soon</p>
                  <p className="no-wallets-hint">Support for Aptos and Sui wallets is in development</p>
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
