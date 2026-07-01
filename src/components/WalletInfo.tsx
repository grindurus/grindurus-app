import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useActiveWallet } from '../hooks/useActiveWallet'
import { useEvmWallet } from '../hooks/useEvmWallet'
import { useSolanaWallet } from '../hooks/useSolanaWallet'
import baseNetworkIcon from '../assets/base-network.svg'
import { WalletExpandToggle } from './WalletExpandToggle'
import './WalletStyles.css'

const BASE_CHAIN_ID = 8453
const BASE_SEPOLIA_CHAIN_ID = 84532

export function WalletInfo() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isNetworkDropdownOpen, setIsNetworkDropdownOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [isMobileMenu, setIsMobileMenu] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches,
  )
  const activeWallet = useActiveWallet()
  const evmWallet = useEvmWallet()
  const solanaWallet = useSolanaWallet()

  const handleClickOutside = useCallback((e: MouseEvent) => {
    const target = e.target as Node
    if (dropdownRef.current?.contains(target)) return
    if (menuRef.current?.contains(target)) return
    setIsDropdownOpen(false)
    setIsNetworkDropdownOpen(false)
  }, [])

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [handleClickOutside])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)')
    const syncMobileMenu = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsMobileMenu(event.matches)
    }
    syncMobileMenu(mediaQuery)
    mediaQuery.addEventListener('change', syncMobileMenu)
    return () => mediaQuery.removeEventListener('change', syncMobileMenu)
  }, [])

  useEffect(() => {
    if (!isDropdownOpen || !isMobileMenu) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isDropdownOpen, isMobileMenu])

  const closeDropdown = useCallback(() => {
    setIsDropdownOpen(false)
    setIsNetworkDropdownOpen(false)
  }, [])

  const handleDisconnect = useCallback(async () => {
    await activeWallet.disconnect()
    setIsDropdownOpen(false)
    setIsNetworkDropdownOpen(false)
  }, [activeWallet])

  const copyAddress = useCallback(async () => {
    if (activeWallet.address) {
      await navigator.clipboard.writeText(activeWallet.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [activeWallet.address])

  if (!activeWallet.isConnected) {
    return null
  }

  const handleNetworkSelect = useCallback((chainId: number) => {
    evmWallet.switchToChain(chainId)
    setIsNetworkDropdownOpen(false)
  }, [evmWallet])

  const handleClusterSelect = useCallback((clusterId: 'mainnet-beta' | 'devnet') => {
    solanaWallet.switchCluster(clusterId)
    setIsNetworkDropdownOpen(false)
  }, [solanaWallet])

  const getCurrentNetworkIcon = () => {
    if (activeWallet.chainType === 'evm') {
      if (evmWallet.chainId === 42161) {
        return (
          <img
            className="wallet-current-network-icon"
            src="https://cryptologos.cc/logos/arbitrum-arb-logo.png?v=040"
            alt="Arbitrum"
            width={20}
            height={20}
          />
        )
      }

      if (evmWallet.chainId === BASE_CHAIN_ID) {
        return (
          <img
            className="wallet-current-network-icon"
            src={baseNetworkIcon}
            alt="Base"
            width={20}
            height={20}
          />
        )
      }

      if (evmWallet.chainId === BASE_SEPOLIA_CHAIN_ID) {
        return (
          <img
            className="wallet-current-network-icon"
            src={baseNetworkIcon}
            alt="Base Sepolia"
            width={20}
            height={20}
          />
        )
      }

      if (evmWallet.chainId === 11155111) {
        return (
          <svg className="wallet-current-network-icon-svg sepolia" width="20" height="20" viewBox="0 0 256 417" fill="#9CA3AF">
            <path d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" fillOpacity="0.8"/>
            <path d="M127.962 0L0 212.32l127.962 75.639V154.158z" fillOpacity="0.5"/>
            <path d="M127.961 287.958l127.96-75.637-127.96-58.162z" fillOpacity="1"/>
            <path d="M0 212.32l127.96 75.638v-133.8z" fillOpacity="0.6"/>
          </svg>
        )
      }

      return (
        <img
          className="wallet-current-network-icon wallet-current-network-icon--ethereum"
          src="https://assets.coingecko.com/coins/images/279/small/ethereum.png"
          alt="Ethereum"
          width={20}
          height={20}
        />
      )
    }

    const solanaClass =
      solanaWallet.cluster === 'devnet' ? 'solana-devnet' : 'solana-mainnet'

    return (
      <span className={`wallet-current-network-icon-solana ${solanaClass}`}>
        <svg width="12" height="12" viewBox="0 0 397 311" fill="currentColor">
          <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"/>
          <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"/>
          <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"/>
        </svg>
      </span>
    )
  }

  const getSelectedDropdownNetworkIcon = () => {
    if (activeWallet.chainType === 'evm') {
      const currentChain = evmWallet.supportedChains.find((chain) => chain.id === evmWallet.chainId)
      if (!currentChain) return null

      return (
        <span className={`network-icon-svg ${currentChain.name.toLowerCase()}`}>
          {currentChain.name === 'Ethereum' && (
            <img
              src="https://assets.coingecko.com/coins/images/279/small/ethereum.png"
              alt="Ethereum"
              width={20}
              height={20}
              className="network-logo-img network-logo-img--ethereum"
            />
          )}
          {currentChain.name === 'Arbitrum' && (
            <img
              src="https://cryptologos.cc/logos/arbitrum-arb-logo.png?v=040"
              alt="Arbitrum"
              width={20}
              height={20}
            />
          )}
          {currentChain.name === 'Sepolia' && (
            <svg width="20" height="20" viewBox="0 0 256 417" fill="#9CA3AF">
              <path d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" fillOpacity="0.8"/>
              <path d="M127.962 0L0 212.32l127.962 75.639V154.158z" fillOpacity="0.5"/>
              <path d="M127.961 287.958l127.96-75.637-127.96-58.162z" fillOpacity="1"/>
              <path d="M0 212.32l127.96 75.638v-133.8z" fillOpacity="0.6"/>
            </svg>
          )}
          {(currentChain.name === 'Base' || currentChain.name === 'Base Sepolia') && (
            <img src={baseNetworkIcon} alt={currentChain.name} width={20} height={20} />
          )}
        </span>
      )
    }

    const currentCluster = solanaWallet.supportedClusters.find((cluster) => cluster.id === solanaWallet.cluster)
    if (!currentCluster) return null

    return (
      <span className={`network-icon-svg ${currentCluster.id === 'devnet' ? 'solana-devnet' : 'solana'}`}>
        <svg width="16" height="16" viewBox="0 0 397 311" fill="currentColor">
          <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"/>
          <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"/>
          <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"/>
        </svg>
      </span>
    )
  }

  const dropdownMenu = isDropdownOpen ? (
    <>
      <button
        type="button"
        className={`wallet-dropdown-backdrop${isMobileMenu ? ' wallet-dropdown-backdrop--sheet' : ''}`}
        aria-label="Close wallet menu"
        onClick={closeDropdown}
      />
      <div
        ref={menuRef}
        className={`wallet-dropdown${isMobileMenu ? ' wallet-dropdown--sheet' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Wallet menu"
      >
            <div className="wallet-dropdown-mobile-header">
              <span className="wallet-dropdown-mobile-title">Wallet</span>
              <button
                type="button"
                className="wallet-dropdown-close"
                aria-label="Close wallet menu"
                onClick={closeDropdown}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="wallet-dropdown-top">
            <div className="wallet-network-select wallet-network-select-inline">
              <span className="wallet-dropdown-label">Network</span>
              <button
                className="wallet-network-select-btn"
                onClick={() => setIsNetworkDropdownOpen((v) => !v)}
              >
                <span className="wallet-network-select-main">
                  {getSelectedDropdownNetworkIcon()}
                  <span className="wallet-network-select-value">{activeWallet.networkName}</span>
                </span>
                <svg
                  className={`wallet-network-select-arrow ${isNetworkDropdownOpen ? 'open' : ''}`}
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {isNetworkDropdownOpen && (
                <div className="wallet-network-select-list">
                  {activeWallet.chainType === 'evm' &&
                    evmWallet.supportedChains.map((chain) => (
                      <button
                        key={chain.id}
                        className={`wallet-network-select-item ${evmWallet.chainId === chain.id ? 'active' : ''}`}
                        onClick={() => handleNetworkSelect(chain.id)}
                      >
                        <span className={`network-icon-svg ${chain.name.toLowerCase()}`}>
                          {chain.name === 'Ethereum' && (
                            <img
                              src="https://assets.coingecko.com/coins/images/279/small/ethereum.png"
                              alt="Ethereum"
                              width={20}
                              height={20}
                              className="network-logo-img network-logo-img--ethereum"
                            />
                          )}
                          {chain.name === 'Arbitrum' && (
                            <img
                              src="https://cryptologos.cc/logos/arbitrum-arb-logo.png?v=040"
                              alt="Arbitrum"
                              width={20}
                              height={20}
                            />
                          )}
                          {chain.name === 'Sepolia' && (
                            <svg width="20" height="20" viewBox="0 0 256 417" fill="#9CA3AF">
                              <path d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" fillOpacity="0.8"/>
                              <path d="M127.962 0L0 212.32l127.962 75.639V154.158z" fillOpacity="0.5"/>
                              <path d="M127.961 287.958l127.96-75.637-127.96-58.162z" fillOpacity="1"/>
                              <path d="M0 212.32l127.96 75.638v-133.8z" fillOpacity="0.6"/>
                            </svg>
                          )}
                          {(chain.name === 'Base' || chain.name === 'Base Sepolia') && (
                            <img src={baseNetworkIcon} alt={chain.name} width={20} height={20} />
                          )}
                        </span>
                        <span className="network-name">{chain.name}</span>
                      </button>
                    ))}
                  {activeWallet.chainType === 'solana' &&
                    solanaWallet.supportedClusters.map((cluster) => (
                      <button
                        key={cluster.id}
                        className={`wallet-network-select-item ${solanaWallet.cluster === cluster.id ? 'active' : ''}`}
                        onClick={() => handleClusterSelect(cluster.id)}
                      >
                        <span className={`network-icon-svg ${cluster.id === 'devnet' ? 'solana-devnet' : 'solana'}`}>
                          <svg width="16" height="16" viewBox="0 0 397 311" fill="currentColor">
                            <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"/>
                            <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"/>
                            <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"/>
                          </svg>
                        </span>
                        <span className="network-name">{cluster.name}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="wallet-dropdown-address" onClick={copyAddress}>
            <div className="wallet-address-content">
              <span className="wallet-full-address">{activeWallet.address}</span>
              {copied && <span className="wallet-copy-hint copied">Copied!</span>}
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </div>

          <button className="wallet-disconnect-btn" onClick={() => void handleDisconnect()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Disconnect
          </button>
      </div>
    </>
  ) : null

  return (
    <div className="wallet-info" ref={dropdownRef}>
      <button 
        className="wallet-info-btn"
        type="button"
        aria-label={`Wallet ${activeWallet.shortAddress}`}
        aria-expanded={isDropdownOpen}
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        {getCurrentNetworkIcon()}
        <span className="wallet-address">{activeWallet.shortAddress}</span>
        <WalletExpandToggle expanded={isDropdownOpen} />
      </button>

      {dropdownMenu && (
        isMobileMenu ? createPortal(dropdownMenu, document.body) : dropdownMenu
      )}
    </div>
  )
}
