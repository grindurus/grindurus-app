import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatVaultBalanceDisplay } from '../../grai/formatVaultBalance'

const SAMPLE_COUNT = 48

type ChartPoint = {
  progress: number
  ask: number
  label: string
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

function formatAxisAsk(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value >= 1000) {
    return value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })
  }
  if (value >= 10) return value.toFixed(1)
  return value.toFixed(2)
}

function formatChartAskUsd(raw: bigint, decimals: number): string {
  const normalized = formatVaultBalanceDisplay(raw, decimals, 2)
  if (!normalized.includes('.')) return `$${normalized}.00`
  const [wholePart, fractionPart = ''] = normalized.split('.')
  return `$${wholePart}.${fractionPart.padEnd(2, '0').slice(0, 2)}`
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
  const gradientId = useId().replace(/:/g, '')
  const hasLot = available > 0n
  const chartIdentity = `${symbol}:${hasLot ? 'lot' : 'empty'}`
  const [curveAnimating, setCurveAnimating] = useState(true)
  const [plotEnter, setPlotEnter] = useState(true)

  useEffect(() => {
    setCurveAnimating(true)
    setPlotEnter(false)
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

  const { points, nowPoint, yDomain } = useMemo(() => {
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
    const pad = Math.max((maxN - minN) * 0.08, maxN * 0.02, 0.01)
    return {
      points: nextPoints,
      nowPoint: { progress: progressNow, ask: nowAsk },
      yDomain: [Math.max(0, minN - pad), maxN + pad] as [number, number],
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

  return (
    <section
      className="grai-dutch-auction-chart"
      aria-label={`${symbol} dutch auction price curve`}
    >
      <h3 className="grai-dutch-auction-chart-title">Buyback Dutch Action</h3>
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
            <span className="grai-dutch-auction-chart-meta-label">Now</span>
            <span className="grai-dutch-auction-chart-meta-value">{currentAskLabel}</span>
          </span>
          <span className="grai-dutch-auction-chart-meta-col is-end">
            <span className="grai-dutch-auction-chart-meta-label">Discount</span>
            <span className="grai-dutch-auction-chart-meta-value is-discount">
              {hasLot ? (discountLabel ?? '—') : '0%'}
            </span>
          </span>
          <span className="grai-dutch-auction-chart-meta-col is-end">
            <span className="grai-dutch-auction-chart-meta-label">Left</span>
            <span className="grai-dutch-auction-chart-meta-value">
              {hasLot ? (remainingLabel ?? '—') : '—'}
            </span>
          </span>
          <span className="grai-dutch-auction-chart-meta-col is-end">
            <span className="grai-dutch-auction-chart-meta-label">Max</span>
            <span className="grai-dutch-auction-chart-meta-value">{maxLabel}</span>
          </span>
          <span className="grai-dutch-auction-chart-meta-col is-end">
            <span className="grai-dutch-auction-chart-meta-label">Floor</span>
            <span className="grai-dutch-auction-chart-meta-value">{minLabel}</span>
          </span>
        </div>
      </header>

      <div
        className={`grai-dutch-auction-chart-plot${plotEnter ? ' is-enter' : ''}`}
        key={chartIdentity}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id={`grai-dutch-fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff69b4" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#ff69b4" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="color-mix(in srgb, var(--border-color) 70%, transparent)"
              strokeDasharray="3 6"
              vertical={false}
            />
            <XAxis
              dataKey="progress"
              type="number"
              domain={[0, 1]}
              ticks={[0, progressNow, 1]}
              tickFormatter={(value: number) => {
                if (Math.abs(value - progressNow) < 0.001) return 'Now'
                if (value <= 0) return 'Start'
                if (value >= 1) return 'Floor'
                return ''
              }}
              tick={{ fill: '#fff', fontSize: 11 }}
              axisLine={{ stroke: 'var(--border-color)' }}
              tickLine={false}
            />
            <YAxis
              domain={yDomain}
              width={48}
              tickFormatter={formatAxisAsk}
              tick={{ fill: '#fff', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ stroke: '#ff69b4', strokeWidth: 1, strokeDasharray: '4 4' }}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null
                const point = payload[0].payload as ChartPoint
                return (
                  <div className="grai-dutch-auction-chart-tooltip">
                    <span>
                      {point.progress <= 0
                        ? 'Start'
                        : point.progress >= 1
                          ? 'Floor'
                          : `${Math.round(point.progress * 100)}% elapsed`}
                    </span>
                    <strong>${formatAxisAsk(point.ask)}</strong>
                  </div>
                )
              }}
            />
            <Area
              type="linear"
              dataKey="ask"
              stroke="#ff69b4"
              strokeWidth={2.25}
              fill={`url(#grai-dutch-fill-${gradientId})`}
              isAnimationActive={curveAnimating}
              animationDuration={480}
              animationEasing="ease-out"
              dot={false}
              activeDot={{ r: 4, fill: '#ff69b4', stroke: '#fff', strokeWidth: 1.5 }}
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
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
