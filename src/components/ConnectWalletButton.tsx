import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronRight, LogOut } from 'lucide-react'
import {
  GRAI_NETWORK_UNAVAILABLE_HINT,
  isGraiEvmChainConfigured,
  isGraiSolanaClusterConfigured,
  useGraiNetworkGating,
} from '../grai/networkGating'
import { useActiveWallet } from '../wallets/useActiveWallet'
import { useEvmWallet } from '../wallets/useEvmWallet'
import { useSolanaWallet } from '../wallets/useSolanaWallet'
import { useWalletContext, type EvmChain } from '../wallets/AppWalletProvider'
import { evmChainIdToCaip2, solanaClusterToCaip2 } from '../wallets/caip2Network'
import metamaskFoxIcon from '../assets/metamask-fox.svg'
import { GraiUiCaret } from './grai/GraiUiCaret'
import { SolanaClusterIcon } from './SolanaClusterIcon'
import { EvmChainListIcon } from './WalletNetworkSelect'
import { WalletIcon } from './WalletIcon'
import './WalletStyles.css'
import './HeaderSettingsPopover.css'

const RAINBOW_KIT_ICON =
  'https://raw.githubusercontent.com/rainbow-me/rainbowkit/main/site/public/rainbow.svg'

function isMetaMaskConnector(connector: { id: string; name: string }): boolean {
  const id = connector.id.toLowerCase()
  const name = connector.name.toLowerCase()
  return id.includes('metamask') || name.includes('metamask')
}

function isWalletConnectConnector(connector: { id: string; name: string }): boolean {
  if (isMetaMaskConnector(connector)) return false
  const id = connector.id.toLowerCase()
  const name = connector.name.toLowerCase()
  return id.includes('walletconnect') || name.includes('walletconnect')
}

