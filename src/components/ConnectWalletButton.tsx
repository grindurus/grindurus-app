import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronRight, LogOut } from 'lucide-react'
import { useActiveWallet } from '../hooks/useActiveWallet'
import { useEvmWallet } from '../hooks/useEvmWallet'
import { useSolanaWallet } from '../hooks/useSolanaWallet'
import { useWalletContext, type EvmChain } from '../providers/AppWalletProvider'
import { evmChainIdToCaip2, solanaClusterToCaip2 } from '../wallet/caip2Network'
import { GraiUiCaret } from './grai/GraiUiCaret'
import { SolanaClusterIcon } from './SolanaClusterIcon'
import { EvmChainListIcon } from './WalletNetworkSelect'
import { WalletIcon } from './WalletIcon'
import './WalletStyles.css'
import './HeaderSettingsPopover.css'

function SolanaClusterIconWrap({ clusterId }: { clusterId: 'mainnet-beta' | 'devnet' }) {
  return (
    <span className={`header-settings-network-icon ${clusterId === 'devnet' ? 'solana-devnet' : 'solana-mainnet'}`}>
      <SolanaClusterIcon clusterId={clusterId} size={20} />
    </span>
  )
}

function chainIdToEvmChain(chainId: number): EvmChain | null {
  if (chainId === 1) return 'ethereum'
  if (chainId === 8453) return 'base'
  if (chainId === 42161) return 'arbitrum'
  if (chainId === 137) return 'polygon'
  if (chainId === 11155111) return 'sepolia'
  return null
}

export function ConnectWalletButton() {
  const { isChainSelectorOpen, openChainSelector, warmEvmStack, setEvmChain } = useWalletContext()
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
      const next = chainIdToEvmChain(chainId)
      if (next) setEvmChain(next)
      setIsNetworkOpen(false)
    },
    [evmWallet, setEvmChain],
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
        <EvmChainListIcon name={activeWallet.networkName} />
      </span>
    ) : activeWallet.chainType === 'solana' ? (
      <SolanaClusterIconWrap clusterId={solanaWallet.cluster} />
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
                      <EvmChainListIcon name={chain.name} />
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
                    <SolanaClusterIconWrap clusterId={cluster.id} />
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
        onPointerEnter={warmEvmStack}
        onFocus={warmEvmStack}
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
