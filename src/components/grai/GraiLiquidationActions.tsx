import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'react-toastify'
import { evmExplorerAccountUrl, listConfiguredEvmChains } from '../../grai/deployments'
import { useGraiDeployment } from '../../grai/GraiDeploymentProvider'
import { GRAI_DECIMALS_EVM } from '../../grai/evm/constants'
import { GRAI_DECIMALS } from '../../grai/tokenomics'
import {
  fetchEvmLiquidationVoteState,
  fetchEvmLockers,
  previewEvmBribe,
  type EvmLiquidationVoteState,
  type EvmLockerEntry,
  type EvmVoterEntry,
} from '../../grai/evm/readProtocol'
import { fetchSolanaLiquidationVoteState } from '../../grai/fetchSolanaLiquidationVoteState'
import { fetchSolanaLockers } from '../../grai/fetchSolanaLockers'
import { PublicKey } from '@solana/web3.js'
import { useGraiBribe } from '../../hooks/useGraiBribe'
import { useGraiVote } from '../../hooks/useGraiVote'
import { useGraiLiquidate } from '../../hooks/useGraiLiquidate'
import { useGraiDistribute } from '../../hooks/useGraiDistribute'
import { useGraiLock } from '../../hooks/useGraiLock'
import { useGraiClaimEstimate } from '../../hooks/useGraiClaimEstimate'
import { useGraiAssets } from '../../hooks/useGraiAssets'
import { useActiveWallet } from '../../hooks/useActiveWallet'
import { useSolanaWallet } from '../../hooks/useSolanaWallet'
import { useEvmWallet } from '../../hooks/useEvmWallet'
import { useWalletAssetBalance } from '../../hooks/useWalletAssetBalance'
import { useGraiAssetUsdLabel } from '../../hooks/useGraiAssetUsdLabel'
import { estimateEvmClaimAll } from '../../grai/evm/estimateClaim'
import { estimateSolanaClaimAll } from '../../grai/estimateSolanaClaim'
import { formatVaultBalanceDisplay } from '../../grai/formatVaultBalance'
import { formatTokenBalance, parseTokenAmount } from '../../grai/onchain'
import { assetUrl } from '../../utils/appPaths'
import { replaceAppHash } from '../../utils/navigate'
import { navigateToGraiSection, readGraiSectionFromHash, type GraiSection } from '../../utils/graiNavigation'
import { GraiActionConnectWalletButton } from './GraiWalletAction'
import { GraiAmountInput, type GraiAmountAsset } from './GraiAmountInput'
import { GraiBribeCurveChart } from './GraiBribeCurveChart'
import { GraiDistributeMoneyFlow } from './GraiDistributeMoneyFlow'
import { GraiReferralTree } from './GraiReferralTree'
import { GraiFieldInfoButton } from './GraiFieldInfo'
import { GraiMintBurnPanel } from './GraiMintBurnPanel'
import { GraiTransactionToast } from './GraiTransactionToast'
import { MINT_ASSET_SOLSCAN_ICON } from './graiPageIcons'
import { HowItWorksModal } from '../HowItWorksModal'

const MOCK_VOTERS: EvmVoterEntry[] = [
  {
    address: '0xA11CE00000000000000000000000000000000001',
    escrowGrai: 1_250_500_000_000_000_000_000n,
  },
  {
    address: '0xB0B0000000000000000000000000000000000002',
    escrowGrai: 840_000_000_000_000_000_000n,
  },
  {
    address: '0xC0FFEE0000000000000000000000000000000003',
    escrowGrai: 3_420_250_000_000_000_000_000n,
  },
  {
    address: '0xDECAFF0000000000000000000000000000000004',
    escrowGrai: 97_150_000_000_000_000_000n,
  },
  {
    address: '0xF00D000000000000000000000000000000000005',
    escrowGrai: 512_000_000_000_000_000_000n,
  },
  {
    address: '0xCAFE000000000000000000000000000000000006',
    escrowGrai: 1_875_750_000_000_000_000_000n,
  },
  {
    address: '0xBEEF000000000000000000000000000000000007',
    escrowGrai: 275_400_000_000_000_000_000n,
  },
  {
    address: '0xABCD000000000000000000000000000000000008',
    escrowGrai: 1_102_000_000_000_000_000_000n,
  },
]

const BPS = 10_000n
/** On-chain / EVM `USD_DECIMALS` — `totalValue` book units. */
const USD_DECIMALS = 6

type ToolbarSortOption<T extends string> = { value: T; label: string }

function GraiToolbarSortSelect<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: readonly ToolbarSortOption<T>[]
  onChange: (value: T) => void
  label: string
}) {
  const [open, setOpen] = useState(false)
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const selected = options.find((option) => option.value === value) ?? options[0]
  const labelId = `${label.replace(/\s+/g, '-').toLowerCase()}-label`

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    setMenuRect({
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 148),
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setMenuRect(null)
      return
    }
    updateMenuPosition()
    const handleReposition = () => updateMenuPosition()
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    return () => {
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [open, updateMenuPosition])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    // Defer so the opening click does not immediately close the menu.
    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', handlePointerDown)
      document.addEventListener('keydown', handleKeyDown)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div
      className={`grai-liquidation-bribe-filter grai-toolbar-sort${open ? ' is-open' : ''}`}
      ref={rootRef}
    >
      <span className="visually-hidden" id={labelId}>
        {label}
      </span>
      <svg
        className="grai-liquidation-bribe-filter-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 5h16" />
        <path d="M7 12h10" />
        <path d="M10 19h4" />
      </svg>
      <button
        ref={triggerRef}
        type="button"
        className="grai-toolbar-sort-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="grai-toolbar-sort-value">{selected?.label ?? 'Sort'}</span>
        <span className="grai-toolbar-sort-caret" aria-hidden="true" />
      </button>
      {open && menuRect && typeof document !== 'undefined'
        ? createPortal(
            <ul
              ref={menuRef}
              className="grai-toolbar-sort-menu is-portal"
              role="listbox"
              aria-label={label}
              style={{
                top: menuRect.top,
                left: menuRect.left,
                width: menuRect.width,
              }}
            >
              {options.map((option) => {
                const isActive = option.value === value
                return (
                  <li key={option.value} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={`grai-toolbar-sort-option${isActive ? ' is-active' : ''}`}
                      onClick={() => {
                        onChange(option.value)
                        setOpen(false)
                      }}
                    >
                      {option.label}
                    </button>
                  </li>
                )
              })}
            </ul>,
            document.body,
          )
        : null}
    </div>
  )
}

const BRIBE_VOTER_SORT_OPTIONS = [
  { value: 'escrow-desc', label: 'Escrow ↓' },
  { value: 'escrow-asc', label: 'Escrow ↑' },
  { value: 'bribe-desc', label: 'Bribe ↓' },
  { value: 'bribe-asc', label: 'Bribe ↑' },
] as const

