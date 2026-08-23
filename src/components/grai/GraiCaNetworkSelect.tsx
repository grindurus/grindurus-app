import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useEvmWallet } from '../../hooks/useEvmWallet'
import { useSolanaWallet } from '../../hooks/useSolanaWallet'
import { useWalletContext, type EvmChain, type SolanaCluster } from '../../providers/AppWalletProvider'
import {
  getDefaultGraiSolanaCluster,
  listConfiguredEvmChains,
  resolveGraiSolanaConfig,
} from '../../grai/deployments'
import { evmChainIdToCaip2, solanaClusterToCaip2 } from '../../wallet/caip2Network'
import { EvmChainListIcon } from '../WalletNetworkSelect'
import { SolanaLogomark } from '../SolanaLogomark'
import '../WalletStyles.css'

type GraiNetworkOption =
  | { key: string; kind: 'evm'; chainId: number; name: string; short: string }
  | { key: string; kind: 'solana'; cluster: SolanaCluster; name: string; short: string }

function chainIdToEvmChain(chainId: number): EvmChain | null {
  if (chainId === 1) return 'ethereum'
  if (chainId === 42161) return 'arbitrum'
  if (chainId === 11155111) return 'sepolia'
  return null
}

function shortEvmLabel(name: string): string {
  const key = name.trim().toLowerCase()
  if (key === 'ethereum') return 'ETH'
  if (key === 'arbitrum') return 'ARB'
  if (key === 'sepolia') return 'SEP'
  if (key === 'base') return 'BASE'
  if (key === 'base sepolia') return 'BSEP'
  return name.length > 4 ? name.slice(0, 3).toUpperCase() : name.toUpperCase()
}

function shortSolanaLabel(cluster: SolanaCluster): string {
  if (cluster === 'mainnet-beta') return 'SOL'
  if (cluster === 'devnet') return 'DEV'
  return 'TEST'
}

function buildOptions(): GraiNetworkOption[] {
  const evm = listConfiguredEvmChains().map((chain) => ({
    key: `evm:${chain.chainId}`,
    kind: 'evm' as const,
    chainId: chain.chainId,
    name: chain.chainName,
    short: shortEvmLabel(chain.chainName),
  }))
  const cluster = getDefaultGraiSolanaCluster()
  const solana = resolveGraiSolanaConfig(cluster)
  if (!solana) return evm
  return [
    ...evm,
    {
      key: `solana:${solana.cluster}`,
      kind: 'solana',
      cluster: solana.cluster,
      name: solana.cluster === 'mainnet-beta' ? 'Solana' : `Solana ${solana.cluster}`,
      short: shortSolanaLabel(solana.cluster),
    },
  ]
}

type Props = {
  chainKind: 'evm' | 'solana' | null
  chainId?: number | null
  solanaCluster?: SolanaCluster | null
  ariaLabel?: string
}

/** Compact network picker for GRAI / Treasury CA — works without a connected wallet. */
export function GraiCaNetworkSelect({
  chainKind,
  chainId,
  solanaCluster,
  ariaLabel = 'Select GRAI network',
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const evmWallet = useEvmWallet()
  const solanaWallet = useSolanaWallet()
  const { setSelectedChainType, setEvmChain, setSolanaCluster } = useWalletContext()

  const options = useMemo(() => buildOptions(), [])

  const selected = useMemo(() => {
    if (chainKind === 'solana' && solanaCluster) {
      return options.find((item) => item.kind === 'solana' && item.cluster === solanaCluster) ?? null
    }
    if (chainKind === 'evm' && chainId != null) {
      return options.find((item) => item.kind === 'evm' && item.chainId === chainId) ?? null
    }
    return options[0] ?? null
  }, [chainId, chainKind, options, solanaCluster])

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return
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
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [isOpen])

  const selectOption = useCallback(
    (option: GraiNetworkOption) => {
      if (option.kind === 'evm') {
        setSelectedChainType('evm')
        const next = chainIdToEvmChain(option.chainId)
        if (next) setEvmChain(next)
        if (evmWallet.isConnected) {
          void evmWallet.switchToChainAsync(option.chainId).catch(() => {
            evmWallet.switchToChain(option.chainId)
          })
        } else {
          evmWallet.switchToChain(option.chainId)
        }
      } else {
        setSelectedChainType('solana')
        setSolanaCluster(option.cluster)
        if (option.cluster === 'mainnet-beta' || option.cluster === 'devnet') {
          solanaWallet.switchCluster(option.cluster)
        }
      }
      setIsOpen(false)
    },
    [evmWallet, setEvmChain, setSelectedChainType, setSolanaCluster, solanaWallet],
  )

  if (options.length === 0) return null

  const current = selected ?? options[0]
  const caip2 =
    current.kind === 'evm'
      ? evmChainIdToCaip2(current.chainId)
      : current.cluster === 'mainnet-beta' || current.cluster === 'devnet'
        ? solanaClusterToCaip2(current.cluster)
        : null

  const menu = isOpen ? (
    <div
      ref={menuRef}
      className="wallet-network-select-list is-grai-compact-portal"
      style={menuStyle}
      role="listbox"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const active = option.key === current.key
        const optionCaip2 =
          option.kind === 'evm'
            ? evmChainIdToCaip2(option.chainId)
            : option.cluster === 'mainnet-beta' || option.cluster === 'devnet'
              ? solanaClusterToCaip2(option.cluster)
              : undefined
        return (
          <button
            key={option.key}
            type="button"
            role="option"
            aria-selected={active}
            className={`wallet-network-select-item${active ? ' active' : ''}`}
            onClick={() => selectOption(option)}
            title={optionCaip2}
            data-network-caip2={optionCaip2}
          >
            <span
              className={`network-icon-svg ${
                option.kind === 'solana'
                  ? option.cluster === 'devnet'
                    ? 'solana-devnet'
                    : 'solana'
                  : option.name.toLowerCase()
              }`}
            >
              {option.kind === 'solana' ? (
                <SolanaLogomark size={16} />
              ) : (
                <EvmChainListIcon name={option.name} />
              )}
            </span>
            <span className="network-name-wrap">
              <span className="network-name">{option.name}</span>
              <span className="network-caip2">{optionCaip2}</span>
            </span>
          </button>
        )
      })}
    </div>
  ) : null

  return (
    <div ref={rootRef} className="wallet-network-select wallet-network-select-inline is-grai-compact">
      <button
        ref={buttonRef}
        type="button"
        className="wallet-network-select-btn grai-grinders-network-select-btn"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        title={caip2 ?? undefined}
        data-network-caip2={caip2 ?? undefined}
      >
        <span className="wallet-network-select-main">
          <span
            className={`network-icon-svg ${
              current.kind === 'solana'
                ? current.cluster === 'devnet'
                  ? 'solana-devnet'
                  : 'solana'
                : current.name.toLowerCase()
            }`}
          >
            {current.kind === 'solana' ? (
              <SolanaLogomark size={16} />
            ) : (
              <EvmChainListIcon name={current.name} />
            )}
          </span>
          <span className="wallet-network-select-value grai-grinders-network-select-value">
            {current.short}
          </span>
        </span>
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
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </div>
  )
}
