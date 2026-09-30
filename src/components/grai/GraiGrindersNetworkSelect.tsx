import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Globe } from 'lucide-react'
import { useActiveWallet } from '../../hooks/useActiveWallet'
import { useEvmWallet } from '../../hooks/useEvmWallet'
import { useSolanaWallet } from '../../hooks/useSolanaWallet'
import { useWalletContext, type EvmChain } from '../../providers/AppWalletProvider'
import { evmChainIdToCaip2, solanaClusterToCaip2 } from '../../wallet/caip2Network'
import { SolanaClusterIcon } from '../SolanaClusterIcon'
import { EvmChainListIcon } from '../WalletNetworkSelect'
import '../WalletStyles.css'

type Props = {
  filterEnabled: boolean
  onFilterChange: (enabled: boolean) => void
  ariaLabel?: string
  /** stacked: TOTAL + icons as one click target (desktop summary). inline: compact toolbar control. */
  variant?: 'stacked' | 'inline'
}

const MAINNET_EVM_CHAINS = [
  { id: 1, name: 'Ethereum' },
  { id: 8453, name: 'Base' },
  { id: 42161, name: 'Arbitrum' },
  { id: 137, name: 'Polygon' },
] as const

const MAINNET_SOLANA = { id: 'mainnet-beta' as const, name: 'Mainnet' }

export function GraiGrindersMainnetNetworkIcons({ className }: { className?: string }) {
  return (
    <span className={className ?? 'grai-grinders-network-icons-row'} aria-hidden="true">
      {MAINNET_EVM_CHAINS.map((chain) => (
        <span
          key={chain.id}
          className={`network-icon-svg grai-grinders-network-icons-row-icon ${chain.name.toLowerCase()}`}
        >
          <EvmChainListIcon name={chain.name} />
        </span>
      ))}
      <span className="network-icon-svg grai-grinders-network-icons-row-icon solana">
        <SolanaClusterIcon clusterId={MAINNET_SOLANA.id} size={20} />
      </span>
    </span>
  )
}