function resolveEvmWalletIconSrc(connector: {
  id: string
  name: string
  uid?: string
  icon?: string
} | null | undefined): string | null {
  if (!connector) return null
  if (isMetaMaskConnector(connector)) return metamaskFoxIcon
  if (isWalletConnectConnector(connector)) return RAINBOW_KIT_ICON
  if (connector.icon) return connector.icon
  const iconMap: Record<string, string> = {
    walletConnect: RAINBOW_KIT_ICON,
    walletConnectLegacy: RAINBOW_KIT_ICON,
    brave: 'https://brave.com/static-assets/images/brave-logo-sans-text.svg',
    rabby: 'https://rabby.io/assets/images/logo.svg',
  }
  return iconMap[connector.id] ?? `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(connector.name)}`
}

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
  const {
    isChainSelectorOpen,
    openChainSelector,
    warmEvmStack,
    warmSolanaStack,
    selectedChainType,
    setEvmChain,
    setSelectedChainType,
  } = useWalletContext()
  const activeWallet = useActiveWallet()
  const evmWallet = useEvmWallet()
  const solanaWallet = useSolanaWallet()
  const gateGraiNetworks = useGraiNetworkGating()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isNetworkOpen, setIsNetworkOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const showConnecting = isChainSelectorOpen && activeWallet.isConnecting
  const touchOpenedRef = useRef(false)

  const warmActiveStack = useCallback(() => {
    if (selectedChainType === 'solana') warmSolanaStack()
    else warmEvmStack()
  }, [selectedChainType, warmEvmStack, warmSolanaStack])

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
    try {
      await activeWallet.disconnect()
    } finally {
      // Do not reset wallet snapshots here — both stacks stay mounted when
      // disconnected, and a reset wiped live EVM/Solana connector lists
      // ("No EVM wallets detected" on the next Connect Wallet open).
      closeMenu()
    }
  }, [activeWallet, closeMenu])

  const handleNetworkSelect = useCallback(
    (chainId: number) => {
      if (gateGraiNetworks && !isGraiEvmChainConfigured(chainId)) return
      const next = chainIdToEvmChain(chainId)
      if (next) setEvmChain(next)
      setSelectedChainType('evm')
      setIsNetworkOpen(false)
      void (async () => {
        try {
          await evmWallet.switchToChainAsync(chainId)
        } catch (error) {
          console.error('[wallet] switchToChainAsync failed', { chainId, error })
          try {
            evmWallet.switchToChain(chainId)
          } catch (syncError) {
            console.error('[wallet] switchToChain failed', { chainId, error: syncError })
          }
        }
      })()
    },
    [evmWallet, gateGraiNetworks, setEvmChain, setSelectedChainType],
  )

  const handleClusterSelect = useCallback(
    (clusterId: 'mainnet-beta' | 'devnet') => {
      if (gateGraiNetworks && !isGraiSolanaClusterConfigured(clusterId)) return
      solanaWallet.switchCluster(clusterId)
      setIsNetworkOpen(false)
    },
    [gateGraiNetworks, solanaWallet],
  )

  const currentNetworkIcon =
    activeWallet.chainType === 'evm' ? (
      <span className="header-settings-network-icon">
        <EvmChainListIcon name={activeWallet.networkName} />
      </span>
    ) : activeWallet.chainType === 'solana' ? (
      <SolanaClusterIconWrap clusterId={solanaWallet.cluster} />
    ) : null

  const connectedWalletIconSrc = useMemo(() => {
    if (activeWallet.chainType === 'solana') {
      return solanaWallet.wallet?.adapter.icon?.trim() || null
    }
    if (activeWallet.chainType === 'evm') {
      const active = evmWallet.connector
      if (!active) return null
      const fromList =
        evmWallet.connectors.find((item) => item.uid === active.uid || item.id === active.id) ?? active
      return resolveEvmWalletIconSrc(fromList)
    }
    return null
  }, [activeWallet.chainType, evmWallet.connector, evmWallet.connectors, solanaWallet.wallet])

  const connectedWalletName =
    activeWallet.chainType === 'solana'
      ? solanaWallet.wallet?.adapter.name
      : activeWallet.chainType === 'evm'
        ? evmWallet.connector?.name
        : null

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
            className={`header-wallet-address-btn${copied ? ' is-copied' : ''}`}
            onClick={() => void copyAddress()}
            title={copied ? 'Address copied' : `Copy ${activeWallet.shortAddress}`}
            aria-label={
              copied
                ? 'Address copied'
                : `Copy wallet address ${activeWallet.shortAddress} on ${activeWallet.networkName}`
            }
          >
            <span className={`header-wallet-address-idle${copied ? ' is-hidden' : ''}`}>
              {connectedWalletIconSrc ? (
                <img
                  src={connectedWalletIconSrc}
                  alt=""
                  width={22}
                  height={22}
                  className="header-wallet-address-wallet-icon"
                  title={connectedWalletName ?? undefined}
                  decoding="async"
                />
              ) : (
                <WalletIcon size={22} className="header-wallet-address-wallet-icon" />
              )}
              <span className="header-wallet-address-text">{activeWallet.shortAddress}</span>
            </span>
            <span
              className={`header-wallet-address-copied${copied ? ' is-visible' : ''}`}
              aria-hidden={!copied}
            >
              <Check size={14} strokeWidth={2.4} aria-hidden="true" />
              Copied
            </span>
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
                <span className="header-settings-action-caip2" title={activeWallet.networkCaip2}>
                  {activeWallet.networkCaip2}
                </span>
              ) : null}
            </span>
            <ChevronRight className="header-settings-action-chevron" size={16} strokeWidth={2.2} aria-hidden="true" />
          </button>

          {isNetworkOpen && (
            <div className="header-settings-network-list" role="menu" aria-label="Select network">
              {activeWallet.chainType === 'evm' &&
                evmWallet.supportedChains.map((chain) => {
                  const unavailable = gateGraiNetworks && !isGraiEvmChainConfigured(chain.id)
                  return (
                    <button
                      key={chain.id}
                      type="button"
                      role="menuitem"
                      className={`header-settings-network-item${evmWallet.chainId === chain.id ? ' is-active' : ''}${unavailable ? ' is-disabled' : ''}`}
                      onClick={() => handleNetworkSelect(chain.id)}
                      disabled={unavailable}
                      title={unavailable ? GRAI_NETWORK_UNAVAILABLE_HINT : evmChainIdToCaip2(chain.id)}
                    >
                      <span className="header-settings-network-icon">
                        <EvmChainListIcon name={chain.name} />
                      </span>
                      <span className="header-settings-network-text">
                        <span className="header-settings-network-name">{chain.name}</span>
                        <span className="header-settings-network-caip2">{evmChainIdToCaip2(chain.id)}</span>
                      </span>
                    </button>
                  )
                })}
              {activeWallet.chainType === 'solana' &&
                solanaWallet.supportedClusters.map((cluster) => {
                  const unavailable = gateGraiNetworks && !isGraiSolanaClusterConfigured(cluster.id)
                  return (
                    <button
                      key={cluster.id}
                      type="button"
                      role="menuitem"
                      className={`header-settings-network-item${solanaWallet.cluster === cluster.id ? ' is-active' : ''}${unavailable ? ' is-disabled' : ''}`}
                      onClick={() => handleClusterSelect(cluster.id)}
                      disabled={unavailable}
                      title={unavailable ? GRAI_NETWORK_UNAVAILABLE_HINT : solanaClusterToCaip2(cluster.id)}
                    >
                      <SolanaClusterIconWrap clusterId={cluster.id} />
                      <span className="header-settings-network-text">
                        <span className="header-settings-network-name">{cluster.name}</span>
                        <span className="header-settings-network-caip2">{solanaClusterToCaip2(cluster.id)}</span>
                      </span>
                    </button>
                  )
                })}
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
        onPointerEnter={warmActiveStack}
        onFocus={warmActiveStack}
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
