import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Globe } from 'lucide-react'
import { isGraiEvmChainConfigured, isGraiSolanaClusterConfigured } from '../../grai/networkGating'
import { useActiveWallet } from '../../wallets/useActiveWallet'
import { useEvmWallet } from '../../wallets/useEvmWallet'
import { useSolanaWallet } from '../../wallets/useSolanaWallet'
import { useWalletContext, type EvmChain } from '../../wallets/AppWalletProvider'
import {
  caip2NetworksMatch,
  evmChainIdToCaip2,
  solanaClusterToCaip2,
} from '../../wallets/caip2Network'
import { SolanaClusterIcon } from '../SolanaClusterIcon'
import { EvmChainListIcon } from '../WalletNetworkSelect'
import '../WalletStyles.css'

type Props = {
  /** ``null`` = TOTAL (all networks). CAIP-2 when filtered. Wallet not required. */
  networkCaip2: string | null
  onNetworkChange: (networkCaip2: string | null) => void
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
const SOLANA_CAIP2 = solanaClusterToCaip2(MAINNET_SOLANA.id)

function configuredMainnetEvmChains() {
  return MAINNET_EVM_CHAINS.filter((chain) => isGraiEvmChainConfigured(chain.id))
}

function isSolanaMainnetConfigured() {
  return isGraiSolanaClusterConfigured(MAINNET_SOLANA.id)
}

export function GraiGrindersMainnetNetworkIcons({ className }: { className?: string }) {
  const evmChains = configuredMainnetEvmChains()
  const showSolana = isSolanaMainnetConfigured()
  return (
    <span className={className ?? 'grai-grinders-network-icons-row'} aria-hidden="true">
      {evmChains.map((chain) => (
        <span
          key={chain.id}
          className={`network-icon-svg grai-grinders-network-icons-row-icon ${chain.name.toLowerCase()}`}
        >
          <EvmChainListIcon name={chain.name} />
        </span>
      ))}
      {showSolana ? (
        <span className="network-icon-svg grai-grinders-network-icons-row-icon solana">
          <SolanaClusterIcon clusterId={MAINNET_SOLANA.id} size={20} />
        </span>
      ) : null}
    </span>
  )
}

function shortNetworkLabel(name: string, chainType: 'evm' | 'solana'): string {
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
    if (key === 'mainnet' || key === 'mainnet-beta' || key === 'solana') return 'SOL'
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

/** Grinders summary network filter: Total + mainnets. Does not require a connected wallet. */
export function GraiGrindersNetworkSelect({
  networkCaip2,
  onNetworkChange,
  ariaLabel = 'Filter grinders by network',
  variant = 'inline',
}: Props) {
  const isStacked = variant === 'stacked'
  const [isOpen, setIsOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  /** Keep last network visible while TOTAL↔network panes crossfade. */
  const [displayNetworkCaip2, setDisplayNetworkCaip2] = useState<string | null>(networkCaip2)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const crossfadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeWallet = useActiveWallet()
  const evmWallet = useEvmWallet()
  const solanaWallet = useSolanaWallet()
  const { setEvmChain, setSelectedChainType, setSolanaCluster } = useWalletContext()

  const showTotal = !networkCaip2
  const availableEvmChains = useMemo(() => configuredMainnetEvmChains(), [])
  const solanaAvailable = useMemo(() => isSolanaMainnetConfigured(), [])

  useEffect(() => {
    if (crossfadeTimerRef.current) {
      clearTimeout(crossfadeTimerRef.current)
      crossfadeTimerRef.current = null
    }
    if (networkCaip2) {
      setDisplayNetworkCaip2(networkCaip2)
      return
    }
    // Leaving a network → hold last CAIP-2 until opacity fade finishes (~320ms).
    crossfadeTimerRef.current = setTimeout(() => {
      setDisplayNetworkCaip2(null)
      crossfadeTimerRef.current = null
    }, 340)
    return () => {
      if (crossfadeTimerRef.current) {
        clearTimeout(crossfadeTimerRef.current)
        crossfadeTimerRef.current = null
      }
    }
  }, [networkCaip2])

  const selectedEvm = useMemo(() => {
    if (!displayNetworkCaip2) return null
    return (
      availableEvmChains.find((chain) =>
        caip2NetworksMatch(evmChainIdToCaip2(chain.id), displayNetworkCaip2),
      ) ?? null
    )
  }, [availableEvmChains, displayNetworkCaip2])

  const selectedSolana = Boolean(
    displayNetworkCaip2 && solanaAvailable && caip2NetworksMatch(displayNetworkCaip2, SOLANA_CAIP2),
  )

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const pad = 8
    const vw = window.innerWidth
    const minWidth = Math.min(Math.max(rect.width, 200), Math.max(pad * 2, vw - pad * 2))
    let left = rect.left
    if (left + minWidth > vw - pad) left = vw - pad - minWidth
    if (left < pad) left = pad
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      left,
      right: 'auto',
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
    onNetworkChange(null)
    setIsOpen(false)
  }, [onNetworkChange])

  const handleNetworkSelect = useCallback(
    (chainId: number) => {
      if (!isGraiEvmChainConfigured(chainId)) return
      const caip2 = evmChainIdToCaip2(chainId)
      onNetworkChange(caip2)
      setIsOpen(false)
      // Best-effort wallet sync when already connected — never required for the filter.
      if (!activeWallet.isConnected) return
      setSelectedChainType('evm')
      const next = chainIdToEvmChain(chainId)
      if (next) setEvmChain(next)
      void evmWallet.switchToChainAsync(chainId).catch(() => {
        evmWallet.switchToChain(chainId)
      })
    },
    [activeWallet.isConnected, evmWallet, onNetworkChange, setEvmChain, setSelectedChainType],
  )

  const handleClusterSelect = useCallback(() => {
    if (!isGraiSolanaClusterConfigured(MAINNET_SOLANA.id)) return
    onNetworkChange(SOLANA_CAIP2)
    setIsOpen(false)
    if (!activeWallet.isConnected) return
    setSelectedChainType('solana')
    setSolanaCluster(MAINNET_SOLANA.id)
    solanaWallet.switchCluster(MAINNET_SOLANA.id)
  }, [
    activeWallet.isConnected,
    onNetworkChange,
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
          <span className="network-name">All</span>
          <span className="network-caip2">All networks</span>
        </span>
      </button>

      {availableEvmChains.map((chain) => {
        const caip2 = evmChainIdToCaip2(chain.id)
        const active = Boolean(networkCaip2 && caip2NetworksMatch(networkCaip2, caip2))
        return (
          <button
            key={`evm:${chain.id}`}
            type="button"
            role="option"
            aria-selected={active}
            className={`wallet-network-select-item${active ? ' active' : ''}`}
            onClick={() => handleNetworkSelect(chain.id)}
            title={caip2}
            data-network-caip2={caip2}
          >
            <span className={`network-icon-svg ${chain.name.toLowerCase()}`}>
              <EvmChainListIcon name={chain.name} />
            </span>
            <span className="network-name-wrap">
              <span className="network-name">{chain.name}</span>
              <span className="network-caip2">{caip2}</span>
            </span>
          </button>
        )
      })}

      {solanaAvailable ? (
        <button
          type="button"
          role="option"
          aria-selected={selectedSolana}
          className={`wallet-network-select-item${selectedSolana ? ' active' : ''}`}
          onClick={handleClusterSelect}
          title={SOLANA_CAIP2}
          data-network-caip2={SOLANA_CAIP2}
        >
          <span className="network-icon-svg solana">
            <SolanaClusterIcon clusterId={MAINNET_SOLANA.id} size={20} />
          </span>
          <span className="network-name-wrap">
            <span className="network-name">Solana</span>
            <span className="network-caip2">{SOLANA_CAIP2}</span>
          </span>
        </button>
      ) : null}
    </div>
  ) : null

  const dropdownArrow = (
    <svg
      className={`wallet-network-select-arrow grai-grinders-network-select-arrow${isOpen ? ' open' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )

  const networkLabel = selectedEvm
    ? shortNetworkLabel(selectedEvm.name, 'evm')
    : selectedSolana
      ? shortNetworkLabel('Solana', 'solana')
      : shortNetworkLabel(
          displayNetworkCaip2 ?? 'NET',
          displayNetworkCaip2?.startsWith('solana:') ? 'solana' : 'evm',
        )

  const totalLabelMain = (
    <span className="wallet-network-select-main">
      <span className="grai-grinders-network-menu-icon" aria-hidden="true">
        <Globe size={20} strokeWidth={2} />
      </span>
      <span className="wallet-network-select-value grai-grinders-network-select-value">ALL</span>
      {isStacked ? dropdownArrow : null}
    </span>
  )

  const inlineLabelMain = (
    <span className="wallet-network-select-main">
      {showTotal ? (
        <span className="grai-grinders-network-menu-icon" aria-hidden="true">
          <Globe size={20} strokeWidth={2} />
        </span>
      ) : null}
      {!showTotal && selectedEvm ? (
        <span className={`network-icon-svg ${selectedEvm.name.toLowerCase()}`}>
          <EvmChainListIcon name={selectedEvm.name} />
        </span>
      ) : null}
      {!showTotal && selectedSolana ? (
        <span className="network-icon-svg solana">
          <SolanaClusterIcon clusterId={MAINNET_SOLANA.id} size={20} />
        </span>
      ) : null}
      <span className="wallet-network-select-value grai-grinders-network-select-value">
        {showTotal ? 'ALL' : networkLabel}
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
        title={showTotal ? 'All — all networks' : (networkCaip2 ?? undefined)}
        data-network-caip2={showTotal ? undefined : (networkCaip2 ?? undefined)}
      >
        {isStacked ? (
          <span
            className="grai-grinders-network-swap"
            data-mode={showTotal ? 'total' : 'network'}
          >
            <span
              className={`grai-grinders-network-swap-pane is-total${showTotal ? ' is-active' : ''}`}
              aria-hidden={!showTotal}
            >
              <span className="grai-grinders-group-general-top grai-grinders-network-top">
                {totalLabelMain}
              </span>
              <GraiGrindersMainnetNetworkIcons />
            </span>
            <span
              className={`grai-grinders-network-swap-pane is-network${!showTotal ? ' is-active' : ''}`}
              aria-hidden={showTotal}
            >
              <span className="grai-grinders-group-general-top grai-grinders-network-top">
                <span className="grai-grinders-network-menu-icon" aria-hidden="true">
                  <Globe size={20} strokeWidth={2} />
                </span>
                <span className="grai-grinders-live-label grai-grinders-summary-mini-label grai-grinders-network-heading">
                  NETWORK
                </span>
                {dropdownArrow}
              </span>
              <span className="grai-grinders-network-selected-row">
                {selectedEvm ? (
                  <span className={`network-icon-svg ${selectedEvm.name.toLowerCase()}`}>
                    <EvmChainListIcon name={selectedEvm.name} />
                  </span>
                ) : null}
                {selectedSolana ? (
                  <span className="network-icon-svg solana">
                    <SolanaClusterIcon clusterId={MAINNET_SOLANA.id} size={20} />
                  </span>
                ) : null}
                <span className="grai-grinders-network-selected-copy">
                  <span className="wallet-network-select-value grai-grinders-network-select-value">
                    {networkLabel}
                  </span>
                  {displayNetworkCaip2 ? (
                    <span className="grai-grinders-network-select-caip2">{displayNetworkCaip2}</span>
                  ) : null}
                </span>
              </span>
            </span>
          </span>
        ) : showTotal ? (
          <>
            <span className="wallet-network-select-main">
              <span className="wallet-network-select-value grai-grinders-network-select-value">
                ALL
              </span>
            </span>
            <GraiGrindersMainnetNetworkIcons className="grai-grinders-network-icons-row grai-grinders-network-icons-row--inline" />
            {dropdownArrow}
          </>
        ) : (
          <>
            {inlineLabelMain}
            {dropdownArrow}
          </>
        )}
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </div>
  )
}
