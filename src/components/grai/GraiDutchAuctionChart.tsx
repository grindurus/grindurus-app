import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { formatVaultBalanceDisplay } from '../../grai/formatVaultBalance'

const SAMPLE_COUNT = 120
/** Hide the "now" axis stamp when it's within this fraction of start/end. */
const X_TICK_MIN_GAP = 0.12
/** Day marks only hide when nearly on top of an edge / now stamp. */
const DAY_TICK_EDGE_GAP = 0.02
const DAY_TICK_NOW_GAP = 0.035
const CHART_MARGIN = { top: 22, right: 8, left: 0, bottom: 40 }
const Y_AXIS_WIDTH = 44

type ChartPoint = {
  progress: number
  ask: number
  label: string
}

type HoverPoint = {
  progress: number
  ask: number
}

type Props = {
  symbol: string
  icon?: string
  available?: bigint
  maxPaymentGrai: bigint
  minPaymentGrai: bigint
  startTime: number
  period: number
  nowSec: number
  graiDecimals?: number
  discountLabel?: string
  remainingLabel?: string
  /** Replaces the default title column (e.g. asset carousel). */
  leading?: ReactNode
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function toGraiNumber(raw: bigint, decimals: number): number {
  const scale = 10 ** Math.min(decimals, 8)
  const truncated = raw / 10n ** BigInt(Math.max(0, decimals - 8))
  return Number(truncated) / scale
}

function dutchAskAt(
  maxPayment: bigint,
  minPayment: bigint,
  elapsedSec: number,
  periodSec: number,
): bigint {
  if (periodSec <= 0 || elapsedSec >= periodSec) return minPayment
  if (elapsedSec <= 0) return maxPayment
  return maxPayment - ((maxPayment - minPayment) * BigInt(elapsedSec)) / BigInt(periodSec)
}

function askAtProgress(
  progress: number,
  maxPaymentGrai: bigint,
  minPaymentGrai: bigint,
  period: number,
  graiDecimals: number,
  hasLot: boolean,
): number {
  if (!hasLot) return 0
  const elapsed = Math.max(0, Math.min(period, Math.round(period * clamp(progress, 0, 1))))
  return toGraiNumber(dutchAskAt(maxPaymentGrai, minPaymentGrai, elapsed, period), graiDecimals)
}

function askRawAtProgress(
  progress: number,
  maxPaymentGrai: bigint,
  minPaymentGrai: bigint,
  period: number,
): bigint {
  const elapsed = Math.max(0, Math.min(period, Math.round(period * clamp(progress, 0, 1))))
  return dutchAskAt(maxPaymentGrai, minPaymentGrai, elapsed, period)
}

function discountPctAtAsk(maxPayment: bigint, ask: bigint): number {
  if (maxPayment <= 0n || ask >= maxPayment) return 0
  const bps = Number(((maxPayment - ask) * 10_000n) / maxPayment)
  return Math.round(bps) / 100
}

function formatDiscountPct(pct: number): string {
  if (pct <= 0) return '0%'
  return `−${pct.toFixed(pct >= 10 || Number.isInteger(pct) ? 0 : 1)}%`
}

function progressFromPointer(clientX: number, plotEl: HTMLElement): number | null {
  const rect = plotEl.getBoundingClientRect()
  if (rect.width <= 0) return null
  const plotLeft = CHART_MARGIN.left + Y_AXIS_WIDTH
  const plotRight = rect.width - CHART_MARGIN.right
  const plotWidth = plotRight - plotLeft
  if (plotWidth <= 0) return null
  return clamp((clientX - rect.left - plotLeft) / plotWidth, 0, 1)
}

function formatAxisAsk(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value >= 1000) {
    return value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })
  }
  if (value >= 10) return value.toFixed(1)
  return value.toFixed(2)
}

