import { useCallback, useId, useMemo, useRef, useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'

const BPS = 10_000
const SAMPLE_COUNT = 200
/** Index book used for Solidity-identical integer path, then scaled to mint price. */
const BOOK_INDEX = 100
const CHART_MARGIN = { top: 22, right: 16, left: 4, bottom: 4 }
const Y_AXIS_WIDTH = 58

type ChartPoint = {
  voteShare: number
  ask: number
  book: number
  premiumBand: number | null
  discountBand: number | null
}

type HoverPoint = {
  voteShare: number
  ask: number
}

type Props = {
  quorumBps: number
  bribePremiumBps: number
  totalVoted: bigint
  totalSupply: bigint
  totalValue: bigint
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** Mirrors GRAI.sol `previewBribe` ask math for a fixed book index (docs chart). */
function bribeAskIndexAtVoteBps(
  voteBps: number,
  quorumBps: number,
  bribePremiumBps: number,
): { askIndex: number; premiumIndex: number; discountIndex: number } {
  const halfBps = Math.floor(quorumBps / 2)
  const span = halfBps > 0 ? halfBps : 1
  const maxAdj = Math.max(0, bribePremiumBps)
  const vote = Math.max(0, Math.floor(voteBps))
  const book = BOOK_INDEX

  if (vote < halfBps) {
    const adj = Math.floor((maxAdj * (halfBps - vote)) / span)
    const askIndex = (book * (BPS + adj)) / BPS
    return { askIndex, premiumIndex: askIndex - book, discountIndex: 0 }
  }

  const adj = Math.floor((maxAdj * (vote - halfBps)) / span)
  const fullAsk = adj >= BPS ? 0 : (book * (BPS - adj)) / BPS
  const discountIndex = (book - fullAsk) / 2
  return { askIndex: book - discountIndex, premiumIndex: 0, discountIndex }
}

function resolveMintPrice(totalValue: bigint, totalSupply: bigint): number {
  if (totalSupply <= 0n) return 1
  const price = Number(totalValue) / Number(totalSupply)
  if (!Number.isFinite(price) || price <= 0) return 1
  return price
}

function indexToPrice(askIndex: number, mintPrice: number): number {
  return (askIndex / BOOK_INDEX) * mintPrice
}

function askAtVoteShare(
  voteShare: number,
  quorumBps: number,
  bribePremiumBps: number,
  mintPrice: number,
): number {
  const voteBps = Math.floor(clamp(voteShare, 0, 1) * BPS)
  const { askIndex } = bribeAskIndexAtVoteBps(voteBps, quorumBps, bribePremiumBps)
  return indexToPrice(askIndex, mintPrice)
}

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1000) {
    return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
  }
  if (abs >= 1) return `$${value.toFixed(2)}`
  return `$${value.toFixed(4)}`
}

function formatVotePct(share: number): string {
  if (!Number.isFinite(share)) return '—'
  return `${(share * 100).toFixed(share > 0 && share < 0.1 ? 2 : 1)}%`
}

function voteShareFromPointer(clientX: number, plotEl: HTMLElement): number | null {
  const rect = plotEl.getBoundingClientRect()
  if (rect.width <= 0) return null
  const plotLeft = CHART_MARGIN.left + Y_AXIS_WIDTH
  const plotRight = rect.width - CHART_MARGIN.right
  const plotWidth = plotRight - plotLeft
  if (plotWidth <= 0) return null
  return clamp((clientX - rect.left - plotLeft) / plotWidth, 0, 1)
}