function shortAddress(address: string): string {
  if (address.length < 10) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function formatPct(numerator: bigint, denominator: bigint): string {
  if (denominator <= 0n) return '0.0%'
  const pct = Number((numerator * 10_000n) / denominator) / 100
  return `${pct.toFixed(1)}%`
}

function quorumProgressPct(totalVoted: bigint, totalSupply: bigint, quorumBps: number): number {
  if (totalSupply <= 0n || quorumBps <= 0) return 0
  const raw = Number((totalVoted * 1_000_000n) / (totalSupply * BigInt(quorumBps)))
  if (!Number.isFinite(raw)) return 0
  return Math.min(100, Math.max(0, raw))
}

function quorumRequiredAmount(totalSupply: bigint, quorumBps: number): bigint {
  if (totalSupply <= 0n || quorumBps <= 0) return 0n
  return (totalSupply * BigInt(quorumBps)) / 10_000n
}

function estimateMockBribeCost(
  escrowGrai: bigint,
  bribePremiumBps: number,
): bigint {
  const premium = BigInt(bribePremiumBps)
  return (escrowGrai * (BPS + premium)) / BPS
}

/**
 * Client-side `previewBribe` ask in settlement units (assumes ~$1 bribe asset, e.g. USDC).
 * `totalVoted` should be the post-vote share used for the premium curve.
 */
function estimateBribeReceive(
  graiAmount: bigint,
  totalSupply: bigint,
  totalValue: bigint,
  totalVoted: bigint,
  quorumBps: number,
  bribePremiumBps: number,
  settlementDecimals: number,
): bigint {
  if (graiAmount <= 0n) return 0n

  const bookUsd = totalSupply > 0n ? (graiAmount * totalValue) / totalSupply : 0n
  if (bookUsd <= 0n) return 0n

  // USD_DECIMALS (6) → settlement base units at $1 oracle.
  const book =
    settlementDecimals >= USD_DECIMALS
      ? bookUsd * 10n ** BigInt(settlementDecimals - USD_DECIMALS)
      : bookUsd / 10n ** BigInt(USD_DECIMALS - settlementDecimals)
  if (book <= 0n) return 0n

  const halfBps = BigInt(Math.floor(quorumBps / 2))
  const span = halfBps > 0n ? halfBps : 1n
  const maxAdj = BigInt(Math.max(0, bribePremiumBps))
  const voteBps = totalSupply > 0n ? (totalVoted * BPS) / totalSupply : 0n

  if (voteBps < halfBps) {
    const adj = (maxAdj * (halfBps - voteBps)) / span
    return (book * (BPS + adj)) / BPS
  }

  const adj = (maxAdj * (voteBps - halfBps)) / span
  const fullAsk = adj >= BPS ? 0n : (book * (BPS - adj)) / BPS
  const discount = (book - fullAsk) / 2n
  return book - discount
}

type VoterRowProps = {
  voter: EvmVoterEntry
  graiDecimals: number
  supplyShareLabel: string | null
  explorerHref: string | null
  selected: boolean
}

function GraiLiquidationVoterCard({
  voter,
  graiDecimals,
  supplyShareLabel,
  explorerHref,
  selected,
}: VoterRowProps) {
  const escrowLabel = formatTokenBalance(voter.escrowGrai, graiDecimals)

  return (
    <article
      className={`grai-liquidation-voter${selected ? ' is-selected' : ''}`}
      aria-label={`Voter ${shortAddress(voter.address)}`}
      aria-pressed={selected}
    >
      <div className="grai-liquidation-voter-rows">
        <div className="grai-liquidation-voter-row">
          <span className="grai-liquidation-voter-row-label">Voter</span>
          <span className="grai-liquidation-voter-address">
            <span className="grai-liquidation-voter-address-text" title={voter.address}>
              {shortAddress(voter.address)}
            </span>
            {explorerHref ? (
              <a
                href={explorerHref}
                target="_blank"
                rel="noreferrer"
                className="grai-mint-asset-value-solscan"
                aria-label="View voter on block explorer"
                title="View voter on block explorer"
                onClick={(event) => event.stopPropagation()}
              >
                {MINT_ASSET_SOLSCAN_ICON}
              </a>
            ) : null}
          </span>
        </div>
        <div className="grai-liquidation-voter-row">
          <span className="grai-liquidation-voter-row-label">Vote</span>
          <span className="grai-liquidation-voter-escrow">
            <span className="grai-liquidation-voter-escrow-amount">{escrowLabel} GRAI</span>
            {supplyShareLabel ? (
              <span className="grai-liquidation-voter-escrow-share">({supplyShareLabel})</span>
            ) : null}
          </span>
        </div>
      </div>
    </article>
  )
}

const VOTERS_GRID_PAGE_SIZE = 4

const VOTERS_PAGE_CHEVRON_LEFT = (
  <svg viewBox="0 0 8 12" fill="none" aria-hidden="true">
    <path d="M7 1 2 6l5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const VOTERS_PAGE_CHEVRON_RIGHT = (
  <svg viewBox="0 0 8 12" fill="none" aria-hidden="true">
    <path d="M1 1l5 5-5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

type VoterPickerParts = {
  carousel: ReactNode
  amount: ReactNode
  empty: ReactNode | null
}

type VoterPickerProps = {
  voters: EvmVoterEntry[]
  graiDecimals: number
  costByVoter: Record<string, bigint>
  totalVoted: bigint
  settlementSymbol: string
  settlementDecimals: number
  bribePremiumBps: number
  graiAsset: GraiAmountAsset
  explorerAccountUrl: ((address: string) => string | null) | null
  isLoading: boolean
  disabled: boolean
  canBribe: boolean
  bribingVoter: string | null
  onBribe: (voter: EvmVoterEntry, amountInput: string) => void
  onSelectVoter?: (voter: EvmVoterEntry) => void
  onSeeAllVoters?: () => void
  listLayout?: boolean
  children: (parts: VoterPickerParts) => ReactNode
}

function GraiLiquidationVoterPicker({
  voters,
  graiDecimals,
  costByVoter,
  totalVoted,
  settlementSymbol,
  settlementDecimals,
  bribePremiumBps,
  graiAsset,
  explorerAccountUrl,
  isLoading,
  disabled,
  canBribe,
  bribingVoter,
  onBribe,
  onSelectVoter,
  onSeeAllVoters,
  listLayout = false,
  children,
}: VoterPickerProps) {
  const [isCompact, setIsCompact] = useState(false)
  const [activeIndexes, setActiveIndexes] = useState<Set<number>>(() => new Set([0, 1]))
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null)
  const [bribeAmount, setBribeAmount] = useState('')
  const [gridPage, setGridPage] = useState(0)
  const gridPointerStartX = useRef<number | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  const gridPageSize = VOTERS_GRID_PAGE_SIZE

  useEffect(() => {
    const updateCompact = () => {
      setIsCompact(window.innerWidth <= 640)
    }
    updateCompact()
    window.addEventListener('resize', updateCompact)
    return () => window.removeEventListener('resize', updateCompact)
  }, [])

  useEffect(() => {
    setGridPage(0)
  }, [voters, listLayout, gridPageSize])

  useEffect(() => {
    if (!voters.length) {
      setSelectedAddress(null)
      return
    }
    setSelectedAddress((current) => {
      if (current && voters.some((voter) => voter.address.toLowerCase() === current.toLowerCase())) {
        return current
      }
      return voters[0]!.address
    })
  }, [voters])

  useEffect(() => {
    setBribeAmount('')
  }, [selectedAddress])

  const updateActiveFromScroll = useCallback(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const scrollerRect = scroller.getBoundingClientRect()
    const next = new Set<number>()
    const peekThreshold = isCompact ? 0.5 : 0.55

    itemRefs.current.forEach((item, index) => {
      if (!item) return
      const rect = item.getBoundingClientRect()
      const visibleLeft = Math.max(rect.left, scrollerRect.left)
      const visibleRight = Math.min(rect.right, scrollerRect.right)
      const visibleWidth = Math.max(0, visibleRight - visibleLeft)
      const ratio = visibleWidth / Math.max(1, rect.width)
      if (ratio >= peekThreshold) next.add(index)
    })

    if (next.size === 0) {
      let bestIndex = 0
      let bestDist = Number.POSITIVE_INFINITY
      const center = scrollerRect.left + scrollerRect.width / 2
      itemRefs.current.forEach((item, index) => {
        if (!item) return
        const rect = item.getBoundingClientRect()
        const dist = Math.abs(rect.left + rect.width / 2 - center)
        if (dist < bestDist) {
          bestDist = dist
          bestIndex = index
        }
      })
      next.add(bestIndex)
    }

    setActiveIndexes((prev) => {
      if (prev.size === next.size && [...prev].every((i) => next.has(i))) return prev
      return next
    })
  }, [isCompact])

  useEffect(() => {
    updateActiveFromScroll()
  }, [voters.length, isCompact, updateActiveFromScroll])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const onScroll = () => updateActiveFromScroll()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [updateActiveFromScroll])

  useEffect(() => {
    if (listLayout) return
    const scroller = scrollerRef.current
    if (!scroller) return

    const onWheel = (event: WheelEvent) => {
      if (scroller.scrollWidth <= scroller.clientWidth) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, button, [contenteditable="true"]')
      ) {
        return
      }
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
      event.preventDefault()
      scroller.scrollLeft += event.deltaY
    }

    scroller.addEventListener('wheel', onWheel, { passive: false })
    return () => scroller.removeEventListener('wheel', onWheel)
  }, [listLayout])

  const scrollToIndex = (index: number) => {
    const scroller = scrollerRef.current
    const item = itemRefs.current[index]
    if (!scroller || !item) return

    const scrollerRect = scroller.getBoundingClientRect()
    const itemRect = item.getBoundingClientRect()
    const itemCenter = itemRect.left + itemRect.width / 2
    const scrollerCenter = scrollerRect.left + scrollerRect.width / 2
    const delta = itemCenter - scrollerCenter
    if (Math.abs(delta) < 1) return

    scroller.scrollTo({
      left: Math.max(0, scroller.scrollLeft + delta),
      behavior: 'smooth',
    })
  }

  // Keep hooks above any early return — loading/empty used to skip hooks and crash React
  // when Solana voters arrived (mocks previously kept length > 0 so the bug stayed hidden).
  const selectedVoter =
    voters.find((voter) => voter.address.toLowerCase() === selectedAddress?.toLowerCase()) ??
    voters[0] ??
    null

  const maxAmountLabel = selectedVoter
    ? formatTokenBalance(selectedVoter.escrowGrai, graiDecimals)
    : '0'

  let amountRaw = 0n
  if (selectedVoter) {
    try {
      amountRaw = bribeAmount.trim() ? parseTokenAmount(bribeAmount, graiDecimals) : 0n
    } catch {
      amountRaw = 0n
    }
    if (amountRaw > selectedVoter.escrowGrai) amountRaw = selectedVoter.escrowGrai
  }

  const fullCost = selectedVoter
    ? (costByVoter[selectedVoter.address.toLowerCase()] ??
      estimateMockBribeCost(selectedVoter.escrowGrai, bribePremiumBps))
    : 0n
  const scaledCost =
    selectedVoter && selectedVoter.escrowGrai > 0n && amountRaw > 0n
      ? (fullCost * amountRaw) / selectedVoter.escrowGrai
      : 0n
  const selectedCostLabel = formatTokenBalance(scaledCost, settlementDecimals)
  const isBribingSelected = Boolean(
    selectedVoter && bribingVoter?.toLowerCase() === selectedVoter.address.toLowerCase(),
  )
  const bribeDisabled =
    !selectedVoter ||
    disabled ||
    selectedVoter.escrowGrai <= 0n ||
    amountRaw <= 0n ||
    isBribingSelected

  const gridPageCount = Math.max(1, Math.ceil(voters.length / gridPageSize))
  const safeGridPage = Math.min(gridPage, gridPageCount - 1)
  const showGridPagination = listLayout && voters.length > gridPageSize

  const goToGridPage = useCallback(
    (nextPage: number) => {
      setGridPage(Math.max(0, Math.min(gridPageCount - 1, nextPage)))
    },
    [gridPageCount],
  )

  const onGridPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!listLayout || gridPageCount <= 1) return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      gridPointerStartX.current = event.clientX
    },
    [gridPageCount, listLayout],
  )

  const onGridPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (gridPointerStartX.current == null) return
      const deltaX = event.clientX - gridPointerStartX.current
      gridPointerStartX.current = null
      if (Math.abs(deltaX) < 48) return
      if (deltaX < 0) goToGridPage(safeGridPage + 1)
      else goToGridPage(safeGridPage - 1)
    },
    [goToGridPage, safeGridPage],
  )

  const onGridPointerCancel = useCallback(() => {
    gridPointerStartX.current = null
  }, [])

  const gridPageRef = useRef(safeGridPage)
  gridPageRef.current = safeGridPage
  const gridPageCountRef = useRef(gridPageCount)
  gridPageCountRef.current = gridPageCount
  const gridWheelLockRef = useRef(0)

  useEffect(() => {
    if (!listLayout) return
    const viewport = scrollerRef.current
    if (!viewport) return

    const onWheel = (event: WheelEvent) => {
      if (gridPageCountRef.current <= 1) return
      const dominant =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      if (Math.abs(dominant) < 8) return

      const now = Date.now()
      if (now - gridWheelLockRef.current < 320) {
        event.preventDefault()
        return
      }

      const direction = dominant > 0 ? 1 : -1
      const next = Math.max(
        0,
        Math.min(gridPageCountRef.current - 1, gridPageRef.current + direction),
      )
      if (next === gridPageRef.current) return

      event.preventDefault()
      gridWheelLockRef.current = now
      goToGridPage(next)
    }

    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', onWheel)
  }, [goToGridPage, listLayout, voters.length, gridPageSize])

  const gridPages = useMemo(() => {
    if (!listLayout) return []
    return Array.from({ length: gridPageCount }, (_, pageIndex) =>
      Array.from({ length: gridPageSize }, (_, slotIndex) => {
        const sourceIndex = pageIndex * gridPageSize + slotIndex
        return voters[sourceIndex] ?? null
      }),
    )
  }, [gridPageCount, gridPageSize, listLayout, voters])

  const selectedIndex = selectedVoter
    ? Math.max(
        0,
        voters.findIndex(
          (voter) => voter.address.toLowerCase() === selectedVoter.address.toLowerCase(),
        ),
      )
    : -1
  const showSideNav = !listLayout && voters.length > 1
  const canShiftPrev = selectedIndex > 0
  const canShiftNext = selectedIndex >= 0 && selectedIndex < voters.length - 1

  const shiftVoterCarousel = useCallback(
    (delta: -1 | 1) => {
      const nextIndex = selectedIndex + delta
      const voter = voters[nextIndex]
      if (!voter) return
      setSelectedAddress(voter.address)
      onSelectVoter?.(voter)
      scrollToIndex(nextIndex)
    },
    [onSelectVoter, selectedIndex, voters],
  )

  const votersEmptyMessage = isLoading ? (
    <p className="grai-liquidation-empty">Loading voters…</p>
  ) : voters.length === 0 ? (
    <p className="grai-liquidation-empty">No active voters yet.</p>
  ) : null

  // Always render the bribe amount input — empty/loading voters must not hide it.
  const amount = (
    <div className="grai-liquidation-bribe-amount">
      <GraiAmountInput
        key={selectedVoter?.address ?? 'no-voter'}
        label="Bribe Amount"
        assets={[graiAsset]}
        defaultAsset="GRAI"
        value={bribeAmount}
        onValueChange={setBribeAmount}
        balanceLabel={`${maxAmountLabel} GRAI`}
        balancePrefix="Vote:"
        maxAmount={selectedVoter && selectedVoter.escrowGrai > 0n ? maxAmountLabel : ''}
        decimals={graiDecimals}
        showPresets
        usdLabel="$0.00"
        usdTrailingLabel="vote:"
        disabled={!selectedVoter || disabled}
        selectAriaLabel="Select voter"
        selectMenuAriaLabel="Voters"
        selectedMenuId={selectedVoter?.address ?? null}
        selectMenuOptions={voters.map((voter) => ({
          id: voter.address,
          label: formatTokenBalance(voter.escrowGrai, graiDecimals),
          detail: shortAddress(voter.address),
          icon: graiAsset.icon,
        }))}
        selectMenuLeadingAction={
          onSeeAllVoters
            ? {
                label: 'See all',
                onClick: onSeeAllVoters,
              }
            : null
        }
        onSelectMenuOption={(address) => {
          const index = voters.findIndex(
            (voter) => voter.address.toLowerCase() === address.toLowerCase(),
          )
          const voter = index >= 0 ? voters[index] : undefined
          if (!voter) return
          setSelectedAddress(voter.address)
          onSelectVoter?.(voter)
          if (!listLayout && index >= 0) scrollToIndex(index)
        }}
      />
      {votersEmptyMessage}
      {selectedVoter ? (
        <>
          <div className="grai-liquidation-bribe-amount-row">
            <span className="grai-liquidation-bribe-amount-label">
              You bribe{' '}
              <span className="grai-liquidation-bribe-amount-address" title={selectedVoter.address}>
                {shortAddress(selectedVoter.address)}
              </span>
            </span>
            <span className="grai-liquidation-bribe-amount-value">
              {amountRaw > 0n ? selectedCostLabel : '0'} {settlementSymbol}
            </span>
          </div>
          <div className="grai-liquidation-bribe-amount-row">
            <span className="grai-liquidation-bribe-amount-label">You receive</span>
            <span className="grai-liquidation-bribe-amount-value">
              {amountRaw > 0n ? formatTokenBalance(amountRaw, graiDecimals) : '0'} GRAI
            </span>
          </div>
        </>
      ) : null}
      {canBribe ? (
        <div className="grai-action-submit">
          <button
            type="button"
            className="grai-mint-btn"
            disabled={bribeDisabled}
            onClick={() => {
              if (!selectedVoter) return
              onBribe(selectedVoter, formatTokenBalance(amountRaw, graiDecimals))
            }}
          >
            {isBribingSelected ? 'Bribing...' : 'Bribe'}
          </button>
        </div>
      ) : (
        <GraiActionConnectWalletButton />
      )}
      <p className="grai-liquidation-buyback-vote-note">
        Pay the bribe asset to buy out a voter&apos;s GRAI. You receive their voted GRAI and take
        their place toward liquidation quorum; the price moves with how close votes are to quorum.
      </p>
    </div>
  )

  if (!selectedVoter || voters.length === 0) {
    return <>{children({ carousel: null, amount, empty: votersEmptyMessage })}</>
  }

  const renderGridVoterItem = (
    voter: EvmVoterEntry | null,
    pageIndex: number,
    slotIndex: number,
  ) => {
    const sourceIndex = pageIndex * gridPageSize + slotIndex
    if (!voter) {
      return (
        <div
          key={`grid-slot-${pageIndex}-${slotIndex}`}
          className="grai-liquidation-voters-item is-grid-slot-empty"
          aria-hidden="true"
        />
      )
    }

    const isSelected = selectedVoter.address.toLowerCase() === voter.address.toLowerCase()
    return (
      <div
        key={voter.address}
        ref={(node) => {
          itemRefs.current[sourceIndex] = node
        }}
        className={`grai-liquidation-voters-item${isSelected ? ' is-selected' : ''}`}
        role="listitem"
      >
        <button
          type="button"
          className="grai-liquidation-voters-item-select"
          aria-pressed={isSelected}
          aria-label={`Select voter ${shortAddress(voter.address)}`}
          onClick={() => {
            setSelectedAddress(voter.address)
            onSelectVoter?.(voter)
          }}
        >
          <GraiLiquidationVoterCard
            voter={voter}
            graiDecimals={graiDecimals}
            supplyShareLabel={totalVoted > 0n ? formatPct(voter.escrowGrai, totalVoted) : null}
            explorerHref={explorerAccountUrl?.(voter.address) ?? null}
            selected={isSelected}
          />
        </button>
      </div>
    )
  }

  const carousel = (
    <div
      className={`grai-liquidation-voters-carousel${isCompact ? ' is-compact' : ''}${listLayout ? ' is-grid' : ''}`}
    >
      <div className="grai-liquidation-voters-viewport">
        {showSideNav ? (
          <button
            type="button"
            className="grai-liquidation-voters-nav grai-liquidation-voters-nav--prev"
            aria-label="Previous voter"
            disabled={!canShiftPrev}
            aria-disabled={!canShiftPrev}
            tabIndex={canShiftPrev ? 0 : -1}
            onClick={() => shiftVoterCarousel(-1)}
          >
            {VOTERS_PAGE_CHEVRON_LEFT}
          </button>
        ) : null}
        <div
          className="grai-liquidation-voters-scroller"
          ref={scrollerRef}
          tabIndex={0}
          role={listLayout ? 'region' : undefined}
          aria-roledescription={listLayout ? 'carousel' : undefined}
          aria-label={listLayout ? 'Voters pages' : undefined}
          onPointerDown={listLayout ? onGridPointerDown : undefined}
          onPointerUp={listLayout ? onGridPointerUp : undefined}
          onPointerCancel={listLayout ? onGridPointerCancel : undefined}
          onKeyDown={
            listLayout
              ? (event) => {
                  if (event.key === 'ArrowRight') {
                    event.preventDefault()
                    goToGridPage(safeGridPage + 1)
                  } else if (event.key === 'ArrowLeft') {
                    event.preventDefault()
                    goToGridPage(safeGridPage - 1)
                  }
                }
              : (event) => {
                  if (event.key === 'ArrowRight') {
                    event.preventDefault()
                    shiftVoterCarousel(1)
                  } else if (event.key === 'ArrowLeft') {
                    event.preventDefault()
                    shiftVoterCarousel(-1)
                  }
                }
          }
        >
          {listLayout ? (
            <div
              className="grai-liquidation-voters-pages"
              style={{
                transform: `translate3d(-${safeGridPage * 100}%, 0, 0)`,
              }}
            >
              {gridPages.map((pageVoters, pageIndex) => (
                <div
                  key={`grid-page-${pageIndex}`}
                  className="grai-liquidation-voters-track"
                  role="list"
                  aria-hidden={pageIndex !== safeGridPage}
                >
                  {pageVoters.map((voter, slotIndex) => renderGridVoterItem(voter, pageIndex, slotIndex))}
                </div>
              ))}
            </div>
          ) : (
            <div className="grai-liquidation-voters-track" role="list">
              {voters.map((voter, index) => {
                const isActive = activeIndexes.has(index)
                const isSelected = selectedVoter.address.toLowerCase() === voter.address.toLowerCase()
                return (
                  <div
                    key={voter.address}
                    ref={(node) => {
                      itemRefs.current[index] = node
                    }}
                    className={`grai-liquidation-voters-item${isActive ? '' : ' is-peek'}${isSelected ? ' is-selected' : ''}`}
                    role="listitem"
                  >
                    <button
                      type="button"
                      className="grai-liquidation-voters-item-select"
                      aria-pressed={isSelected}
                      aria-label={`Select voter ${shortAddress(voter.address)}`}
                      onClick={() => {
                        setSelectedAddress(voter.address)
                        onSelectVoter?.(voter)
                        scrollToIndex(index)
                      }}
                    >
                      <GraiLiquidationVoterCard
                        voter={voter}
                        graiDecimals={graiDecimals}
                        supplyShareLabel={totalVoted > 0n ? formatPct(voter.escrowGrai, totalVoted) : null}
                        explorerHref={explorerAccountUrl?.(voter.address) ?? null}
                        selected={isSelected}
                      />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        {showSideNav ? (
          <button
            type="button"
            className="grai-liquidation-voters-nav grai-liquidation-voters-nav--next"
            aria-label="Next voter"
            disabled={!canShiftNext}
            aria-disabled={!canShiftNext}
            tabIndex={canShiftNext ? 0 : -1}
            onClick={() => shiftVoterCarousel(1)}
          >
            {VOTERS_PAGE_CHEVRON_RIGHT}
          </button>
        ) : null}
      </div>

      {showGridPagination ? (
        <div className="grai-liquidation-voters-pagination" aria-label="Voters pages">
          <button
            type="button"
            className="grai-liquidation-voters-pagination-btn"
            aria-label="Previous voters page"
            disabled={safeGridPage <= 0}
            onClick={() => goToGridPage(safeGridPage - 1)}
          >
            {VOTERS_PAGE_CHEVRON_LEFT}
          </button>
          <span className="grai-liquidation-voters-pagination-status">
            {safeGridPage * gridPageSize + 1}
            –
            {Math.min((safeGridPage + 1) * gridPageSize, voters.length)} of {voters.length}
          </span>
          <button
            type="button"
            className="grai-liquidation-voters-pagination-btn"
            aria-label="Next voters page"
            disabled={safeGridPage >= gridPageCount - 1}
            onClick={() => goToGridPage(safeGridPage + 1)}
          >
            {VOTERS_PAGE_CHEVRON_RIGHT}
          </button>
        </div>
      ) : null}
    </div>
  )

  return <>{children({ carousel, amount, empty: null })}</>
}

export function GraiLiquidationActions() {
  const { chainKind, evm: connectedEvm, connection, solana, explorerTxUrl, solscanAccountUrl } =
    useGraiDeployment()
  const configuredEvmChains = useMemo(() => listConfiguredEvmChains(), [])
  const evmProtocol = connectedEvm ?? configuredEvmChains[0] ?? null
  const activeWallet = useActiveWallet()
  const solanaWallet = useSolanaWallet()
  const evmWallet = useEvmWallet()
  const canTransact =
    (chainKind === 'evm' && connectedEvm !== null && evmWallet.isConnected) ||
    (chainKind === 'solana' && solana !== null && solanaWallet.isConnected)
  // Prefer the wallet that matches the GRAI deployment network. A lone connected
  // wallet also flips chainKind in GraiDeploymentProvider so this stays in sync.
  const isWalletConnected =
    chainKind === 'solana'
      ? solanaWallet.isConnected
      : chainKind === 'evm'
        ? evmWallet.isConnected
        : solanaWallet.isConnected || evmWallet.isConnected || activeWallet.isConnected
  const { vote, isVoting } = useGraiVote()
  const { bribe, isBribing } = useGraiBribe()
  const { liquidate, confirmLiquidation, isLiquidating } = useGraiLiquidate()
  const {
    distribute,
    isDistributing,
    reset: resetDistribute,
  } = useGraiDistribute()
  const { claim: claimDividends, claimAll: claimAllDividendsTx, isPending: isClaiming } = useGraiLock()
  const { assets: graiAssets } = useGraiAssets()
  const [state, setState] = useState<EvmLiquidationVoteState | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [voteAmount, setVoteAmount] = useState('')
  const [costByVoter, setCostByVoter] = useState<Record<string, bigint>>({})
  const [bribingVoter, setBribingVoter] = useState<string | null>(null)
  const [bribeSearch, setBribeSearch] = useState('')
  const [bribeSort, setBribeSort] = useState<'escrow-desc' | 'escrow-asc' | 'bribe-desc' | 'bribe-asc'>(
    'escrow-desc',
  )
  const [bribeVotersOpen, setBribeVotersOpen] = useState(false)
  const votersListLayout = bribeVotersOpen
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false)
  const [distributeAmount, setDistributeAmount] = useState('')
  const [distributeAssetAddress, setDistributeAssetAddress] = useState('')
  const [claimAmount, setClaimAmount] = useState('')
  const [claimAssetAddress, setClaimAssetAddress] = useState('')
  const [claimAllDividends, setClaimAllDividends] = useState(false)
  const [claimTipBps, setClaimTipBps] = useState(100)
  const [claimLockers, setClaimLockers] = useState<EvmLockerEntry[]>([])
  const [selectedClaimLocker, setSelectedClaimLocker] = useState<string | null>(null)
  const [claimableRawByLocker, setClaimableRawByLocker] = useState<Record<string, bigint>>({})
  const [marketView, setMarketView] = useState<'vote' | 'bribe'>(() => {
    const section = readGraiSectionFromHash()
    if (section === 'bribe') return 'bribe'
    return 'vote'
  })
  const [opsView, setOpsView] = useState<
    'claim' | 'distribute' | 'market' | 'liquidate' | 'redeem'
  >(() => {
    const section = readGraiSectionFromHash()
    if (section === 'claim') return 'claim'
    if (section === 'auctions') return 'liquidate'
    if (section === 'burn') return 'redeem'
    if (section === 'vote' || section === 'bribe') return 'market'
    return 'distribute'
  })
  const [isOpsCollapsed, setIsOpsCollapsed] = useState(false)

  useEffect(() => {
    const applySection = (section: GraiSection) => {
      setIsOpsCollapsed(false)
      if (section === 'claim') {
        setOpsView('claim')
      } else if (section === 'bribe') {
        setOpsView('market')
        setMarketView('bribe')
      } else if (section === 'vote') {
        setOpsView('market')
        setMarketView('vote')
      } else if (section === 'auctions') {
        setOpsView('liquidate')
      } else if (section === 'burn') {
        setOpsView('redeem')
      } else if (section === 'assets') {
        setOpsView('distribute')
      }
    }

    const onSectionNav = (event: Event) => {
      applySection((event as CustomEvent<GraiSection>).detail)
    }

    const onHashChange = () => {
      const section = readGraiSectionFromHash()
      if (
        section === 'claim' ||
        section === 'vote' ||
        section === 'bribe' ||
        section === 'auctions' ||
        section === 'burn' ||
        section === 'assets'
      ) {
        applySection(section)
      }
    }

    window.addEventListener('grai-section-nav', onSectionNav)
    window.addEventListener('hashchange', onHashChange)
    onHashChange()

    return () => {
      window.removeEventListener('grai-section-nav', onSectionNav)
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [])

  const handleOpsViewChange = useCallback(
    (view: 'claim' | 'distribute' | 'market' | 'liquidate' | 'redeem') => {
      setOpsView(view)
      if (view === 'redeem') {
        navigateToGraiSection('burn')
        return
      }
      replaceAppHash(
        '/grai',
        view === 'claim'
          ? '#claim'
          : view === 'market'
            ? `#${marketView}`
            : view === 'liquidate'
              ? '#auctions'
              : '#assets',
      )
    },
    [marketView],
  )

  const handleMarketViewChange = useCallback((view: 'vote' | 'bribe') => {
    setOpsView('market')
    setMarketView(view)
    if (view !== 'bribe') setBribeVotersOpen(false)
    replaceAppHash('/grai', `#${view}`)
  }, [])

  const walletAddress =
    isWalletConnected
      ? chainKind === 'solana'
        ? solanaWallet.address || null
        : chainKind === 'evm'
          ? evmWallet.address || null
          : activeWallet.address || null
      : null

  const refreshState = useCallback(async () => {
    setIsLoading(true)
    try {
      if (chainKind === 'solana' && connection && solana) {
        let owner: PublicKey | null = null
        if (walletAddress) {
          try {
            owner = new PublicKey(walletAddress)
          } catch {
            owner = null
          }
        }
        const next = await fetchSolanaLiquidationVoteState(connection, solana, owner)
        setState(next)
        return
      }

      if (evmProtocol) {
        const next = await fetchEvmLiquidationVoteState(
          evmProtocol,
          canTransact && walletAddress ? (walletAddress as `0x${string}`) : null,
        )
        setState(next)
        return
      }

      setState(null)
    } catch {
      setState(null)
    } finally {
      setIsLoading(false)
    }
  }, [canTransact, chainKind, connection, evmProtocol, solana, walletAddress])

  useEffect(() => {
    void refreshState()
  }, [refreshState])

  const graiDecimals = state?.graiDecimals ?? (chainKind === 'evm' ? GRAI_DECIMALS_EVM : GRAI_DECIMALS)
  const onchainVoters = useMemo(() => state?.voterEntries ?? [], [state?.voterEntries])
  // Never fall back to EVM mock voters on Solana — show empty until RPC returns real escrows.
  const usingMockVoters = chainKind !== 'solana' && onchainVoters.length === 0
  const voterEntries = usingMockVoters ? MOCK_VOTERS : onchainVoters
  const settlementSymbol = state?.settlementSymbol ?? '—'
  const settlementDecimals = state?.settlementDecimals ?? (chainKind === 'solana' ? 6 : 18)
  const bribePremiumBps = state?.bribePremiumBps ?? 200
  const explorerAccountUrl = useMemo(() => {
    if (chainKind === 'solana' && solana) {
      return (address: string) => solscanAccountUrl(address)
    }
    if (!evmProtocol) return null
    const chainId = evmProtocol.chainId
    return (address: string) => evmExplorerAccountUrl(chainId, address)
  }, [chainKind, evmProtocol, solana, solscanAccountUrl])

  useEffect(() => {
    if (voterEntries.length === 0) {
      setCostByVoter({})
      return
    }

    if (usingMockVoters || !evmProtocol) {
      const next: Record<string, bigint> = {}
      for (const voter of voterEntries) {
        next[voter.address.toLowerCase()] = estimateMockBribeCost(voter.escrowGrai, bribePremiumBps)
      }
      setCostByVoter(next)
      return
    }

    let cancelled = false
    void (async () => {
      const entries = await Promise.all(
        voterEntries.map(async (voter) => {
          try {
            const { bribeAmount } = await previewEvmBribe(evmProtocol, voter.address, voter.escrowGrai)
            return [voter.address.toLowerCase(), bribeAmount] as const
          } catch {
            return [voter.address.toLowerCase(), estimateMockBribeCost(voter.escrowGrai, bribePremiumBps)] as const
          }
        }),
      )
      if (!cancelled) setCostByVoter(Object.fromEntries(entries))
    })()

    return () => {
      cancelled = true
    }
  }, [
    bribePremiumBps,
    evmProtocol,
    graiDecimals,
    settlementDecimals,
    settlementSymbol,
    usingMockVoters,
    voterEntries,
  ])

  const unvotedEscrowGrai = state
    ? (state.lockedGrai > state.votedGrai ? state.lockedGrai - state.votedGrai : 0n)
    : 0n
  const voteAvailableGrai = state ? unvotedEscrowGrai + state.walletGrai : 0n
  const walletGraiLabel = state ? formatTokenBalance(voteAvailableGrai, graiDecimals) : '—'
  const voteMaxAmount =
    state && voteAvailableGrai > 0n ? formatTokenBalance(voteAvailableGrai, graiDecimals) : ''
  const voteAssetOptions = useMemo<GraiAmountAsset[]>(
    () => [
      {
        icon: assetUrl('logo.png'),
        symbol: 'GRAI',
        address: evmProtocol
          ? (evmProtocol.graiToken ?? evmProtocol.protocolAddress ?? 'grai')
          : 'grai',
      },
    ],
    [evmProtocol],
  )
  const distributeAssetOptions = useMemo<GraiAmountAsset[]>(() => {
    return graiAssets
      .filter((asset) => asset.symbol.toUpperCase() !== 'GRAI')
      .map((asset) => ({
        icon: asset.icon.src,
        symbol: asset.symbol,
        address: asset.mint,
      }))
  }, [graiAssets])
  const selectedDistributeAsset = useMemo(() => {
    return (
      distributeAssetOptions.find(
        (asset) => asset.address.toLowerCase() === distributeAssetAddress.toLowerCase(),
      ) ?? distributeAssetOptions[0]
    )
  }, [distributeAssetAddress, distributeAssetOptions])
  useEffect(() => {
    if (!selectedDistributeAsset) return
    if (distributeAssetAddress.toLowerCase() === selectedDistributeAsset.address.toLowerCase()) return
    setDistributeAssetAddress(selectedDistributeAsset.address)
  }, [distributeAssetAddress, selectedDistributeAsset])
  const selectedClaimAsset = useMemo(() => {
    return (
      distributeAssetOptions.find(
        (asset) => asset.address.toLowerCase() === claimAssetAddress.toLowerCase(),
      ) ?? distributeAssetOptions[0]
    )
  }, [claimAssetAddress, distributeAssetOptions])
  useEffect(() => {
    if (!selectedClaimAsset) return
    if (claimAssetAddress.toLowerCase() === selectedClaimAsset.address.toLowerCase()) return
    setClaimAssetAddress(selectedClaimAsset.address)
  }, [claimAssetAddress, selectedClaimAsset])
  const {
    claim: claimEstimate,
    claims: claimEstimates,
    claimableLabel,
    claimableMaxAmount,
    usdLabel: claimUsdLabel,
    isLoading: claimBalanceLoading,
    refresh: refreshClaimEstimate,
  } = useGraiClaimEstimate(
    opsView === 'claim' && Boolean(selectedClaimLocker),
    selectedClaimAsset?.address,
    selectedClaimLocker,
  )
  const claimDecimals = claimEstimate.decimals || 9

  const lockerHasAnyClaimable = useMemo(() => {
    if (claimEstimates.some((row) => row.amountRaw > 0n)) return true
    if (!selectedClaimLocker) return false
    return (claimableRawByLocker[selectedClaimLocker.toLowerCase()] ?? 0n) > 0n
  }, [claimEstimates, claimableRawByLocker, selectedClaimLocker])

  // Prefill claim amount when the selected locker/asset has positive claimable.
  useEffect(() => {
    if (opsView !== 'claim' || claimAllDividends) return
    if (!claimableMaxAmount) {
      setClaimAmount('')
      return
    }
    setClaimAmount(claimableMaxAmount)
  }, [
    claimAllDividends,
    claimableMaxAmount,
    opsView,
    selectedClaimAsset?.address,
    selectedClaimLocker,
  ])

  useEffect(() => {
    if (opsView !== 'claim') return
    let cancelled = false
    void (async () => {
      try {
        let next: EvmLockerEntry[] = []
        if (chainKind === 'solana' && connection && solana) {
          next = await fetchSolanaLockers(connection, solana)
        } else if (chainKind === 'evm' && (connectedEvm || evmProtocol)) {
          next = await fetchEvmLockers(connectedEvm ?? evmProtocol!)
        }
        if (cancelled) return
        const sorted = [...next].sort((a, b) => {
          const aIsWallet =
            walletAddress != null && a.address.toLowerCase() === walletAddress.toLowerCase()
          const bIsWallet =
            walletAddress != null && b.address.toLowerCase() === walletAddress.toLowerCase()
          if (aIsWallet !== bIsWallet) return aIsWallet ? -1 : 1
          if (a.lockedGrai === b.lockedGrai) return 0
          return a.lockedGrai > b.lockedGrai ? -1 : 1
        })
        setClaimLockers(sorted)
      } catch {
        if (!cancelled) setClaimLockers([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [chainKind, connectedEvm, connection, evmProtocol, opsView, solana, walletAddress])

  useEffect(() => {
    if (opsView !== 'claim') return
    if (claimLockers.length === 0) {
      setSelectedClaimLocker(null)
      return
    }
    setSelectedClaimLocker((current) => {
      if (current != null) return current
      const walletLocker =
        walletAddress != null
          ? claimLockers.find(
              (locker) => locker.address.toLowerCase() === walletAddress.toLowerCase(),
            )
          : undefined
      return walletLocker?.address ?? claimLockers[0]?.address ?? null
    })
  }, [claimLockers, opsView, walletAddress])

  useEffect(() => {
    if (opsView !== 'claim' || claimLockers.length === 0) {
      setClaimableRawByLocker({})
      return
    }

    let cancelled = false

    void (async () => {
      const entries = await Promise.all(
        claimLockers.map(async (locker) => {
          const key = locker.address.toLowerCase()
          try {
            if (chainKind === 'solana' && connection && solana) {
              const claims = await estimateSolanaClaimAll(
                connection,
                solana,
                new PublicKey(locker.address),
              )
              const usdRaw = claims.reduce((sum, claim) => sum + claim.usdRaw, 0n)
              return [key, usdRaw] as const
            }

            if (
              chainKind === 'evm' &&
              (connectedEvm || evmProtocol) &&
              locker.address.startsWith('0x')
            ) {
              const claims = await estimateEvmClaimAll(
                connectedEvm ?? evmProtocol!,
                locker.address.toLowerCase() as `0x${string}`,
              )
              const usdRaw = claims.reduce((sum, claim) => sum + claim.usdRaw, 0n)
              return [key, usdRaw] as const
            }

            return [key, 0n] as const
          } catch {
            return [key, 0n] as const
          }
        }),
      )
      if (cancelled) return
      setClaimableRawByLocker(Object.fromEntries(entries))
    })()

    return () => {
      cancelled = true
    }
  }, [
    chainKind,
    claimLockers,
    connectedEvm,
    connection,
    evmProtocol,
    opsView,
    solana,
  ])

  useEffect(() => {
    if (opsView !== 'claim') return
    let cancelled = false
    void (async () => {
      try {
        if (chainKind === 'evm' && connectedEvm) {
          const { createGraiEvmPublicClient, resolveGraiContractAddress } = await import('../../grai/evm/client')
          const { graiAbi } = await import('../../grai/evm/abi')
          const client = createGraiEvmPublicClient(connectedEvm)
          const config = await client.readContract({
            address: resolveGraiContractAddress(connectedEvm),
            abi: graiAbi,
            functionName: 'config',
          })
          if (!cancelled) setClaimTipBps(Number(config[3]))
          return
        }
        if (chainKind === 'solana' && connection && solana) {
          const { fetchGraiProtocol } = await import('../../grai/fetchGraiProtocol')
          const protocol = await fetchGraiProtocol(connection, solana.graiMint)
          if (!cancelled) setClaimTipBps(protocol.config.claimTipBps)
        }
      } catch {
        // keep default 1%
      }
    })()
    return () => {
      cancelled = true
    }
  }, [chainKind, connectedEvm, connection, opsView, solana])

  const claimAmountRaw = useMemo(() => {
    if (claimAllDividends) return claimEstimate.amountRaw
    if (!claimAmount.trim()) return 0n
    try {
      return parseTokenAmount(claimAmount, claimDecimals)
    } catch {
      return 0n
    }
  }, [claimAllDividends, claimAmount, claimDecimals, claimEstimate.amountRaw])

  const claimTipRaw = useMemo(
    () => (claimAmountRaw * BigInt(claimTipBps)) / 10_000n,
    [claimAmountRaw, claimTipBps],
  )

  const claimTipLabel = useMemo(
    () => (claimTipRaw <= 0n ? '0' : formatTokenBalance(claimTipRaw, claimDecimals)),
    [claimDecimals, claimTipRaw],
  )

  const claimTipPctLabel = useMemo(() => {
    const pct = claimTipBps / 100
    return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`
  }, [claimTipBps])

  const {
    balanceLabel: distributeWalletBalanceLabel,
    maxAmount: distributeWalletMaxAmount,
    decimals: distributeWalletDecimals,
    isLoading: distributeWalletBalanceLoading,
  } = useWalletAssetBalance(
    selectedDistributeAsset?.address || undefined,
    selectedDistributeAsset?.symbol,
  )
  const distributeDecimals = distributeWalletDecimals ?? 9
  const { usdLabel: distributeUsdLabel } = useGraiAssetUsdLabel(
    selectedDistributeAsset?.address,
    distributeAmount,
    distributeWalletDecimals,
  )

  const liquidationBlocked = state?.liquidationOpen ?? false
  const redeemAvailable = liquidationBlocked
  const liquidationConfirmed = state?.confirmed ?? false
  const liquidationHasQuorum = state?.hasQuorum ?? false
  const quorumBps = state?.liquidationQuorumBps ?? 6667
  const totalVotedAmount = state?.totalVoted ?? 0n
  const totalSupplyAmount = state?.totalSupply ?? 0n
  const quorumProgress = state
    ? quorumProgressPct(totalVotedAmount, totalSupplyAmount, quorumBps)
    : 0
  const quorumNeededAmount = quorumRequiredAmount(totalSupplyAmount, quorumBps)
  const untilQuorumAmount =
    quorumNeededAmount > totalVotedAmount ? quorumNeededAmount - totalVotedAmount : 0n
  const totalVotedLabel = state ? formatTokenBalance(totalVotedAmount, graiDecimals) : '—'
  const untilQuorumLabel = state ? formatTokenBalance(untilQuorumAmount, graiDecimals) : '—'
  const totalSupplyLabel = state ? formatTokenBalance(totalSupplyAmount, graiDecimals) : '—'
  const votedShareLabel = state ? formatPct(totalVotedAmount, totalSupplyAmount) : '—'
  const untilQuorumShareLabel = state
    ? formatPct(untilQuorumAmount, totalSupplyAmount)
    : '—'

  useEffect(() => {
    if (isLoading || redeemAvailable || opsView !== 'redeem') return
    setOpsView('distribute')
    if (window.location.hash === '#burn') replaceAppHash('/grai', '#assets')
  }, [isLoading, opsView, redeemAvailable])

  const voteUsdLabel = useMemo(() => {
    const trimmed = voteAmount.trim()
    if (!trimmed || !state || state.totalSupply <= 0n) return '$0.00'
    try {
      const amountRaw = parseTokenAmount(trimmed, graiDecimals)
      if (amountRaw <= 0n) return '$0.00'
      const usdRaw = (amountRaw * state.totalValue) / state.totalSupply
      if (usdRaw <= 0n) return '$0.00'
      return `$${formatVaultBalanceDisplay(usdRaw, USD_DECIMALS, 6)}`
    } catch {
      return '$0.00'
    }
  }, [graiDecimals, state, voteAmount])

  const voteMightReceiveLabel = useMemo(() => {
    const trimmed = voteAmount.trim()
    if (!trimmed || !state) return null
    let graiAmount = 0n
    try {
      graiAmount = parseTokenAmount(trimmed, graiDecimals)
    } catch {
      return null
    }
    if (graiAmount <= 0n) return null

    // Price the ask after this vote is counted toward totalVoted.
    const votedAfter = totalVotedAmount + graiAmount
    const receive = estimateBribeReceive(
      graiAmount,
      totalSupplyAmount,
      state.totalValue,
      votedAfter,
      quorumBps,
      bribePremiumBps,
      settlementDecimals,
    )
    if (receive <= 0n) return null
    return formatTokenBalance(receive, settlementDecimals)
  }, [
    bribePremiumBps,
    graiDecimals,
    quorumBps,
    settlementDecimals,
    state,
    totalSupplyAmount,
    totalVotedAmount,
    voteAmount,
  ])

  const totalVotedForShare = useMemo(() => {
    if (state && state.totalVoted > 0n) return state.totalVoted
    return voterEntries.reduce((sum, voter) => sum + voter.escrowGrai, 0n)
  }, [state, voterEntries])

  const filteredBribeVoters = useMemo(() => {
    const query = bribeSearch.trim().toLowerCase()
    const filtered = query
      ? voterEntries.filter((voter) => voter.address.toLowerCase().includes(query))
      : [...voterEntries]

    const bribeCostRaw = (voter: EvmVoterEntry): bigint => {
      const premium = BigInt(bribePremiumBps)
      return (voter.escrowGrai * (BPS + premium)) / BPS
    }

    filtered.sort((a, b) => {
      if (bribeSort === 'escrow-desc') return a.escrowGrai === b.escrowGrai ? 0 : a.escrowGrai < b.escrowGrai ? 1 : -1
      if (bribeSort === 'escrow-asc') return a.escrowGrai === b.escrowGrai ? 0 : a.escrowGrai > b.escrowGrai ? 1 : -1
      if (bribeSort === 'bribe-desc') {
        const ca = bribeCostRaw(a)
        const cb = bribeCostRaw(b)
        return ca === cb ? 0 : ca < cb ? 1 : -1
      }
      const ca = bribeCostRaw(a)
      const cb = bribeCostRaw(b)
      return ca === cb ? 0 : ca > cb ? 1 : -1
    })

    return filtered
  }, [bribePremiumBps, bribeSearch, bribeSort, voterEntries])

  const handleVote = async () => {
    const toastId = toast.loading('Voting for liquidation…')
    try {
      const signature = await vote({ amountInput: voteAmount, graiDecimals })
      toast.update(toastId, {
        render: (
          <GraiTransactionToast
            message="Vote submitted"
            explorerHref={signature ? explorerTxUrl(signature) : null}
          />
        ),
        type: 'success',
        isLoading: false,
        autoClose: 8000,
        closeOnClick: true,
      })
      setVoteAmount('')
      void refreshState()
    } catch (error) {
      toast.update(toastId, {
        render: error instanceof Error ? error.message : 'Vote transaction failed',
        type: 'error',
        isLoading: false,
        autoClose: 8000,
        closeOnClick: true,
      })
    }
  }

  const handleConfirmLiquidation = async () => {
    const toastId = toast.loading('Confirming liquidation…')
    try {
      const signature = await confirmLiquidation({
        connectMessage: 'Connect a wallet to confirm liquidation',
        chainAction: 'confirm liquidation',
        failureMessage: 'Confirm transaction failed',
      })
      toast.update(toastId, {
        render: (
          <GraiTransactionToast
            message="Liquidation confirmed"
            explorerHref={signature ? explorerTxUrl(signature) : null}
          />
        ),
        type: 'success',
        isLoading: false,
        autoClose: 8000,
        closeOnClick: true,
      })
      void refreshState()
    } catch (error) {
      toast.update(toastId, {
        render: error instanceof Error ? error.message : 'Confirm transaction failed',
        type: 'error',
        isLoading: false,
        autoClose: 8000,
        closeOnClick: true,
      })
    }
  }

  const handleOpenLiquidation = async () => {
    const toastId = toast.loading('Opening liquidation…')
    try {
      const signature = await liquidate({
        connectMessage: 'Connect a wallet to open liquidation',
        chainAction: 'open liquidation',
        failureMessage: 'Liquidate transaction failed',
      })
      toast.update(toastId, {
        render: (
          <GraiTransactionToast
            message="Liquidation opened"
            explorerHref={signature ? explorerTxUrl(signature) : null}
          />
        ),
        type: 'success',
        isLoading: false,
        autoClose: 8000,
        closeOnClick: true,
      })
      void refreshState()
    } catch (error) {
      toast.update(toastId, {
        render: error instanceof Error ? error.message : 'Liquidate transaction failed',
        type: 'error',
        isLoading: false,
        autoClose: 8000,
        closeOnClick: true,
      })
    }
  }

  const handleDistribute = async () => {
    if (!selectedDistributeAsset?.address) return
    const toastId = toast.loading('Distributing yield…')
    try {
      const signature = await distribute({
        assetMint: selectedDistributeAsset.address,
        amountInput: distributeAmount,
        assetDecimals: distributeDecimals,
      })
      toast.update(toastId, {
        render: (
          <GraiTransactionToast
            message="Distribute submitted"
            explorerHref={signature ? explorerTxUrl(signature) : null}
          />
        ),
        type: 'success',
        isLoading: false,
        autoClose: 8000,
        closeOnClick: true,
      })
      setDistributeAmount('')
      resetDistribute()
    } catch (error) {
      toast.update(toastId, {
        render: error instanceof Error ? error.message : 'Distribute transaction failed',
        type: 'error',
        isLoading: false,
        autoClose: 8000,
        closeOnClick: true,
      })
    }
  }

  const handleClaim = async () => {
    const toastId = toast.loading(claimAllDividends ? 'Claiming all dividends…' : 'Claiming dividends…')
    try {
      const holder = selectedClaimLocker ?? undefined
      const signature = claimAllDividends
        ? await claimAllDividendsTx({ holder })
        : await claimDividends({
            assetAddress: selectedClaimAsset!.address,
            amountInput: claimAmount,
            assetDecimals: claimDecimals,
            holder,
          })
      toast.update(toastId, {
        render: (
          <GraiTransactionToast
            message={claimAllDividends ? 'Claim all submitted' : 'Claim submitted'}
            explorerHref={signature ? explorerTxUrl(signature) : null}
          />
        ),
        type: 'success',
        isLoading: false,
        autoClose: 8000,
        closeOnClick: true,
      })
      setClaimAmount('')
      refreshClaimEstimate()
      setClaimableRawByLocker({})
      // Re-fetch locker claimables after a successful claim.
      setClaimLockers((current) => [...current])
    } catch (error) {
      toast.update(toastId, {
        render: error instanceof Error ? error.message : 'Claim transaction failed',
        type: 'error',
        isLoading: false,
        autoClose: 8000,
        closeOnClick: true,
      })
    }
  }

  const handleBribe = async (voter: EvmVoterEntry, amountInput: string) => {
    if (usingMockVoters) {
      toast.info('Bribe is disabled while showing mock voters.')
      return
    }

    setBribingVoter(voter.address)
    const toastId = toast.loading('Bribing against liquidation…')
    try {
      const signature = await bribe({
        voter: voter.address,
        amountInput,
        graiDecimals,
      })
      toast.update(toastId, {
        render: (
          <GraiTransactionToast
            message="Bribe submitted"
            explorerHref={signature ? explorerTxUrl(signature) : null}
          />
        ),
        type: 'success',
        isLoading: false,
        autoClose: 8000,
        closeOnClick: true,
      })
      void refreshState()
    } catch (error) {
      toast.update(toastId, {
        render: error instanceof Error ? error.message : 'Bribe transaction failed',
        type: 'error',
        isLoading: false,
        autoClose: 8000,
        closeOnClick: true,
      })
    } finally {
      setBribingVoter(null)
    }
  }

  const opsTabs = (
    <div
      className={`grai-action-switch grai-action-switch--ops is-${opsView === 'market' ? marketView : opsView}-active${
        redeemAvailable ? ' has-redeem' : ''
      }`}
      role="tablist"
      aria-label="Protocol operations"
    >
      <button
        type="button"
        role="tab"
        aria-selected={opsView === 'distribute'}
        className={`grai-action-switch-btn is-distribute ${opsView === 'distribute' ? 'is-active' : ''}`}
        onClick={() => handleOpsViewChange('distribute')}
      >
        <span className="grai-action-switch-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="5" cy="6" r="2.25" />
            <circle cx="19" cy="6" r="2.25" />
            <circle cx="12" cy="18" r="2.25" />
            <path d="M7 7.5 10.5 15" />
            <path d="m17 7.5-3.5 7.5" />
          </svg>
        </span>
        <span className="grai-action-switch-label">Distribute</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={opsView === 'claim'}
        className={`grai-action-switch-btn is-claim ${opsView === 'claim' ? 'is-active' : ''}`}
        onClick={() => handleOpsViewChange('claim')}
      >
        <span className="grai-action-switch-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5" />
            <path d="m5 12 7 7 7-7" />
          </svg>
        </span>
        <span className="grai-action-switch-label">Claim</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={opsView === 'market' && marketView === 'vote'}
        className={`grai-action-switch-btn is-vote ${opsView === 'market' && marketView === 'vote' ? 'is-active' : ''}`}
        onClick={() => handleMarketViewChange('vote')}
      >
        <span className="grai-action-switch-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 12 2 2 4-4" />
            <path d="M5 7h14v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7z" />
            <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
          </svg>
        </span>
        <span className="grai-action-switch-label">Vote</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={opsView === 'market' && marketView === 'bribe'}
        className={`grai-action-switch-btn is-bribe ${opsView === 'market' && marketView === 'bribe' ? 'is-active' : ''}`}
        onClick={() => handleMarketViewChange('bribe')}
      >
        <span className="grai-action-switch-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 12v10H4V12" />
            <path d="M2 7h20v5H2z" />
            <path d="M12 22V7" />
            <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
            <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
          </svg>
        </span>
        <span className="grai-action-switch-label">Bribe</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={opsView === 'liquidate'}
        className={`grai-action-switch-btn is-liquidate ${opsView === 'liquidate' ? 'is-active' : ''}`}
        onClick={() => handleOpsViewChange('liquidate')}
      >
        <span className="grai-action-switch-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
          </svg>
        </span>
        <span className="grai-action-switch-label">Liquidate</span>
      </button>
      {redeemAvailable ? (
        <button
          type="button"
          role="tab"
          aria-selected={opsView === 'redeem'}
          className={`grai-action-switch-btn is-redeem ${opsView === 'redeem' ? 'is-active' : ''}`}
          onClick={() => handleOpsViewChange('redeem')}
        >
          <span className="grai-action-switch-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12h8" />
            </svg>
          </span>
          <span className="grai-action-switch-label">Redeem</span>
        </button>
      ) : null}
    </div>
  )

  const liquidateReadyCount =
    (liquidationHasQuorum ? 1 : 0) + (liquidationConfirmed ? 1 : 0)

  const liquidatePanel = (
    <div className="grai-liquidation-open" id="grai-liquidation-open">
      <div id="grai-liquidation-open-panel" className="grai-liquidation-open-panel is-open">
        <div className="grai-liquidation-open-panel-inner">
          <p className="grai-liquidation-step-ready" aria-live="polite">
            {isLoading
              ? 'Checking conditions…'
              : liquidationBlocked
                ? 'Liquidation open'
                : `${liquidateReadyCount} of 2 required`}
          </p>
          <div className="grai-action-result-group grai-liquidation-yield-results">
            <div className="grai-action-result" aria-live="polite">
              <span className="grai-action-result-label-wrap">
                <span className="grai-action-result-label">Quorum reached:</span>
              </span>
              <span className="grai-action-result-value">
                {isLoading ? '…' : liquidationHasQuorum ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="grai-action-result" aria-live="polite">
              <span className="grai-action-result-label-wrap">
                <span className="grai-action-result-label">Owner confirmed:</span>
              </span>
              <span className="grai-action-result-value">
                {isLoading ? '…' : liquidationConfirmed ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
          <div className="grai-action-submit grai-liquidation-step-actions">
            {isWalletConnected ? (
              <>
                <div className="grai-liquidation-step-action">
                  <span className="grai-liquidation-step-meta">Transaction 1 of 2</span>
                  <button
                    type="button"
                    className="grai-mint-btn"
                    disabled={isLiquidating || liquidationBlocked || liquidationConfirmed}
                    title={
                      liquidationBlocked
                        ? 'Liquidation is already open'
                        : liquidationConfirmed
                          ? 'Owner already confirmed'
                          : undefined
                    }
                    onClick={() => {
                      void handleConfirmLiquidation()
                    }}
                  >
                    {isLiquidating ? 'Confirming…' : 'Confirm'}
                  </button>
                </div>
                <div className="grai-liquidation-step-action">
                  <span className="grai-liquidation-step-meta">Transaction 2 of 2</span>
                  <button
                    type="button"
                    className="grai-mint-btn"
                    disabled={
                      isLiquidating ||
                      liquidationBlocked ||
                      !liquidationHasQuorum ||
                      !liquidationConfirmed
                    }
                    title={
                      liquidationBlocked
                        ? 'Liquidation is already open'
                        : !liquidationHasQuorum
                          ? 'Quorum not reached yet'
                          : !liquidationConfirmed
                            ? 'Owner must confirm first'
                            : undefined
                    }
                    onClick={() => {
                      void handleOpenLiquidation()
                    }}
                  >
                    {isLiquidating ? 'Liquidating…' : 'Liquidate'}
                  </button>
                </div>
              </>
            ) : (
              <GraiActionConnectWalletButton />
            )}
            <span className="grai-liquidation-step-hint">
              Liquidate needs 2 of 2: quorum reached and Grinders owner confirmed.
            </span>
          </div>
        </div>
      </div>
    </div>
  )

  const quorumInfographic = (
    <div
      className={`grai-liquidation-quorum-infographic${liquidationHasQuorum ? ' is-reached' : ''}${
        liquidationBlocked ? ' is-open' : ''
      }`}
      role="region"
      aria-label="Liquidation quorum progress"
    >
      <div className="grai-liquidation-quorum-body">
        <div className="grai-liquidation-quorum-header">
          <div className="grai-liquidation-quorum-stats">
            <div className="grai-liquidation-quorum-stat">
              <span className="grai-liquidation-quorum-stat-label">Voted</span>
              <span className="grai-liquidation-quorum-stat-value">
                <span className="grai-liquidation-quorum-stat-amount">
                  {isLoading ? '…' : totalVotedLabel}
                </span>
                <span className="grai-liquidation-quorum-stat-unit">
                  GRAI · {isLoading ? '…' : votedShareLabel}
                </span>
              </span>
            </div>
            <div className="grai-liquidation-quorum-stat grai-liquidation-quorum-stat--center">
              <span className="grai-liquidation-quorum-stat-label">Total supply</span>
              <span className="grai-liquidation-quorum-stat-value">
                <span className="grai-liquidation-quorum-stat-amount">
                  {isLoading ? '…' : totalSupplyLabel}
                </span>
                <span className="grai-liquidation-quorum-stat-unit">GRAI</span>
              </span>
            </div>
            <div className="grai-liquidation-quorum-stat grai-liquidation-quorum-stat--bribe">
              <span className="grai-liquidation-quorum-stat-label">Until quorum</span>
              <span className="grai-liquidation-quorum-stat-value">
                <span className="grai-liquidation-quorum-stat-amount">
                  {isLoading ? '…' : liquidationHasQuorum ? '0' : untilQuorumLabel}
                </span>
                <span className="grai-liquidation-quorum-stat-unit">
                  GRAI · {isLoading ? '…' : liquidationHasQuorum ? '0.0%' : untilQuorumShareLabel}
                </span>
              </span>
            </div>
          </div>
        </div>

        <div
          className="grai-liquidation-quorum-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(quorumProgress)}
          aria-label="Progress toward liquidation quorum"
        >
          <div
            className="grai-liquidation-quorum-track-fill"
            style={{ width: `${isLoading ? 0 : quorumProgress}%` }}
          />
          <span className="grai-liquidation-quorum-track-mark" aria-hidden="true" />
        </div>
      </div>
    </div>
  )

  return (
    <div className="grai-liquidation-actions" aria-live="polite">
      {!evmProtocol ? (
        <p className="grai-liquidation-notice" role="status">
          {solana ? 'EVM NOT CONFIGURED, SOLANA CONFIGURED' : 'EVM NOT CONFIGURED'}
        </p>
      ) : !canTransact ? (
        <p className="grai-liquidation-notice" role="status">
          Liquidation vote and bribe run on EVM GRAI ({evmProtocol.chainName}). Connect an EVM wallet to submit
          transactions.
        </p>
      ) : null}

      <div className="grai-liquidation-ops-block">
      <h3 className="grai-liquidation-ops-heading">
        <button
          type="button"
          className={`grai-referral-dash-collapse${isOpsCollapsed ? ' is-collapsed' : ''}`}
          onClick={() => setIsOpsCollapsed((collapsed) => !collapsed)}
          aria-expanded={!isOpsCollapsed}
          aria-controls="grai-liquidation-ops-layout"
          aria-label={isOpsCollapsed ? 'Show GRAI operations' : 'Hide GRAI operations'}
        >
          <svg
            className="grai-donut-legend-toggle-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        GRAI operations
      </h3>
      <div
        className={`grai-liquidation-ops-body${isOpsCollapsed ? '' : ' is-open'}`}
        id="grai-liquidation-ops-layout"
        aria-hidden={isOpsCollapsed}
      >
        <div className="grai-liquidation-ops-body-inner">
      <div className="grai-liquidation-ops-layout">
      <aside className="grai-liquidation-ops-tabs">
        {opsTabs}
      </aside>

      <div className="grai-liquidation-ops-main">
      {opsView === 'claim' ? (
      <div className="grai-liquidation-distribute-screen grai-claim-screen" id="grai-claim-section">
        <h3 className="grai-liquidation-distribute-title">Claim</h3>
        <GraiReferralTree
          layout="graph-only"
          evmProtocol={chainKind === 'evm' ? evmProtocol : null}
          solana={chainKind === 'solana' ? solana : null}
          connection={chainKind === 'solana' ? connection : null}
          highlightAddress={walletAddress}
          graiDecimals={graiDecimals}
          selectedLockerId={selectedClaimLocker}
          claimUsdByLocker={claimableRawByLocker}
          onSelectLocker={(lockerId) => {
            setSelectedClaimLocker(lockerId)
            setClaimAmount('')
          }}
        />
        <div className="grai-liquidation-ops-row">
          <div className="grai-liquidation-yield-block">
            <div className="grai-liquidation-escrow-body">
              <GraiAmountInput
                key={selectedClaimAsset?.address ?? 'claim-amount'}
                label="Claim Amount"
                assets={distributeAssetOptions}
                defaultAsset={selectedClaimAsset?.symbol}
                value={claimAmount}
                onValueChange={setClaimAmount}
                onAssetChange={(asset) => {
                  setClaimAssetAddress(asset.address)
                  setClaimAmount('')
                }}
                balanceLabel={selectedClaimLocker ? claimableLabel : '—'}
                balanceLoading={Boolean(selectedClaimLocker) && claimBalanceLoading}
                balancePrefix="Claimable:"
                maxAmount={
                  selectedClaimLocker && !claimAllDividends ? claimableMaxAmount : ''
                }
                decimals={claimDecimals}
                showPresets={!claimAllDividends}
                showVolatility={false}
                usdLabel={claimUsdLabel}
                usdTrailingLabel="claimable:"
                disabled={claimAllDividends}
              />
              <div
                className={`grai-mint-dividends-toggle is-yes-no is-below-amount${
                  claimAllDividends ? ' is-active' : ''
                }`}
              >
                <span className="grai-mint-dividends-toggle-label">
                  <span className="grai-mint-dividends-toggle-label-text">Claim all dividends:</span>
                </span>
                <button
                  type="button"
                  className={`grai-mint-dividends-toggle-btn${claimAllDividends ? ' is-active' : ''}`}
                  role="switch"
                  aria-checked={claimAllDividends}
                  aria-label="Claim all dividends"
                  onClick={() => setClaimAllDividends((current) => !current)}
                >
                  <span className="grai-mint-dividends-toggle-option is-yes">Yes</span>
                  <span className="grai-mint-dividends-toggle-track" aria-hidden="true">
                    <span className="grai-mint-dividends-toggle-thumb" />
                  </span>
                  <span className="grai-mint-dividends-toggle-option is-no">No</span>
                </button>
              </div>
              <div className="grai-liquidation-bribe-amount-row">
                <span className="grai-liquidation-bribe-amount-label">
                  You claim{' '}
                  {selectedClaimLocker ? (
                    <span
                      className="grai-liquidation-bribe-amount-address"
                      title={selectedClaimLocker}
                    >
                      {shortAddress(selectedClaimLocker)}
                    </span>
                  ) : null}
                </span>
                <span className="grai-liquidation-bribe-amount-value">
                  {claimAllDividends
                    ? 'All dividends'
                    : `${claimAmount.trim() || '0'} ${selectedClaimAsset?.symbol ?? ''}`}
                </span>
              </div>
              <div className="grai-liquidation-bribe-amount-row">
                <span className="grai-liquidation-bribe-amount-label">Your tip:</span>
                <span className="grai-liquidation-bribe-amount-value">
                  {claimAllDividends
                    ? claimTipPctLabel
                    : `${claimTipLabel} ${selectedClaimAsset?.symbol ?? ''}`}
                </span>
              </div>
              {isWalletConnected ? (
                <div className="grai-action-submit">
                  <button
                    type="button"
                    className="grai-mint-btn"
                    disabled={
                      isClaiming ||
                      !selectedClaimLocker ||
                      (claimAllDividends
                        ? !lockerHasAnyClaimable
                        : !claimAmount.trim() ||
                          !selectedClaimAsset?.address ||
                          !claimableMaxAmount)
                    }
                    onClick={() => {
                      void handleClaim()
                    }}
                  >
                    {isClaiming ? 'Claiming…' : claimAllDividends ? 'Claim all' : 'Claim'}
                  </button>
                </div>
              ) : (
                <GraiActionConnectWalletButton />
              )}
              <p className="grai-liquidation-buyback-vote-note">
                Claim accrued dividends for a locker. Anyone can claim on a locker&apos;s behalf;
                a tip share goes to the caller, the rest to the locker.
              </p>
            </div>
          </div>
        </div>
      </div>
      ) : null}

      {opsView === 'distribute' ? (
      <div className="grai-liquidation-distribute-screen" id="grai-distribute-section">
        <h3 className="grai-liquidation-distribute-title">Distribute</h3>
        <section className="grai-distribute-money-flow-block" aria-label="Distribute money flow">
          <GraiDistributeMoneyFlow
            amountLabel={distributeAmount.trim() || '0'}
            assetSymbol={selectedDistributeAsset?.symbol}
          />
        </section>
        <div className="grai-liquidation-ops-row">
          <div className="grai-liquidation-yield-block">
            <div className="grai-liquidation-escrow-body">
              <GraiAmountInput
                key={selectedDistributeAsset?.address ?? 'distribute-amount'}
                label="Distribute Amount"
                assets={distributeAssetOptions}
                defaultAsset={selectedDistributeAsset?.symbol}
                value={distributeAmount}
                onValueChange={setDistributeAmount}
                onAssetChange={(asset) => {
                  setDistributeAssetAddress(asset.address)
                  setDistributeAmount('')
                }}
                balanceLabel={isWalletConnected ? distributeWalletBalanceLabel : '—'}
                balanceLoading={isWalletConnected && distributeWalletBalanceLoading}
                balancePrefix="Your balance:"
                maxAmount={isWalletConnected ? distributeWalletMaxAmount : ''}
                decimals={distributeDecimals}
                showPresets
                showVolatility={false}
                usdLabel={distributeUsdLabel}
                usdTrailingLabel="balance:"
              />
              {isWalletConnected ? (
                <div className="grai-action-submit">
                  <button
                    type="button"
                    className="grai-mint-btn"
                    disabled={
                      !distributeAmount.trim() || liquidationBlocked || isDistributing
                    }
                    onClick={() => {
                      void handleDistribute()
                    }}
                  >
                    {isDistributing ? 'Distributing…' : 'Distribute'}
                  </button>
                </div>
              ) : (
                <GraiActionConnectWalletButton />
              )}
              <p className="grai-liquidation-buyback-vote-note">
                Used by <span className="grai-note-accent">Grinder</span> to distribute yield.
                Anyone can distribute listed asset to{' '}
                <span className="grai-note-accent is-claims">claims</span> and{' '}
                <span className="grai-note-accent is-treasury">treasury</span>
              </p>
            </div>
          </div>
        </div>
      </div>
      ) : null}

      {opsView === 'liquidate' ? (
        <div className="grai-liquidation-liquidate-screen" id="grai-liquidation-market">
          <h3 className="grai-liquidation-distribute-title">Liquidate</h3>
          {quorumInfographic}
          <div className="grai-liquidation-ops-row">
            <div className="grai-liquidation-market-aside">
              <div className="grai-liquidation-quorum-slot">{liquidatePanel}</div>
            </div>
          </div>
        </div>
      ) : null}

      {opsView === 'redeem' && redeemAvailable ? (
        <div className="grai-liquidation-redeem-screen" id="grai-redeem-section">
          <h3 className="grai-liquidation-distribute-title">Redeem</h3>
          <div className="grai-liquidation-ops-row">
            <GraiMintBurnPanel
              actionView="burn"
              actionSubtitle={null}
              onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
            />
          </div>
        </div>
      ) : null}

      <div
        className={
          opsView === 'market'
            ? 'grai-liquidation-ops-panel'
            : 'grai-liquidation-ops-panel is-hidden'
        }
        aria-hidden={opsView !== 'market'}
      >
      <GraiLiquidationVoterPicker
        voters={filteredBribeVoters}
        graiDecimals={graiDecimals}
        costByVoter={costByVoter}
        totalVoted={totalVotedForShare}
        settlementSymbol={settlementSymbol}
        settlementDecimals={settlementDecimals}
        bribePremiumBps={bribePremiumBps}
        graiAsset={voteAssetOptions[0]!}
        explorerAccountUrl={explorerAccountUrl}
        isLoading={isLoading && !usingMockVoters}
        disabled={liquidationBlocked || isBribing}
        canBribe={isWalletConnected}
        bribingVoter={bribingVoter}
        onBribe={(voter, amountInput) => {
          void handleBribe(voter, amountInput)
        }}
        onSelectVoter={() => {
          handleMarketViewChange('bribe')
          setBribeVotersOpen(false)
        }}
        onSeeAllVoters={() => {
          handleMarketViewChange('bribe')
          setBribeVotersOpen(true)
        }}
        listLayout={votersListLayout}
      >
        {({ carousel, amount, empty }) => {
          const bribeVotersToolbar = (
            <div
              className="grai-liquidation-bribe-toolbar is-inline"
              aria-hidden={false}
            >
              <button
                type="button"
                className="grai-liquidation-bribe-back"
                onClick={() => setBribeVotersOpen(false)}
              >
                ← Chart
              </button>
              <label className="grai-liquidation-bribe-search">
                <span className="visually-hidden">Search voters</span>
                <svg
                  className="grai-liquidation-bribe-search-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  type="search"
                  value={bribeSearch}
                  onChange={(event) => setBribeSearch(event.target.value)}
                  placeholder="Search"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <GraiToolbarSortSelect
                label="Filter voters"
                value={bribeSort}
                options={BRIBE_VOTER_SORT_OPTIONS}
                onChange={setBribeSort}
              />
            </div>
          )

          return (
          <div className="grai-liquidation-market-stack">
            {bribeVotersOpen && marketView === 'bribe' ? (
              <div
                className="grai-liquidation-bribe-voters-picker grai-liquidation-bribe-voters-picker--chart"
                aria-label="All voters"
              >
                <h3 className="grai-bribe-curve-chart-title">Bribe</h3>
                {bribeVotersToolbar}
                {carousel ?? empty}
              </div>
            ) : (
              <GraiBribeCurveChart
                title={marketView === 'vote' ? 'Vote' : 'Bribe'}
                quorumBps={state?.liquidationQuorumBps ?? 6667}
                bribePremiumBps={bribePremiumBps}
                totalVoted={state?.totalVoted ?? 0n}
                totalSupply={state?.totalSupply ?? 0n}
                totalValue={state?.totalValue ?? 0n}
              />
            )}
            <div
              className="grai-liquidation-market-row"
              id="grai-liquidation-market"
            >
            <div className="grai-liquidation-vote-block">
              {marketView === 'vote' ? (
                <section
                  id="grai-vote-section"
                  className="grai-liquidation-panel grai-liquidation-panel--vote"
                >
                    <div
                      className={`grai-liquidation-vote-amount${liquidationBlocked ? ' is-disabled' : ''}`}
                    >
                      <GraiAmountInput
                        label="Vote Amount"
                        assets={voteAssetOptions}
                        defaultAsset="GRAI"
                        value={voteAmount}
                        onValueChange={setVoteAmount}
                        balanceLabel={walletGraiLabel}
                        balanceLoading={isLoading && !state}
                        balancePrefix="Available:"
                        maxAmount={liquidationBlocked ? '' : voteMaxAmount}
                        decimals={graiDecimals}
                        showPresets
                        usdLabel={voteUsdLabel}
                        usdTrailingLabel="balance:"
                      />
                      <div className="grai-liquidation-bribe-amount-row">
                        <span className="grai-liquidation-bribe-amount-label">You vote</span>
                        <span className="grai-liquidation-bribe-amount-value">
                          {voteAmount.trim() || '0'} GRAI
                        </span>
                      </div>
                      <p
                        className={`grai-liquidation-vote-min-receive${voteMightReceiveLabel ? '' : ' is-placeholder'}`}
                        aria-live="polite"
                      >
                        <span className="grai-liquidation-vote-line grai-liquidation-vote-line--split">
                          <GraiFieldInfoButton
                            className="grai-liquidation-vote-line-info"
                            ariaLabel="How might bribe is calculated"
                            hint="Estimated settlement you may receive if bribed out of liquidation voting: vote amount × dynamic bribe ask (book mint price with premium/discount vs half quorum)."
                          />
                          <span className="grai-liquidation-vote-line-label">Might Receive:</span>
                          <span className="grai-liquidation-vote-line-value">
                            {`${voteMightReceiveLabel ?? '—'} ${settlementSymbol}`}
                          </span>
                        </span>
                      </p>
                    </div>
                    {isWalletConnected ? (
                      <div className="grai-action-submit">
                        <button
                          type="button"
                          className="grai-mint-btn"
                          disabled={liquidationBlocked || isVoting || !voteAmount.trim()}
                          onClick={() => {
                            void handleVote()
                          }}
                        >
                          {isVoting ? 'Voting…' : 'Vote'}
                        </button>
                      </div>
                    ) : (
                      <GraiActionConnectWalletButton />
                    )}
                    <p className="grai-liquidation-buyback-vote-note">
                      Commit GRAI toward liquidation quorum. Voted GRAI is locked and can be bought
                      out via bribe, or unlocked later with the usual unlock penalty.
                    </p>
                </section>
              ) : (
                <section
                  id="grai-bribe-section"
                  className="grai-liquidation-panel grai-liquidation-panel--bribe"
                >
                    <div className="grai-liquidation-bribe-body">
                      <div className="grai-liquidation-field">{amount}</div>
                    </div>
                </section>
              )}
            </div>
          </div>
          </div>
          )
        }}
      </GraiLiquidationVoterPicker>
      </div>
      </div>
        </div>
      </div>
      </div>
      </div>
      <HowItWorksModal isOpen={isHowItWorksOpen} onClose={() => setIsHowItWorksOpen(false)} />
    </div>
  )
}
