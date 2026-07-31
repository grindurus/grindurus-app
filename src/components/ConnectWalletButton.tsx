import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronRight, LogOut } from 'lucide-react'
import baseNetworkIcon from '../assets/base-network.svg'
import ethereumNetworkIcon from '../assets/ethereum-network.svg'
import { useActiveWallet } from '../hooks/useActiveWallet'
import { useEvmWallet } from '../hooks/useEvmWallet'
import { useSolanaWallet } from '../hooks/useSolanaWallet'
import { useWalletContext } from '../providers/AppWalletProvider'
import { evmChainIdToCaip2, solanaClusterToCaip2 } from '../wallet/caip2Network'
import { GraiUiCaret } from './grai/GraiUiCaret'
import { SolanaLogomark } from './SolanaLogomark'
import { WalletIcon } from './WalletIcon'
import './WalletStyles.css'
import './HeaderSettingsPopover.css'

function EvmChainIcon({ name }: { name: string }) {
  if (name === 'Ethereum') {
    return <img src={ethereumNetworkIcon} alt="" width={20} height={20} />
  }
  if (name === 'Arbitrum') {
    return (
      <img
        src="https://cryptologos.cc/logos/arbitrum-arb-logo.png?v=040"
        alt=""
        width={20}
        height={20}
      />
    )
  }
  if (name === 'Sepolia') {
    return (
      <svg width="20" height="20" viewBox="0 0 256 417" fill="#9CA3AF" aria-hidden="true">
        <path d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" fillOpacity="0.8" />
        <path d="M127.962 0L0 212.32l127.962 75.639V154.158z" fillOpacity="0.5" />
        <path d="M127.961 287.958l127.96-75.637-127.96-58.162z" fillOpacity="1" />
        <path d="M0 212.32l127.96 75.638v-133.8z" fillOpacity="0.6" />
      </svg>
    )
  }
  if (name === 'Base' || name === 'Base Sepolia') {
    return <img src={baseNetworkIcon} alt="" width={20} height={20} />
  }
  return null
}

function SolanaClusterIcon({ clusterId }: { clusterId: 'mainnet-beta' | 'devnet' }) {
  return (
    <span className={`header-settings-network-icon ${clusterId === 'devnet' ? 'solana-devnet' : 'solana-mainnet'}`}>
      <SolanaLogomark size={16} />
    </span>
  )
}