export function GraiBribeCurveChart({
  quorumBps,
  bribePremiumBps,
  totalVoted,
  totalSupply,
  totalValue,
}: Props) {
  const gradientId = useId().replace(/:/g, '')
  const plotRef = useRef<HTMLDivElement>(null)
  const halfBps = Math.floor(quorumBps / 2)
  const halfShare = halfBps / BPS
  const quorumShare = quorumBps / BPS
  const mintPrice = resolveMintPrice(totalValue, totalSupply)
  const [hoverPoint, setHoverPoint] = useState<HoverPoint | null>(null)

  const voteShareNow =
    totalSupply > 0n ? Number((totalVoted * 1_000_000n) / totalSupply) / 1_000_000 : 0
  const voteBpsNow =
    totalSupply > 0n ? Number((totalVoted * BigInt(BPS)) / totalSupply) : 0
  const nowIndex = bribeAskIndexAtVoteBps(voteBpsNow, quorumBps, bribePremiumBps)
  const nowAsk = indexToPrice(nowIndex.askIndex, mintPrice)
  const regime =
    nowIndex.premiumIndex > 0 ? 'Premium' : nowIndex.discountIndex > 0 ? 'Discount' : 'Par'

  const updateHoverFromClientX = useCallback(
    (clientX: number) => {
      const plotEl = plotRef.current
      if (!plotEl) return
      const voteShare = voteShareFromPointer(clientX, plotEl)
      if (voteShare == null) {
        setHoverPoint(null)
        return
      }
      setHoverPoint({
        voteShare,
        ask: askAtVoteShare(voteShare, quorumBps, bribePremiumBps, mintPrice),
      })
    },
    [bribePremiumBps, mintPrice, quorumBps],
  )

  const { points, yDomain, yTicks, nowPoint } = useMemo(() => {
    const next: ChartPoint[] = []
    for (let i = 0; i <= SAMPLE_COUNT; i += 1) {
      const voteShare = i / SAMPLE_COUNT
      const ask = askAtVoteShare(voteShare, quorumBps, bribePremiumBps, mintPrice)
      next.push({
        voteShare,
        ask,
        book: mintPrice,
        premiumBand: ask >= mintPrice ? ask : null,
        discountBand: ask <= mintPrice ? ask : null,
      })
    }
    const asks = next.map((p) => p.ask)
    const minAsk = Math.min(...asks, mintPrice)
    const maxAsk = Math.max(...asks, mintPrice)
    const span = Math.max(maxAsk - minAsk, mintPrice * 0.002, 0.01)
    // Tight pad so premium/discount swing fills most of the plot (steeper visual slope).
    const pad = span * 0.06
    // Always label max premium, deposit, and max-discount (min ask) levels.
    const tickSet = [maxAsk, mintPrice, minAsk]
    if (maxAsk - mintPrice > span * 0.2) tickSet.push((maxAsk + mintPrice) / 2)
    if (mintPrice - minAsk > span * 0.2) tickSet.push((mintPrice + minAsk) / 2)
    const ticks = [...new Set(tickSet.map((v) => Number(v.toPrecision(6))))].sort((a, b) => b - a)
    return {
      points: next,
      yDomain: [Math.max(0, minAsk - pad), maxAsk + pad] as [number, number],
      yTicks: ticks,
      nowPoint: {
        voteShare: clamp(voteShareNow, 0, 1),
        ask: nowAsk,
      },
    }
  }, [bribePremiumBps, mintPrice, nowAsk, quorumBps, voteShareNow])

  const scrubPoint = hoverPoint
  const scrubDelta = scrubPoint ? scrubPoint.ask - mintPrice : 0
  const scrubDeltaLabel = scrubPoint
    ? scrubDelta > mintPrice * 0.00005
      ? `+${formatPrice(scrubDelta)} premium`
      : scrubDelta < -mintPrice * 0.00005
        ? `−${formatPrice(Math.abs(scrubDelta))} discount`
        : 'at deposit price'
    : ''

  return (
    <section
      className="grai-bribe-curve-chart"
      aria-label="Bribe ask versus voted share of supply"
    >
      <h3 className="grai-bribe-curve-chart-title">Vote and Bribe</h3>
      <header className="grai-bribe-curve-chart-head">
        <div className="grai-bribe-curve-chart-meta">
          <span className="grai-bribe-curve-chart-meta-col">
            <span className="grai-bribe-curve-chart-meta-label">Total voted</span>
            <span className="grai-bribe-curve-chart-meta-value">{formatVotePct(voteShareNow)}</span>
          </span>
          <span className="grai-bribe-curve-chart-meta-col">
            <span className="grai-bribe-curve-chart-meta-label">Current bribe price</span>
            <span className="grai-bribe-curve-chart-meta-value">{formatPrice(nowAsk)}</span>
          </span>
          <span className="grai-bribe-curve-chart-meta-col is-end">
            <span className="grai-bribe-curve-chart-meta-label">Regime</span>
            <span
              className={`grai-bribe-curve-chart-meta-value is-regime is-${regime.toLowerCase()}`}
            >
              {regime}
            </span>
          </span>
          <span className="grai-bribe-curve-chart-meta-col is-end">
            <span className="grai-bribe-curve-chart-meta-label">Deposit price</span>
            <span className="grai-bribe-curve-chart-meta-value">{formatPrice(mintPrice)}</span>
          </span>
        </div>
      </header>

      <div
        ref={plotRef}
        className="grai-bribe-curve-chart-plot"
        onPointerMove={(event) => {
          updateHoverFromClientX(event.clientX)
        }}
        onPointerLeave={() => setHoverPoint(null)}
        onPointerCancel={() => setHoverPoint(null)}
      >
        {hoverPoint ? (
          <div className="grai-bribe-curve-chart-tooltip is-follow" aria-live="polite">
            <span>{formatVotePct(hoverPoint.voteShare)} voted</span>
            <strong>{formatPrice(hoverPoint.ask)}</strong>
            <span>{scrubDeltaLabel}</span>
          </div>
        ) : null}
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={CHART_MARGIN}>
            <defs>
              <linearGradient id={`grai-bribe-premium-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e85d5d" stopOpacity={0.85} />
                <stop offset="55%" stopColor="#e85d5d" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#e85d5d" stopOpacity={0.22} />
              </linearGradient>
              <linearGradient id={`grai-bribe-discount-${gradientId}`} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#3dbf7a" stopOpacity={0.85} />
                <stop offset="55%" stopColor="#3dbf7a" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#3dbf7a" stopOpacity={0.22} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="color-mix(in srgb, var(--border-color) 70%, transparent)"
              strokeDasharray="3 6"
              vertical={false}
            />
            <XAxis
              dataKey="voteShare"
              type="number"
              domain={[0, 1]}
              ticks={[0, halfShare, quorumShare, 1].filter((v, i, arr) => arr.indexOf(v) === i)}
              interval={0}
              height={36}
              tick={(props) => {
                const { x, y, payload } = props as {
                  x?: number
                  y?: number
                  payload?: { value?: number }
                }
                if (x == null || y == null) return null
                const value = Number(payload?.value)
                if (!Number.isFinite(value)) return null

                const renderTick = (
                  primary: string,
                  secondary?: string,
                  anchor: 'start' | 'middle' | 'end' = 'middle',
                ) => (
                  <g transform={`translate(${x},${y})`}>
                    {secondary ? (
                      <text
                        x={0}
                        y={10}
                        fill="var(--text-primary)"
                        fontSize={10}
                        textAnchor={anchor}
                      >
                        {secondary}
                      </text>
                    ) : null}
                    <text
                      x={0}
                      y={secondary ? 24 : 12}
                      fill="var(--text-primary)"
                      fontSize={11}
                      textAnchor={anchor}
                    >
                      {primary}
                    </text>
                  </g>
                )

                if (Math.abs(value - halfShare) < 0.001) {
                  return renderTick('½ quorum', formatVotePct(halfShare))
                }
                if (Math.abs(value - quorumShare) < 0.001) {
                  return renderTick('quorum', formatVotePct(quorumShare))
                }
                if (value <= 0) return renderTick('0%', undefined, 'start')
                if (value >= 1) return renderTick('100%', undefined, 'end')
                return null
              }}
              axisLine={{ stroke: 'var(--border-color)' }}
              tickLine={false}
            />
            <YAxis
              domain={yDomain}
              ticks={yTicks}
              width={58}
              tickFormatter={(value: number) => formatPrice(value)}
              tick={{ fill: 'var(--text-primary)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Area
              type="linear"
              dataKey="premiumBand"
              stroke="none"
              fill={`url(#grai-bribe-premium-${gradientId})`}
              fillOpacity={1}
              baseValue={mintPrice}
              connectNulls={false}
              isAnimationActive={false}
              legendType="none"
              activeDot={false}
            />
            <Area
              type="linear"
              dataKey="discountBand"
              stroke="none"
              fill={`url(#grai-bribe-discount-${gradientId})`}
              fillOpacity={1}
              baseValue={mintPrice}
              connectNulls={false}
              isAnimationActive={false}
              legendType="none"
              activeDot={false}
            />
            <ReferenceLine
              y={mintPrice}
              stroke="#ff69b4"
              strokeDasharray="5 5"
              strokeOpacity={0.9}
              label={(props) => {
                const viewBox = props.viewBox as { x?: number; y?: number; width?: number } | undefined
                if (viewBox?.x == null || viewBox.y == null || viewBox.width == null) return null
                return (
                  <text
                    x={viewBox.x + viewBox.width - 2}
                    y={viewBox.y - 6}
                    fill="#ff69b4"
                    fontSize={11}
                    textAnchor="end"
                  >
                    deposit price
                  </text>
                )
              }}
            />
            <ReferenceLine
              x={halfShare}
              stroke="#ff69b4"
              strokeDasharray="3 4"
              strokeOpacity={0.85}
            />
            <ReferenceLine
              x={quorumShare}
              stroke="#ff69b4"
              strokeDasharray="3 4"
              strokeOpacity={0.85}
            />
            <Line
              type="linear"
              dataKey="ask"
              stroke="#ff69b4"
              strokeWidth={2.25}
              dot={false}
              isAnimationActive={false}
              activeDot={false}
            />
            <ReferenceLine
              x={nowPoint.voteShare}
              stroke="#ff69b4"
              strokeDasharray="4 4"
              strokeOpacity={0.75}
            />
            <ReferenceDot
              x={nowPoint.voteShare}
              y={nowPoint.ask}
              r={5}
              fill="#ff69b4"
              stroke="var(--bg-primary, #100c10)"
              strokeWidth={2}
            />
            {scrubPoint ? (
              <>
                <ReferenceLine
                  x={scrubPoint.voteShare}
                  stroke="#ff69b4"
                  strokeDasharray="2 3"
                  strokeOpacity={0.95}
                />
                <ReferenceDot
                  x={scrubPoint.voteShare}
                  y={scrubPoint.ask}
                  r={5}
                  fill="#ff69b4"
                  stroke="#fff"
                  strokeWidth={2}
                />
              </>
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="grai-bribe-curve-chart-legend" aria-hidden="true">
        <span className="grai-bribe-curve-chart-legend-item is-ask">bribe price</span>
        <span className="grai-bribe-curve-chart-legend-item is-premium">
          premium area (better vote GRAI)
        </span>
        <span className="grai-bribe-curve-chart-legend-item is-discount">
          discount area (better bribe GRAI)
        </span>
      </div>
    </section>
  )
}
