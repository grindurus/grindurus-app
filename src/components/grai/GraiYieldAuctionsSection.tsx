import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Settings } from 'lucide-react'
import { FALLBACK_GRAI_ASSETS, type GraiAssetIcon } from '../../grai/knownMints'
import { formatVaultBalanceDisplay } from '../../grai/formatVaultBalance'
import { formatTokenBalance, normalizeDecimalInput, parseTokenAmount } from '../../grai/onchain'
import { useActiveWallet } from '../../hooks/useActiveWallet'
import { useWalletContext } from '../../providers/AppWalletProvider'
import { GraiAssetSelect } from './GraiAssetSelect'
import { GraiActionConnectWalletButton } from './GraiWalletAction'

export type YieldAuctionLot = {
  id: string
  asset: string
  symbol: string
  icon: GraiAssetIcon
  decimals: number
  remaining: bigint
  initial: bigint
  maxPayment: bigint
  minPayment: bigint
  startTime: number
  duration: number
  settlementSymbol: string
  settlementDecimals: number
}

/** Mirrors GRAI.sol `dutchPrice`: linear max → min over duration. */
function dutchPrice(maxPayment: bigint, minPayment: bigint, elapsed: number, duration: number): bigint {
  if (duration <= 0 || elapsed >= duration) return minPayment
  return maxPayment - ((maxPayment - minPayment) * BigInt(elapsed)) / BigInt(duration)
}

/** Mirrors GRAI.sol `previewFill` payment for a fill size. */
function previewPayment(lot: YieldAuctionLot, amountOut: bigint, nowSec: number): bigint {
  if (amountOut <= 0n || lot.initial <= 0n) return 0n
  const elapsed = Math.max(0, nowSec - lot.startTime)
  const price = dutchPrice(lot.maxPayment, lot.minPayment, elapsed, lot.duration)
  return (price * amountOut) / lot.initial
}

function buildMockAuctions(nowSec: number): YieldAuctionLot[] {
  const yieldAssets = FALLBACK_GRAI_ASSETS.filter((asset) => !['USDC', 'USDT'].includes(asset.symbol))
  return yieldAssets.map((asset, index) => {
    const decimals = asset.symbol === 'BTC' ? 8 : 18
    const remaining =
      asset.symbol === 'BTC'
        ? 125_000_000n // 1.25 BTC
        : asset.symbol === 'ETH'
          ? 8_500_000_000_000_000_000n
          : 42_000_000_000_000_000_000n
    const maxPayment = BigInt(12_500 + index * 3_400) * 10n ** 6n // USDC 6dp
    return {
      id: `mock-${asset.mint}`,
      asset: asset.mint,
      symbol: asset.symbol,
      icon: asset.icon,
      decimals,
      remaining,
      initial: remaining,
      maxPayment,
      minPayment: 0n,
      startTime: nowSec - index * 45 * 60,
      duration: 6 * 60 * 60,
      settlementSymbol: 'USDC',
      settlementDecimals: 6,
    }
  })
}

