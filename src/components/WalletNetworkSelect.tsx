import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import baseNetworkIcon from '../assets/base-network.svg'
import ethereumNetworkIcon from '../assets/ethereum-network.svg'
import { useActiveWallet } from '../hooks/useActiveWallet'
import { useEvmWallet } from '../hooks/useEvmWallet'
import { useSolanaWallet } from '../hooks/useSolanaWallet'
import { useWalletContext, type EvmChain } from '../providers/AppWalletProvider'
import { evmChainIdToCaip2, solanaClusterToCaip2 } from '../wallet/caip2Network'
import './WalletStyles.css'

type WalletNetworkSelectProps = {
  variant?: 'inline' | 'compact'
  ariaLabel?: string
}

function shortNetworkLabel(name: string, chainType: 'evm' | 'solana' | null): string {
  const key = name.trim().toLowerCase()
  if (chainType === 'evm') {
    if (key === 'ethereum') return 'ETH'
    if (key === 'arbitrum') return 'ARB'
    if (key === 'sepolia') return 'SEP'
    if (key === 'base') return 'BASE'
    if (key === 'base sepolia') return 'BSEP'
  }
  if (chainType === 'solana') {
    if (key === 'mainnet' || key === 'mainnet-beta') return 'SOL'
    if (key === 'devnet') return 'DEV'
    if (key === 'testnet') return 'TEST'
  }
  return name.length > 4 ? name.slice(0, 3).toUpperCase() : name.toUpperCase()
}

function chainIdToEvmChain(chainId: number): EvmChain | null {
  if (chainId === 1) return 'ethereum'
  if (chainId === 42161) return 'arbitrum'
  if (chainId === 11155111) return 'sepolia'
  return null
}