function formatAuctionClock(unixSec: number): string {
  if (!Number.isFinite(unixSec) || unixSec <= 0) return '—'
  return new Date(unixSec * 1000).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatAuctionDate(unixSec: number): string {
  if (!Number.isFinite(unixSec) || unixSec <= 0) return '—'
  return new Date(unixSec * 1000).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  })
}

/** Local-midnight progress marks between auction start and end (every calendar day). */
function buildDayBoundaryMarks(
  startUnix: number,
  periodSec: number,
): Array<{ progress: number; unix: number }> {
  if (!(startUnix > 0) || !(periodSec > 0)) return []
  const endUnix = startUnix + periodSec
  const startDate = new Date(startUnix * 1000)
  const cursor = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate() + 1,
    0,
    0,
    0,
    0,
  )
  const marks: Array<{ progress: number; unix: number }> = []
  while (cursor.getTime() / 1000 < endUnix - 1) {
    const unix = Math.floor(cursor.getTime() / 1000)
    const progress = (unix - startUnix) / periodSec
    if (progress > DAY_TICK_EDGE_GAP && progress < 1 - DAY_TICK_EDGE_GAP) {
      marks.push({ progress, unix })
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return marks
}

function buildEvenTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0]
  if (count <= 1) return [max]
  if (Math.abs(max - min) < 1e-12) return [max]
  return Array.from({ length: count }, (_, i) => max - ((max - min) * i) / (count - 1))
}

function formatChartAskUsd(raw: bigint, decimals: number): string {
  const normalized = formatVaultBalanceDisplay(raw, decimals, 6)
  if (!normalized.includes('.')) return `$${normalized}.000000`
  const [wholePart, fractionPart = ''] = normalized.split('.')
  return `$${wholePart}.${fractionPart.padEnd(6, '0').slice(0, 6)}`
}