function formatDurationLeft(secondsLeft: number): string {
  if (secondsLeft <= 0) return 'Floor'
  const h = Math.floor(secondsLeft / 3600)
  const m = Math.floor((secondsLeft % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${Math.max(1, m)}m`
}

/** Settlement units paid for one whole asset unit (1e`assetDecimals` raw). */
function unitSettlementPrice(payment: bigint, amountRaw: bigint, assetDecimals: number): bigint {
  if (payment <= 0n || amountRaw <= 0n) return 0n
  return (payment * 10n ** BigInt(assetDecimals)) / amountRaw
}

function AuctionCard({
  lot,
  nowSec,
  selected,
}: {
  lot: YieldAuctionLot
  nowSec: number
  selected: boolean
}) {
  const elapsed = Math.max(0, nowSec - lot.startTime)
  const secondsLeft = Math.max(0, lot.duration - elapsed)
  const fullPayment = previewPayment(lot, lot.remaining, nowSec)
  const startPayment = lot.maxPayment
  const discountBps =
    startPayment > 0n ? Number(((startPayment - fullPayment) * 10_000n) / startPayment) : 0
  const progressPct = Math.min(100, Math.max(0, (elapsed / Math.max(1, lot.duration)) * 100))

  const remainingLabel = formatVaultBalanceDisplay(lot.remaining, lot.decimals, 4)
  const startUnitPrice = unitSettlementPrice(startPayment, lot.initial, lot.decimals)
  const fillUnitPrice = unitSettlementPrice(fullPayment, lot.remaining, lot.decimals)
  // Spot ≈ oracle FV per unit (same basis as auction maxPayment / initial).
  const spotUnitPrice = unitSettlementPrice(lot.maxPayment, lot.initial, lot.decimals)
  const startPriceLabel = formatVaultBalanceDisplay(startUnitPrice, lot.settlementDecimals, 2)
  const fillPriceLabel = formatVaultBalanceDisplay(fillUnitPrice, lot.settlementDecimals, 2)
  const spotPriceLabel = formatVaultBalanceDisplay(spotUnitPrice, lot.settlementDecimals, 2)

  return (
    <article
      className={`grai-yield-auction-card${selected ? ' is-selected' : ''}`}
      aria-label={`${lot.symbol} yield auction`}
      aria-pressed={selected}
    >
      <div className="grai-yield-auction-rows">
        <div className="grai-yield-auction-row">
          <span className="grai-yield-auction-row-label">Time left</span>
          <span className="grai-yield-auction-row-value">{formatDurationLeft(secondsLeft)}</span>
        </div>
      </div>

      <div
        className="grai-yield-auction-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPct)}
        aria-label="Dutch auction progress"
      >
        <div className="grai-yield-auction-track-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="grai-yield-auction-rows">
        <div className="grai-yield-auction-row">
          <span className="grai-yield-auction-row-label">Remaining</span>
          <span className="grai-yield-auction-row-value grai-yield-auction-remaining">
            <span>{remainingLabel}</span>
            <span className="grai-yield-auction-asset-icon" aria-hidden="true">
              <img src={lot.icon.src} alt="" width={18} height={18} loading="lazy" decoding="async" />
            </span>
            <span className="grai-yield-auction-asset-symbol">{lot.symbol}</span>
          </span>
        </div>
        <div className="grai-yield-auction-row">
          <span className="grai-yield-auction-row-label">Start price</span>
          <span className="grai-yield-auction-row-value">
            {startPriceLabel} {lot.settlementSymbol}
          </span>
        </div>
        <div className="grai-yield-auction-row">
          <span className="grai-yield-auction-row-label">Fill price</span>
          <span className="grai-yield-auction-row-value">
            <span className="grai-yield-auction-row-value is-accent grai-yield-auction-row-discount">
              (−{(discountBps / 100).toFixed(1)}%)
            </span>
            {fillPriceLabel} {lot.settlementSymbol}
          </span>
        </div>
        <div className="grai-yield-auction-row">
          <span className="grai-yield-auction-row-label">Spot price</span>
          <span className="grai-yield-auction-row-value">
            {spotPriceLabel} {lot.settlementSymbol}
          </span>
        </div>
      </div>
    </article>
  )
}

function AuctionFillPanel({
  lot,
  lots,
  nowSec,
  onSelectLot,
}: {
  lot: YieldAuctionLot
  lots: YieldAuctionLot[]
  nowSec: number
  onSelectLot: (lotId: string) => void
}) {
  const activeWallet = useActiveWallet()
  const { openChainSelector } = useWalletContext()
  const canTransact = activeWallet.isConnected
  const [fillAmount, setFillAmount] = useState('')
  const [slippagePct, setSlippagePct] = useState('0.5')
  const [isSlippageOpen, setIsSlippageOpen] = useState(false)
  const slippageWrapRef = useRef<HTMLDivElement>(null)

  const assetOptions = useMemo(
    () =>
      lots.map((entry) => ({
        icon: entry.icon.src,
        symbol: entry.symbol,
        address: entry.asset,
      })),
    [lots],
  )
  const selectedAsset = assetOptions.find((asset) => asset.symbol === lot.symbol) ?? assetOptions[0]

  const maxFillLabel = formatTokenBalance(lot.remaining, lot.decimals)

  let fillAmountRaw = 0n
  try {
    fillAmountRaw = fillAmount.trim() ? parseTokenAmount(fillAmount, lot.decimals) : 0n
  } catch {
    fillAmountRaw = 0n
  }
  if (fillAmountRaw > lot.remaining) fillAmountRaw = lot.remaining

  const youPay = previewPayment(lot, fillAmountRaw, nowSec)
  const youPayLabel = formatVaultBalanceDisplay(youPay, lot.settlementDecimals, 2)
  const canFill = fillAmountRaw > 0n
  const receiveLabel = canFill
    ? formatVaultBalanceDisplay(fillAmountRaw, lot.decimals, 4)
    : '0'
  const startPayment = lot.maxPayment
  const fullLotPayment = previewPayment(lot, lot.remaining, nowSec)
  const discountBps =
    startPayment > 0n ? Number(((startPayment - fullLotPayment) * 10_000n) / startPayment) : 0
  const discountLabel = `+${(discountBps / 100).toFixed(1)}%`

  useEffect(() => {
    setFillAmount('')
  }, [lot.id])

  useEffect(() => {
    if (!isSlippageOpen) return
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (!slippageWrapRef.current?.contains(target)) {
        setIsSlippageOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [isSlippageOpen])

  const applyFillFraction = (fraction: number) => {
    if (fraction >= 1) {
      setFillAmount(maxFillLabel)
      return
    }
    const amountRaw = (lot.remaining * BigInt(Math.round(fraction * 100))) / 100n
    setFillAmount(formatTokenBalance(amountRaw, lot.decimals))
  }

  if (!canTransact) {
    return (
      <div className="grai-yield-auction-fill grai-yield-auction-fill--section">
        <GraiActionConnectWalletButton onConnect={openChainSelector} />
      </div>
    )
  }

  return (
    <div className="grai-yield-auction-fill grai-yield-auction-fill--section">
      <label className="grai-yield-auction-fill-field">
        <span className="grai-yield-auction-fill-label-row">
          <span className="grai-yield-auction-fill-label">Amount</span>
          <span className="grai-yield-auction-fill-tools">
            <div className="grai-amount-preset-btns" aria-label="Amount presets">
              {([25, 50, 75] as const).map((percent) => (
                <button
                  key={percent}
                  type="button"
                  className="grai-amount-preset-btn"
                  onClick={() => applyFillFraction(percent / 100)}
                >
                  {percent}%
                </button>
              ))}
              <button type="button" className="grai-amount-preset-btn" onClick={() => applyFillFraction(1)}>
                MAX
              </button>
            </div>
            <div className="grai-yield-auction-slippage" ref={slippageWrapRef}>
              <button
                type="button"
                className={`grai-yield-auction-slippage-btn${isSlippageOpen ? ' is-open' : ''}`}
                aria-label="Set slippage"
                aria-expanded={isSlippageOpen}
                aria-haspopup="dialog"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setIsSlippageOpen((open) => !open)
                }}
              >
                <Settings size={14} strokeWidth={2.2} aria-hidden="true" />
              </button>
              {isSlippageOpen ? (
                <div
                  className="grai-yield-auction-slippage-popover"
                  role="dialog"
                  aria-label="Slippage settings"
                  onClick={(event) => event.stopPropagation()}
                >
                  <span className="grai-yield-auction-slippage-title">Slippage</span>
                  <span className="grai-yield-auction-slippage-input-wrap">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="grai-yield-auction-slippage-input"
                      value={slippagePct}
                      onChange={(event) => setSlippagePct(normalizeDecimalInput(event.target.value, 2))}
                      aria-label="Slippage percent"
                      autoFocus
                    />
                    <span className="grai-yield-auction-slippage-suffix">%</span>
                  </span>
                  <div className="grai-amount-preset-btns" aria-label="Slippage presets">
                    {(['0.1', '0.5', '1.0'] as const).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`grai-amount-preset-btn${slippagePct === preset ? ' is-active' : ''}`}
                        onClick={() => setSlippagePct(preset)}
                      >
                        {preset}%
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </span>
        </span>
        <span className="grai-yield-auction-fill-input-wrap">
          <input
            type="text"
            inputMode="decimal"
            className="grai-yield-auction-fill-input"
            placeholder="0.00"
            value={fillAmount}
            onChange={(event) => setFillAmount(normalizeDecimalInput(event.target.value, lot.decimals))}
            aria-label={`Fill amount in ${lot.symbol}`}
          />
          <GraiAssetSelect
            assets={assetOptions}
            selected={selectedAsset}
            ariaLabel="Select auction asset"
            onSelect={(asset) => {
              const next = lots.find((entry) => entry.symbol === asset.symbol || entry.asset === asset.address)
              if (next) onSelectLot(next.id)
            }}
          />
        </span>
      </label>
      <div className="grai-yield-auction-fill-results">
        <div className="grai-yield-auction-fill-pay" aria-live="polite">
          <span className="grai-yield-auction-fill-pay-label">You pay:</span>
          <span className={`grai-yield-auction-fill-pay-value${canFill ? '' : ' is-placeholder'}`}>
            {canFill ? `${youPayLabel} ${lot.settlementSymbol}` : `0 ${lot.settlementSymbol}`}
          </span>
        </div>
        <div className="grai-yield-auction-fill-pay" aria-live="polite">
          <span className="grai-yield-auction-fill-pay-label">You receive:</span>
          <span className={`grai-yield-auction-fill-pay-value${canFill ? '' : ' is-placeholder'}`}>
            <span className="grai-yield-auction-fill-receive-discount is-accent">{discountLabel}</span>
            <span className="grai-yield-auction-fill-receive-main">
              {receiveLabel}
              <span className="grai-yield-auction-asset-icon" aria-hidden="true">
                <img src={lot.icon.src} alt="" width={18} height={18} loading="lazy" decoding="async" />
              </span>
              {lot.symbol}
            </span>
          </span>
        </div>
      </div>
      <button type="button" className="grai-mint-btn grai-yield-auction-fill-btn" disabled={!canFill}>
        Buy
      </button>
    </div>
  )
}

const DESKTOP_VISIBLE = 1

export function GraiYieldAuctionsSection() {
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000))
  const [isCompact, setIsCompact] = useState(false)
  const [activeIndexes, setActiveIndexes] = useState<Set<number>>(() => new Set([0, 1]))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const auctions = useMemo(() => buildMockAuctions(Math.floor(Date.now() / 1000)), [])

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const updateCompact = () => {
      setIsCompact(window.innerWidth <= 640)
    }
    updateCompact()
    window.addEventListener('resize', updateCompact)
    return () => window.removeEventListener('resize', updateCompact)
  }, [])

  useEffect(() => {
    if (!auctions.length) {
      setSelectedId(null)
      return
    }
    setSelectedId((current) => {
      if (current && auctions.some((lot) => lot.id === current)) return current
      return auctions[0]!.id
    })
  }, [auctions])

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
  }, [auctions.length, isCompact, updateActiveFromScroll])

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
  }, [])

  const scrollToIndex = (index: number) => {
    const scroller = scrollerRef.current
    const item = itemRefs.current[index]
    if (!scroller || !item) return

    const visibleCount = isCompact ? 1 : DESKTOP_VISIBLE
    const leadIndex = Math.max(0, Math.min(index, Math.max(0, auctions.length - visibleCount)))
    const lead = itemRefs.current[leadIndex] ?? item
    const scrollerRect = scroller.getBoundingClientRect()
    const leadRect = lead.getBoundingClientRect()
    const nextLeft = scroller.scrollLeft + (leadRect.left - scrollerRect.left)
    scroller.scrollTo({ left: Math.max(0, nextLeft), behavior: 'smooth' })
  }

  const selectedLot = auctions.find((lot) => lot.id === selectedId) ?? auctions[0] ?? null

  return (
    <section
      className={`grai-yield-auctions${isCompact ? ' is-compact' : ''}`}
      id="grai-auctions-section"
      aria-label="Yields Dutch Auctions"
    >
      <header className="grai-yield-auctions-header">
        <h3 className="grai-yield-auctions-title">
          Buy Generated Yields with Discount{' '}
          <span className="grai-yield-auctions-title-break">for GRAI buybacks</span>
        </h3>
      </header>
      <div className="grai-yield-auctions-carousel">
        <div className="grai-yield-auctions-viewport" ref={scrollerRef} tabIndex={0}>
          <div className="grai-yield-auctions-track" role="list">
            {auctions.map((lot, index) => {
              const isActive = activeIndexes.has(index)
              const isSelected = selectedLot?.id === lot.id
              return (
                <div
                  key={lot.id}
                  ref={(node) => {
                    itemRefs.current[index] = node
                  }}
                  className={`grai-yield-auctions-item${isActive ? '' : ' is-peek'}${isSelected ? ' is-selected' : ''}`}
                  role="listitem"
                >
                  <button
                    type="button"
                    className="grai-yield-auctions-item-select"
                    aria-pressed={isSelected}
                    aria-label={`Select ${lot.symbol} auction`}
                    onClick={() => {
                      setSelectedId(lot.id)
                      if (!isActive) scrollToIndex(index)
                    }}
                  >
                    <AuctionCard lot={lot} nowSec={nowSec} selected={isSelected} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
        {auctions.length > 0 ? (
          <div className="grai-yield-auctions-dots" role="tablist" aria-label="Auction position">
            {auctions.map((lot, index) => {
              const isActive = activeIndexes.has(index)
              const isSelected = selectedLot?.id === lot.id
              return (
                <button
                  key={lot.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-label={`${lot.symbol} auction${isSelected ? ', selected' : isActive ? ', in view' : ''}`}
                  className={`grai-yield-auctions-dot${isSelected ? ' is-active' : ''}`}
                  onClick={() => {
                    setSelectedId(lot.id)
                    scrollToIndex(index)
                  }}
                />
              )
            })}
          </div>
        ) : null}
      </div>
      {selectedLot ? (
        <AuctionFillPanel
          lot={selectedLot}
          lots={auctions}
          nowSec={nowSec}
          onSelectLot={(lotId) => {
            setSelectedId(lotId)
            const index = auctions.findIndex((entry) => entry.id === lotId)
            if (index >= 0) scrollToIndex(index)
          }}
        />
      ) : null}
    </section>
  )
}