function EvmChainListIcon({ name }: { name: string }) {
  if (name === 'Ethereum') {
    return (
      <img
        src={ethereumNetworkIcon}
        alt=""
        width={20}
        height={20}
        className="network-logo-img network-logo-img--ethereum"
      />
    )
  }
  if (name === 'Arbitrum') {
    return (
      <img
        src="https://cryptologos.cc/logos/arbitrum-arb-logo.png?v=040"
        alt=""
        width={20}
        height={20}
        className="network-logo-img network-logo-img--arbitrum"
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

function SolanaClusterListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 397 311" fill="currentColor" aria-hidden="true">
      <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" />
      <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" />
      <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" />
    </svg>
  )
}

export function WalletNetworkSelect({
  variant = 'inline',
  ariaLabel = 'Select network',
}: WalletNetworkSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const activeWallet = useActiveWallet()
  const evmWallet = useEvmWallet()
  const solanaWallet = useSolanaWallet()
  const { setEvmChain } = useWalletContext()
  const isCompact = variant === 'compact'

  const updateMenuPosition = useCallback(() => {
    if (!isCompact || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const minWidth = Math.max(rect.width, 184)
    const isMobile = window.matchMedia('(max-width: 768px)').matches

    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      ...(isMobile
        ? { right: window.innerWidth - rect.right, left: 'auto' }
        : { left: rect.left, right: 'auto' }),
      minWidth,
      zIndex: 120,
    })
  }, [isCompact])

  useLayoutEffect(() => {
    if (!isOpen || !isCompact) return
    updateMenuPosition()
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [isCompact, isOpen, updateMenuPosition])

  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setIsOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [isOpen])

  const handleNetworkSelect = useCallback(
    (chainId: number) => {
      evmWallet.switchToChain(chainId)
      const evmChain = chainIdToEvmChain(chainId)
      if (evmChain) setEvmChain(evmChain)
      setIsOpen(false)
    },
    [evmWallet, setEvmChain],
  )

  const handleClusterSelect = useCallback(
    (clusterId: 'mainnet-beta' | 'devnet') => {
      solanaWallet.switchCluster(clusterId)
      setIsOpen(false)
    },
    [solanaWallet],
  )

  if (!activeWallet.isConnected) {
    return null
  }

  const currentEvmChain = evmWallet.supportedChains.find((chain) => chain.id === evmWallet.chainId)
  const currentSolanaCluster = solanaWallet.supportedClusters.find((cluster) => cluster.id === solanaWallet.cluster)

  const menu = isOpen ? (
    <div
      ref={menuRef}
      className={`wallet-network-select-list${isCompact ? ' is-grai-compact-portal' : ''}`}
      style={isCompact ? menuStyle : undefined}
      role="listbox"
      aria-label={ariaLabel}
    >
      {activeWallet.chainType === 'evm'
        ? evmWallet.supportedChains.map((chain) => (
            <button
              key={chain.id}
              type="button"
              role="option"
              aria-selected={evmWallet.chainId === chain.id}
              className={`wallet-network-select-item ${evmWallet.chainId === chain.id ? 'active' : ''}`}
              onClick={() => handleNetworkSelect(chain.id)}
              title={evmChainIdToCaip2(chain.id)}
              data-network-caip2={evmChainIdToCaip2(chain.id)}
            >
              <span className={`network-icon-svg ${chain.name.toLowerCase()}`}>
                <EvmChainListIcon name={chain.name} />
              </span>
              <span className="network-name-wrap">
                <span className="network-name">{chain.name}</span>
                <span className="network-caip2">{evmChainIdToCaip2(chain.id)}</span>
              </span>
            </button>
          ))
        : null}
      {activeWallet.chainType === 'solana'
        ? solanaWallet.supportedClusters.map((cluster) => (
            <button
              key={cluster.id}
              type="button"
              role="option"
              aria-selected={solanaWallet.cluster === cluster.id}
              className={`wallet-network-select-item ${solanaWallet.cluster === cluster.id ? 'active' : ''}`}
              onClick={() => handleClusterSelect(cluster.id)}
              title={solanaClusterToCaip2(cluster.id)}
              data-network-caip2={solanaClusterToCaip2(cluster.id)}
            >
              <span className={`network-icon-svg ${cluster.id === 'devnet' ? 'solana-devnet' : 'solana'}`}>
                <SolanaClusterListIcon />
              </span>
              <span className="network-name-wrap">
                <span className="network-name">{cluster.name}</span>
                <span className="network-caip2">{solanaClusterToCaip2(cluster.id)}</span>
              </span>
            </button>
          ))
        : null}
    </div>
  ) : null

  return (
    <div
      ref={rootRef}
      className={`wallet-network-select wallet-network-select-inline${isCompact ? ' is-grai-compact' : ''}`}
    >
      <button
        ref={buttonRef}
        type="button"
        className={`wallet-network-select-btn${isCompact ? ' grai-grinders-network-select-btn' : ''}`}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        title={activeWallet.networkCaip2 ?? undefined}
        data-network-caip2={activeWallet.networkCaip2 ?? undefined}
      >
        <span className="wallet-network-select-main">
          {activeWallet.chainType === 'evm' && currentEvmChain ? (
            <span className={`network-icon-svg ${currentEvmChain.name.toLowerCase()}`}>
              <EvmChainListIcon name={currentEvmChain.name} />
            </span>
          ) : null}
          {activeWallet.chainType === 'solana' && currentSolanaCluster ? (
            <span className={`network-icon-svg ${currentSolanaCluster.id === 'devnet' ? 'solana-devnet' : 'solana'}`}>
              <SolanaClusterListIcon />
            </span>
          ) : null}
          <span
            className={`wallet-network-select-value${isCompact ? ' grai-grinders-network-select-value' : ''}`}
          >
            {isCompact
              ? shortNetworkLabel(activeWallet.networkName, activeWallet.chainType)
              : activeWallet.networkName}
          </span>
        </span>
        <svg
          className={`wallet-network-select-arrow ${isOpen ? 'open' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isCompact && menu ? createPortal(menu, document.body) : menu}
    </div>
  )
}