export function ConnectWalletButton() {
  const { isChainSelectorOpen, openChainSelector } = useWalletContext()
  const activeWallet = useActiveWallet()
  const evmWallet = useEvmWallet()
  const solanaWallet = useSolanaWallet()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isNetworkOpen, setIsNetworkOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
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

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false)
    setIsNetworkOpen(false)
  }, [])

  useEffect(() => {
    if (!isMenuOpen) return
    const onDocumentClick = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      closeMenu()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }
    document.addEventListener('mousedown', onDocumentClick)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocumentClick)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [closeMenu, isMenuOpen])

  const copyAddress = useCallback(async () => {
    if (!activeWallet.address) return
    await navigator.clipboard.writeText(activeWallet.address)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }, [activeWallet.address])

  const handleDisconnect = useCallback(async () => {
    await activeWallet.disconnect()
    closeMenu()
  }, [activeWallet, closeMenu])

  const handleNetworkSelect = useCallback(
    (chainId: number) => {
      evmWallet.switchToChain(chainId)
      setIsNetworkOpen(false)
    },
    [evmWallet],
  )

  const handleClusterSelect = useCallback(
    (clusterId: 'mainnet-beta' | 'devnet') => {
      solanaWallet.switchCluster(clusterId)
      setIsNetworkOpen(false)
    },
    [solanaWallet],
  )

  const currentNetworkIcon =
    activeWallet.chainType === 'evm' ? (
      <span className="header-settings-network-icon">
        <EvmChainIcon name={activeWallet.networkName} />
      </span>
    ) : activeWallet.chainType === 'solana' ? (
      <SolanaClusterIcon clusterId={solanaWallet.cluster} />
    ) : null

  if (activeWallet.isConnected) {
    const toggleMenu = () =>
      setIsMenuOpen((open) => {
        if (open) setIsNetworkOpen(false)
        return !open
      })

    const toggleNetworkMenu = () => {
      if (isMenuOpen && isNetworkOpen) {
        closeMenu()
        return
      }
      setIsMenuOpen(true)
      setIsNetworkOpen(true)
    }

    return (
      <div className="header-wallet-slot header-wallet-slot--connected" ref={rootRef}>
        <div className={`header-wallet-address-group${copied ? ' is-copied' : ''}${isMenuOpen ? ' is-menu-open' : ''}`}>
          {currentNetworkIcon ? (
            <button
              type="button"
              className="header-wallet-network-btn"
              onClick={toggleNetworkMenu}
              title={`${activeWallet.networkName} · Switch network`}
              aria-label={`${isMenuOpen && isNetworkOpen ? 'Close' : 'Open'} network menu for ${activeWallet.networkName}`}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen && isNetworkOpen}
            >
              <span className="header-wallet-network-icon" aria-hidden="true">
                {currentNetworkIcon}
              </span>
            </button>
          ) : null}
          <button
            type="button"
            className="header-wallet-address-btn"
            onClick={() => void copyAddress()}
            title={copied ? 'Address copied' : `Copy ${activeWallet.shortAddress}`}
            aria-label={
              copied
                ? 'Address copied'
                : `Copy wallet address ${activeWallet.shortAddress} on ${activeWallet.networkName}`
            }
          >
            {copied ? (
              <span className="header-wallet-address-copied">
                <Check size={14} strokeWidth={2.4} aria-hidden="true" />
                Copied
              </span>
            ) : (
              <span className="header-wallet-address-text">{activeWallet.shortAddress}</span>
            )}
          </button>
          <button
            type="button"
            className="header-wallet-address-caret-btn"
            onClick={toggleMenu}
            title="Wallet menu"
            aria-label={`${isMenuOpen ? 'Close' : 'Open'} wallet menu`}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
          >
            <GraiUiCaret className="header-wallet-address-caret" />
          </button>
        </div>

        <div
          className={`header-wallet-menu${isMenuOpen ? ' is-open' : ''}`}
          role="menu"
          aria-label="Wallet menu"
          aria-hidden={!isMenuOpen}
        >
          <button
            type="button"
            className="header-settings-action"
            role="menuitem"
            onClick={() => setIsNetworkOpen((open) => !open)}
            aria-expanded={isNetworkOpen}
          >
            {currentNetworkIcon}
            <span className="header-settings-action-label">
              <span className="header-settings-action-name">{activeWallet.networkName}</span>
              {activeWallet.networkCaip2 ? (
                <span className="header-settings-action-caip2">{activeWallet.networkCaip2}</span>
              ) : null}
            </span>
            <ChevronRight className="header-settings-action-chevron" size={16} strokeWidth={2.2} aria-hidden="true" />
          </button>

          {isNetworkOpen && (
            <div className="header-settings-network-list" role="menu" aria-label="Select network">
              {activeWallet.chainType === 'evm' &&
                evmWallet.supportedChains.map((chain) => (
                  <button
                    key={chain.id}
                    type="button"
                    role="menuitem"
                    className={`header-settings-network-item${evmWallet.chainId === chain.id ? ' is-active' : ''}`}
                    onClick={() => handleNetworkSelect(chain.id)}
                    title={evmChainIdToCaip2(chain.id)}
                  >
                    <span className="header-settings-network-icon">
                      <EvmChainIcon name={chain.name} />
                    </span>
                    <span className="header-settings-network-text">
                      <span className="header-settings-network-name">{chain.name}</span>
                      <span className="header-settings-network-caip2">{evmChainIdToCaip2(chain.id)}</span>
                    </span>
                  </button>
                ))}
              {activeWallet.chainType === 'solana' &&
                solanaWallet.supportedClusters.map((cluster) => (
                  <button
                    key={cluster.id}
                    type="button"
                    role="menuitem"
                    className={`header-settings-network-item${solanaWallet.cluster === cluster.id ? ' is-active' : ''}`}
                    onClick={() => handleClusterSelect(cluster.id)}
                    title={solanaClusterToCaip2(cluster.id)}
                  >
                    <SolanaClusterIcon clusterId={cluster.id} />
                    <span className="header-settings-network-text">
                      <span className="header-settings-network-name">{cluster.name}</span>
                      <span className="header-settings-network-caip2">{solanaClusterToCaip2(cluster.id)}</span>
                    </span>
                  </button>
                ))}
            </div>
          )}

          <button
            type="button"
            className="header-settings-action header-settings-action--disconnect"
            role="menuitem"
            onClick={() => void handleDisconnect()}
          >
            <LogOut size={16} strokeWidth={2} aria-hidden="true" />
            <span className="header-settings-action-label">Disconnect</span>
          </button>
        </div>
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
