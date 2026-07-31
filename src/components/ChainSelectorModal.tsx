import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useWalletContext } from '../providers/AppWalletProvider'
import { useEvmWallet } from '../hooks/useEvmWallet'
import { useSolanaWallet } from '../hooks/useSolanaWallet'
import metamaskFoxIcon from '../assets/metamask-fox.svg'
import { SolanaLogomark } from './SolanaLogomark'
import { WalletIcon } from './WalletIcon'
import './WalletStyles.css'

const RAINBOW_KIT_ICON =
  'https://raw.githubusercontent.com/rainbow-me/rainbowkit/main/site/public/rainbow.svg'

function isMetaMaskConnector(connector: { id: string; name: string }): boolean {
  const id = connector.id.toLowerCase()
  const name = connector.name.toLowerCase()
  return id.includes('metamask') || name.includes('metamask')
}

type TabType = 'evm' | 'solana' | 'movevm' | 'ccxt'

const EVM_LOADING_STEPS = [
  'Initializing EVM providers…',
  'Detecting installed wallets…',
  'Preparing WalletConnect…',
] as const

function EvmWalletsLoadingPanel() {
  const [stepIndex, setStepIndex] = useState(0)
  const progressPercent = Math.round(((stepIndex + 1) / EVM_LOADING_STEPS.length) * 100)

  useEffect(() => {
    const id = window.setInterval(() => {
      setStepIndex((index) => Math.min(index + 1, EVM_LOADING_STEPS.length - 1))
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

      <div
        className="wallet-evm-loading-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
        aria-label="EVM wallet stack loading progress"
      >
        <div className="wallet-evm-loading-progress-track">
          <div
            className="wallet-evm-loading-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="wallet-evm-loading-progress-label">{progressPercent}%</span>
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
    if (isMetaMaskConnector(connector)) return false
    const id = connector.id.toLowerCase()
    const name = connector.name.toLowerCase()
    return id.includes('walletconnect') || name.includes('walletconnect')
  }, [])

  const getConnectorDisplayName = useCallback(
    (connector: { id: string; name: string }) => {
      if (isMetaMaskConnector(connector)) return 'MetaMask'
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
        // MetaMask may use WalletConnect under the hood when the extension is absent —
        // still connect that connector directly (deep link / QR for MetaMask).
        if (isWalletConnectConnector(connector) && !isMetaMaskConnector(connector)) {
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
          setEvmConnectError(
            isMetaMaskConnector(connector)
              ? 'MetaMask connection failed. Try again or install the extension.'
              : 'WalletConnect failed. Check WalletConnect Project ID and try again.',
          )
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
    if (isMetaMaskConnector(connector)) return metamaskFoxIcon
    if (isWalletConnectConnector(connector)) return RAINBOW_KIT_ICON
    if (connector.icon) return connector.icon

    const iconMap: Record<string, string> = {
      walletConnect: RAINBOW_KIT_ICON,
      walletConnectLegacy: RAINBOW_KIT_ICON,
      brave: 'https://brave.com/static-assets/images/brave-logo-sans-text.svg',
      rabby: 'https://rabby.io/assets/images/logo.svg',
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
              <SolanaLogomark size={16} />
            </div>
            Solana
          </button>
          <button
            type="button"
            className={`wallet-tab ${activeTab === 'movevm' ? 'active' : ''}`}
            onClick={() => setActiveTab('movevm')}
          >
            <div className="wallet-tab-icon movevm-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 400 400" fill="currentColor">
                <path d="M383.813 319.691 265.927 36.004a31.518 31.518 0 0 0-56.731.016L91.197 319.679a31.514 31.514 0 0 0 15.5 40.587l63.66 31.667a31.517 31.517 0 0 0 15.566 1.17l36.124-5.137a1.89 1.89 0 0 1 1.935 1.229l17.83 53.559a15.751 15.751 0 0 0 14.877 10.975h47.98a15.749 15.749 0 0 0 14.862-10.995l17.837-53.543a1.893 1.893 0 0 1 1.939-1.229l36.125 5.137a31.515 31.515 0 0 0 15.563-1.171l63.67-31.667a31.513 31.513 0 0 0 15.491-40.574zm-53.737 9.889-48.152 23.941-30.483-4.334a31.518 31.518 0 0 0-32.302 20.468l-6.406 19.236h-25.508l-6.408-19.242a31.52 31.52 0 0 0-32.304-20.462l-30.459 4.334-48.177-23.941 98.63-236.992z" />
              </svg>
            </div>
            MoveVM
          </button>
          <button
            type="button"
            className={`wallet-tab ${activeTab === 'ccxt' ? 'active' : ''}`}
            onClick={() => setActiveTab('ccxt')}
          >
            <div className="wallet-tab-icon ccxt-icon">
              <img
                className="wallet-tab-icon-img"
                src="https://avatars.githubusercontent.com/u/31901609?v=4"
                alt=""
                width={22}
                height={22}
                decoding="async"
                draggable={false}
              />
            </div>
            CCXT
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
                    <a
                      className="wallet-option-btn"
                      href="https://metamask.io/download/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img src={metamaskFoxIcon} alt="MetaMask" className="wallet-icon" />
                      <div className="wallet-option-info">
                        <span className="wallet-option-name">MetaMask</span>
                        <span className="wallet-option-desc">Install extension</span>
                      </div>
                    </a>
                    <button
                      type="button"
                      className="wallet-option-btn wallet-option-btn--walletconnect"
                      onClick={handleWalletConnectFallback}
                    >
                      <img
                        src={RAINBOW_KIT_ICON}
                        alt="Rainbow Kit (Wallet Connect)"
                        className="wallet-icon"
                      />
                      <div className="wallet-option-info">
                        <span className="wallet-option-name">Rainbow Kit (Wallet Connect)</span>
                        <span className="wallet-option-desc">Open QR modal</span>
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
                          <SolanaLogomark
                            size={12}
                            title="Solana"
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

            <div
              className={`wallet-modal-panel${activeTab === 'ccxt' ? ' is-active' : ''}`}
              role="tabpanel"
              hidden={activeTab !== 'ccxt'}
            >
              <div className="wallet-options">
                <button type="button" className="wallet-option-btn wallet-option-btn--ccxt">
                  <img
                    src="https://assets.coingecko.com/markets/images/52/small/binance.jpg"
                    alt="Binance"
                    className="wallet-icon"
                  />
                  <div className="wallet-option-info">
                    <span className="wallet-option-name">Binance</span>
                    <span className="wallet-option-desc">ccxt:binance</span>
                  </div>
                </button>
              </div>
            </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