export function GraiDutchAuctionChart({
  symbol,
  icon,
  available = 0n,
  maxPaymentGrai,
  minPaymentGrai,
  startTime,
  period,
  nowSec,
  graiDecimals = 18,
  discountLabel,
  remainingLabel,
  leading,
}: Props) {
  const hasLot = available > 0n
  const chartIdentity = `${symbol}:${hasLot ? 'lot' : 'empty'}`
  const plotRef = useRef<HTMLDivElement>(null)
  const [curveAnimating, setCurveAnimating] = useState(true)
  const [plotEnter, setPlotEnter] = useState(true)
  const [hoverPoint, setHoverPoint] = useState<HoverPoint | null>(null)

  useEffect(() => {
    setCurveAnimating(true)
    setPlotEnter(false)
    setHoverPoint(null)
    const raf = window.requestAnimationFrame(() => setPlotEnter(true))
    const done = window.setTimeout(() => setCurveAnimating(false), 520)
    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(done)
    }
  }, [chartIdentity])

  const elapsedSec = Math.max(0, nowSec - startTime)
  const progressNow =
    period > 0 ? Math.min(1, Math.max(0, elapsedSec / period)) : 1
  const currentAsk = dutchAskAt(maxPaymentGrai, minPaymentGrai, elapsedSec, period)

  const updateHoverFromClientX = useCallback(
    (clientX: number) => {
      const plotEl = plotRef.current
      if (!plotEl) return
      const progress = progressFromPointer(clientX, plotEl)
      if (progress == null) {
        setHoverPoint(null)
        return
      }
      setHoverPoint({
        progress,
        ask: askAtProgress(
          progress,
          maxPaymentGrai,
          minPaymentGrai,
          period,
          graiDecimals,
          hasLot,
        ),
      })
    },
    [graiDecimals, hasLot, maxPaymentGrai, minPaymentGrai, period],
  )

  const { points, nowPoint, yDomain, yTicks } = useMemo(() => {
    if (!hasLot) {
      const nextPoints: ChartPoint[] = []
      for (let i = 0; i <= SAMPLE_COUNT; i += 1) {
        const progress = i / SAMPLE_COUNT
        nextPoints.push({
          progress,
          ask: 0,
          label: progress === 0 ? 'Start' : progress === 1 ? 'Floor' : '',
        })
      }
      return {
        points: nextPoints,
        nowPoint: { progress: progressNow, ask: 0 },
        yDomain: [0, 1] as [number, number],
        yTicks: [0],
      }
    }
    const maxN = toGraiNumber(maxPaymentGrai, graiDecimals)
    const minN = toGraiNumber(minPaymentGrai, graiDecimals)
    const nextPoints: ChartPoint[] = []
    for (let i = 0; i <= SAMPLE_COUNT; i += 1) {
      const progress = i / SAMPLE_COUNT
      const elapsed = Math.round(period * progress)
      const askRaw = dutchAskAt(maxPaymentGrai, minPaymentGrai, elapsed, period)
      const ask = toGraiNumber(askRaw, graiDecimals)
      nextPoints.push({
        progress,
        ask,
        label: progress === 0 ? 'Start' : progress === 1 ? 'Floor' : '',
      })
    }
    const nowAsk = toGraiNumber(currentAsk, graiDecimals)
    const span = Math.max(maxN - minN, maxN * 0.002, 0.01)
    // Tight pad so the dutch drop fills most of the plot height (steeper visual slope).
    const pad = span * 0.06
    const domain: [number, number] = [Math.max(0, minN - pad), maxN + pad]
    return {
      points: nextPoints,
      nowPoint: { progress: progressNow, ask: nowAsk },
      yDomain: domain,
      yTicks: buildEvenTicks(domain[0], domain[1], 4),
    }
  }, [
    currentAsk,
    graiDecimals,
    hasLot,
    maxPaymentGrai,
    minPaymentGrai,
    period,
    progressNow,
  ])

  const currentAskLabel = hasLot ? formatChartAskUsd(currentAsk, graiDecimals) : '$0.00'
  const maxLabel = hasLot ? formatChartAskUsd(maxPaymentGrai, graiDecimals) : '$0.00'
  const minLabel = hasLot ? formatChartAskUsd(minPaymentGrai, graiDecimals) : '$0.00'
  const endTime = startTime > 0 && period > 0 ? startTime + period : 0
  const startDate = formatAuctionDate(startTime)
  const endDate = formatAuctionDate(endTime)
  const nowDate = formatAuctionDate(nowSec)
  const startClock = formatAuctionClock(startTime)
  const endClock = formatAuctionClock(endTime)
  const nowClock = formatAuctionClock(nowSec)
  const nowNearStart = progressNow <= X_TICK_MIN_GAP
  const nowNearEnd = progressNow >= 1 - X_TICK_MIN_GAP
  const showNowTick = !nowNearStart && !nowNearEnd
  const dayMarks = useMemo(
    () => buildDayBoundaryMarks(startTime, period),
    [period, startTime],
  )
  const xTicks = useMemo(() => {
    const ticks = [0]
    for (const mark of dayMarks) {
      if (showNowTick && Math.abs(mark.progress - progressNow) < DAY_TICK_NOW_GAP) continue
      ticks.push(mark.progress)
    }
    if (showNowTick) ticks.push(progressNow)
    ticks.push(1)
    return ticks
  }, [dayMarks, progressNow, showNowTick])
  const startCaption = nowNearStart ? 'start · now' : 'start time'
  const endCaption = nowNearEnd ? 'end · now' : 'end time'
  const scrubPoint = hoverPoint
  const scrubUnix =
    scrubPoint && startTime > 0 && period > 0
      ? Math.round(startTime + scrubPoint.progress * period)
      : null
  const scrubTimeLabel =
    scrubUnix != null ? `${formatAuctionDate(scrubUnix)} ${formatAuctionClock(scrubUnix)}` : null
  const scrubElapsedLabel = scrubPoint
    ? scrubPoint.progress <= 0
      ? 'Start'
      : scrubPoint.progress >= 1
        ? 'Floor'
        : `${(scrubPoint.progress * 100).toFixed(scrubPoint.progress < 0.1 ? 2 : 1)}% elapsed`
    : ''
  const scrubDiscountLabel =
    scrubPoint && hasLot
      ? formatDiscountPct(
          discountPctAtAsk(
            maxPaymentGrai,
            askRawAtProgress(scrubPoint.progress, maxPaymentGrai, minPaymentGrai, period),
          ),
        )
      : null

  return (
    <section
      className="grai-dutch-auction-chart"
      aria-label={`${symbol} dutch auction price curve`}
    >
      <h3 className="grai-dutch-auction-chart-title">GRAI Buyback Dutch Auction</h3>
      <header className="grai-dutch-auction-chart-head">
        <div className="grai-dutch-auction-chart-title-wrap">
          {leading ?? (
            <div className="grai-dutch-auction-chart-title-col">
              <p className="grai-dutch-auction-chart-subtitle">
                {icon ? (
                  <img
                    className="grai-dutch-auction-chart-icon"
                    src={icon}
                    alt=""
                    width={22}
                    height={22}
                    loading="lazy"
                    decoding="async"
                  />
                ) : null}
                <span className="grai-dutch-auction-chart-ticker">{symbol}</span>
              </p>
            </div>
          )}
        </div>
        <div className="grai-dutch-auction-chart-meta" key={chartIdentity}>
          <span className="grai-dutch-auction-chart-meta-col">
            <span className="grai-dutch-auction-chart-meta-label">Left</span>
            <span className="grai-dutch-auction-chart-meta-value">
              {hasLot ? (remainingLabel ?? '—') : '—'}
            </span>
          </span>
          <span className="grai-dutch-auction-chart-meta-col">
            <span className="grai-dutch-auction-chart-meta-label">Buyback price</span>
            <span className="grai-dutch-auction-chart-meta-value">{currentAskLabel}</span>
          </span>
          <span className="grai-dutch-auction-chart-meta-col is-end">
            <span className="grai-dutch-auction-chart-meta-label">Discount</span>
            <span className="grai-dutch-auction-chart-meta-value is-discount">
              {hasLot ? (discountLabel ?? '—') : '0%'}
            </span>
          </span>
          <span className="grai-dutch-auction-chart-meta-col is-end">
            <span className="grai-dutch-auction-chart-meta-label">Start price</span>
            <span className="grai-dutch-auction-chart-meta-value">{maxLabel}</span>
          </span>
          <span className="grai-dutch-auction-chart-meta-col is-end">
            <span className="grai-dutch-auction-chart-meta-label">Floor price</span>
            <span className="grai-dutch-auction-chart-meta-value">{minLabel}</span>
          </span>
        </div>
      </header>

      <div
        ref={plotRef}
        className={`grai-dutch-auction-chart-plot${plotEnter ? ' is-enter' : ''}`}
        key={chartIdentity}
        onPointerMove={(event) => {
          updateHoverFromClientX(event.clientX)
        }}
        onPointerLeave={() => setHoverPoint(null)}
        onPointerCancel={() => setHoverPoint(null)}
      >
        {scrubPoint ? (
          <div className="grai-dutch-auction-chart-tooltip is-follow" aria-live="polite">
            {scrubTimeLabel ? <span>{scrubTimeLabel}</span> : null}
            <span>{scrubElapsedLabel}</span>
            {scrubDiscountLabel ? <span>Discount {scrubDiscountLabel}</span> : null}
            <strong>${formatAxisAsk(scrubPoint.ask)}</strong>
          </div>
        ) : null}
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={CHART_MARGIN}>
            <CartesianGrid
              stroke="color-mix(in srgb, var(--border-color) 70%, transparent)"
              strokeDasharray="3 6"
              vertical={false}
            />
            <XAxis
              dataKey="progress"
              type="number"
              domain={[0, 1]}
              ticks={xTicks}
              interval={0}
              tick={(props) => {
                const { x, y, payload } = props as {
                  x?: number
                  y?: number
                  payload?: { value?: number }
                }
                if (x == null || y == null) return null
                const value = Number(payload?.value)
                if (!Number.isFinite(value)) return null

                const renderStamp = (
                  date: string,
                  clock: string,
                  caption: string,
                  anchor: 'start' | 'middle' | 'end',
                ) => (
                  <g transform={`translate(${x},${y})`}>
                    <text x={0} y={12} fill="var(--text-primary)" fontSize={11} textAnchor={anchor}>
                      {date}
                    </text>
                    <text x={0} y={25} fill="var(--text-primary)" fontSize={11} textAnchor={anchor}>
                      {clock}
                    </text>
                    <text
                      x={0}
                      y={39}
                      fill="var(--text-secondary)"
                      fontSize={10}
                      textAnchor={anchor}
                    >
                      {caption}
                    </text>
                  </g>
                )

                if (showNowTick && Math.abs(value - progressNow) < 0.001) {
                  return renderStamp(nowDate, nowClock, 'now time', 'middle')
                }

                if (value <= 0) {
                  return renderStamp(startDate, startClock, startCaption, 'start')
                }

                if (value >= 1) {
                  return renderStamp(endDate, endClock, endCaption, 'end')
                }

                const dayUnix =
                  dayMarks.find((mark) => Math.abs(mark.progress - value) < 0.001)?.unix ?? null
                if (dayUnix != null) {
                  return (
                    <g transform={`translate(${x},${y})`}>
                      <line
                        x1={0}
                        y1={0}
                        x2={0}
                        y2={6}
                        stroke="var(--border-color)"
                        strokeWidth={1}
                      />
                      <text
                        x={0}
                        y={20}
                        fill="var(--text-secondary)"
                        fontSize={10}
                        textAnchor="middle"
                      >
                        {formatAuctionDate(dayUnix)}
                      </text>
                    </g>
                  )
                }

                return null
              }}
              axisLine={{ stroke: 'var(--border-color)' }}
              tickLine={false}
            />
            <YAxis
              domain={yDomain}
              ticks={yTicks}
              width={Y_AXIS_WIDTH}
              tickFormatter={(value: number) => formatAxisAsk(value)}
              tick={{ fill: 'var(--text-primary)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              label={(props) => {
                const viewBox = props.viewBox as
                  | { x?: number; y?: number; width?: number }
                  | undefined
                if (viewBox?.x == null || viewBox.y == null) return null
                const tickX = viewBox.x + (viewBox.width ?? Y_AXIS_WIDTH) - 2
                return (
                  <text
                    x={tickX}
                    y={Math.max(6, viewBox.y - 14)}
                    fill="var(--text-primary)"
                    fontSize={11}
                    textAnchor="end"
                  >
                    GRAI
                  </text>
                )
              }}
            />
            <Area
              type="linear"
              dataKey="ask"
              stroke="#ff69b4"
              strokeWidth={2.25}
              fill="none"
              isAnimationActive={curveAnimating}
              animationDuration={480}
              animationEasing="ease-out"
              dot={false}
              activeDot={false}
            />
            <ReferenceLine
              x={progressNow}
              stroke="#ff69b4"
              strokeDasharray="4 4"
              strokeOpacity={0.75}
            />
            <ReferenceDot
              x={nowPoint.progress}
              y={nowPoint.ask}
              r={5}
              fill="#ff69b4"
              stroke="var(--bg-primary, #100c10)"
              strokeWidth={2}
            />
            {scrubPoint ? (
              <>
                <ReferenceLine
                  x={scrubPoint.progress}
                  stroke="#ff69b4"
                  strokeDasharray="2 3"
                  strokeOpacity={0.95}
                />
                <ReferenceDot
                  x={scrubPoint.progress}
                  y={scrubPoint.ask}
                  r={5}
                  fill="#ff69b4"
                  stroke="#fff"
                  strokeWidth={2}
                />
              </>
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