function shortNetworkLabel(name: string, chainType: 'evm' | 'solana' | null): string {
  const key = name.trim().toLowerCase()
  if (chainType === 'evm') {
    if (key === 'ethereum') return 'ETH'
    if (key === 'arbitrum') return 'ARB'
    if (key === 'polygon') return 'POL'
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
  if (chainId === 8453) return 'base'
  if (chainId === 42161) return 'arbitrum'
  if (chainId === 137) return 'polygon'
  if (chainId === 11155111) return 'sepolia'
  return null
}

/** Grinders summary network filter: Total + scrollable mainnet networks. */
export function GraiGrindersNetworkSelect({
  filterEnabled,
  onFilterChange,
  ariaLabel = 'Filter grinders by network',
  variant = 'inline',
}: Props) {
  const isStacked = variant === 'stacked'
  const [isOpen, setIsOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const activeWallet = useActiveWallet()
  const evmWallet = useEvmWallet()
  const solanaWallet = useSolanaWallet()
  const { openChainSelector, setEvmChain, setSelectedChainType, setSolanaCluster } = useWalletContext()

  const showTotal = !filterEnabled || !activeWallet.isConnected
  const selectedMainnetEvm = useMemo(
    () => MAINNET_EVM_CHAINS.find((chain) => chain.id === evmWallet.chainId) ?? null,
    [evmWallet.chainId],
  )
  const selectedMainnetSolana =
    activeWallet.chainType === 'solana' && solanaWallet.cluster === MAINNET_SOLANA.id

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const minWidth = Math.max(rect.width, 200)
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
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) return
    updateMenuPosition()
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [isOpen, updateMenuPosition])

  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setIsOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  const selectTotal = useCallback(() => {
    onFilterChange(false)
    setIsOpen(false)
  }, [onFilterChange])

  const handleNetworkSelect = useCallback(
    (chainId: number) => {
      if (!activeWallet.isConnected) {
        openChainSelector()
        setIsOpen(false)
        return
      }
      setSelectedChainType('evm')
      const next = chainIdToEvmChain(chainId)
      if (next) setEvmChain(next)
      void evmWallet.switchToChainAsync(chainId).catch(() => {
        evmWallet.switchToChain(chainId)
      })
      onFilterChange(true)
      setIsOpen(false)
    },
    [
      activeWallet.isConnected,
      evmWallet,
      onFilterChange,
      openChainSelector,
      setEvmChain,
      setSelectedChainType,
    ],
  )

  const handleClusterSelect = useCallback(() => {
    setSelectedChainType('solana')
    setSolanaCluster(MAINNET_SOLANA.id)
    solanaWallet.switchCluster(MAINNET_SOLANA.id)
    setIsOpen(false)

    if (!solanaWallet.isConnected) {
      openChainSelector()
      return
    }

    onFilterChange(true)
  }, [
    onFilterChange,
    openChainSelector,
    setSelectedChainType,
    setSolanaCluster,
    solanaWallet,
  ])

  const menu = isOpen ? (
    <div
      ref={menuRef}
      className="wallet-network-select-list is-grai-compact-portal grai-grinders-network-menu-list"
      style={menuStyle}
      role="listbox"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        role="option"
        aria-selected={showTotal}
        className={`wallet-network-select-item${showTotal ? ' active' : ''}`}
        onClick={selectTotal}
      >
        <span className="network-icon-svg grai-grinders-network-total-icon">
          <Globe size={20} strokeWidth={2} aria-hidden="true" />
        </span>
        <span className="network-name-wrap">
          <span className="network-name">Total</span>
          <span className="network-caip2">All networks</span>
        </span>
      </button>

      {MAINNET_EVM_CHAINS.map((chain) => {
        const active =
          !showTotal && activeWallet.chainType === 'evm' && evmWallet.chainId === chain.id
        return (
          <button
            key={`evm:${chain.id}`}
            type="button"
            role="option"
            aria-selected={active}
            className={`wallet-network-select-item${active ? ' active' : ''}`}
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
        )
      })}

      {(() => {
        const active = !showTotal && selectedMainnetSolana
        return (
          <button
            type="button"
            role="option"
            aria-selected={active}
            className={`wallet-network-select-item${active ? ' active' : ''}`}
            onClick={handleClusterSelect}
            title={solanaClusterToCaip2(MAINNET_SOLANA.id)}
            data-network-caip2={solanaClusterToCaip2(MAINNET_SOLANA.id)}
          >
            <span className="network-icon-svg solana">
              <SolanaClusterIcon clusterId={MAINNET_SOLANA.id} size={20} />
            </span>
            <span className="network-name-wrap">
              <span className="network-name">Solana</span>
              <span className="network-caip2">{solanaClusterToCaip2(MAINNET_SOLANA.id)}</span>
            </span>
          </button>
        )
      })()}
    </div>
  ) : null

  const labelMain = (
    <span className="wallet-network-select-main">
      {showTotal ? (
        <span className="grai-grinders-network-menu-icon" aria-hidden="true">
          <Globe size={20} strokeWidth={2} />
        </span>
      ) : null}
      {!showTotal && activeWallet.chainType === 'evm' && selectedMainnetEvm ? (
        <span className={`network-icon-svg ${selectedMainnetEvm.name.toLowerCase()}`}>
          <EvmChainListIcon name={selectedMainnetEvm.name} />
        </span>
      ) : null}
      {!showTotal && selectedMainnetSolana ? (
        <span className="network-icon-svg solana">
          <SolanaClusterIcon clusterId={MAINNET_SOLANA.id} size={20} />
        </span>
      ) : null}
      <span className="wallet-network-select-value grai-grinders-network-select-value">
        {showTotal
          ? 'TOTAL'
          : shortNetworkLabel(activeWallet.networkName, activeWallet.chainType)}
      </span>
    </span>
  )

  return (
    <div
      ref={rootRef}
      className={`wallet-network-select wallet-network-select-inline is-grai-compact${isStacked ? ' grai-grinders-network-select-shell' : ''}`}
    >
      <button
        ref={buttonRef}
        type="button"
        className={`wallet-network-select-btn grai-grinders-network-select-btn${isStacked ? ' grai-grinders-network-select-hitbox' : ''}`}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        title={
          showTotal
            ? 'Total — all networks'
            : (activeWallet.networkCaip2 ?? activeWallet.networkName)
        }
        data-network-caip2={showTotal ? undefined : (activeWallet.networkCaip2 ?? undefined)}
      >
        {isStacked ? (
          <>
            <span className="grai-grinders-group-general-top grai-grinders-network-top">
              {labelMain}
            </span>
            {showTotal ? (
              <GraiGrindersMainnetNetworkIcons />
            ) : (
              <span className="grai-grinders-network-value-spacer" aria-hidden="true" />
            )}
          </>
        ) : (
          <>
            {labelMain}
            <svg
              className={`wallet-network-select-arrow${isOpen ? ' open' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </>
        )}
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </div>
  )
}
