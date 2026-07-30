import { useEffect, useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import type { GraiAsset } from '../grai/knownMints'

export type GraiCompositionSlice = {
  asset: GraiAsset
  color: string
  pct: number
  navUsdRaw: bigint
}

type GraiNavDonutProps = {
  slices: GraiCompositionSlice[]
  totalNavLabel: string
  centerLabel: string
  valueUnit?: string
  isLoading?: boolean
  showSliceIcons?: boolean
}

type DonutChartEntry = {
  name: string
  value: number
  color: string
  mint: string
  icon: string
}

type DonutSliceIcon = DonutChartEntry & {
  x: number
  y: number
}

const TRACK_FILL = 'var(--grai-donut-track-fill)'
const ACTIVE_SECTOR_STROKE = 'var(--grai-donut-sector-stroke)'
const RADIAN = Math.PI / 180
/** Matches Recharts Pie default startAngle (0° at 3 o'clock, CCW). */
const PIE_START_ANGLE = 0

function buildSliceIcons(chartData: DonutChartEntry[], radiusPct: number): DonutSliceIcon[] {
  const total = chartData.reduce((sum, entry) => sum + entry.value, 0)
  if (total <= 0) return []

  let cumulative = 0
  return chartData.map((entry) => {
    const start = cumulative
    cumulative += entry.value
    const midAngle = PIE_START_ANGLE + ((start + cumulative) / 2 / total) * 360
    return {
      ...entry,
      x: 50 + radiusPct * Math.cos(-midAngle * RADIAN),
      y: 50 + radiusPct * Math.sin(-midAngle * RADIAN),
    }
  })
}

export function GraiNavDonut({
  slices,
  totalNavLabel,
  centerLabel,
  valueUnit = 'USDC',
  isLoading = false,
  showSliceIcons = false,
}: GraiNavDonutProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const { chartData, isEmptyDistribution } = useMemo((): {
    chartData: DonutChartEntry[]
    isEmptyDistribution: boolean
  } => {
    const activeSlices = slices
      .filter((slice) => slice.pct > 0)
      .map((slice) => ({
        name: slice.asset.symbol,
        value: slice.pct,
        color: slice.color,
        mint: slice.asset.mint,
        icon: slice.asset.icon.src,
      }))

    if (activeSlices.length > 0) {
      return { chartData: activeSlices, isEmptyDistribution: false }
    }

    if (slices.length === 0) {
      return { chartData: [], isEmptyDistribution: false }
    }

    const equalShare = 100 / slices.length
    return {
      chartData: slices.map((slice) => ({
        name: slice.asset.symbol,
        value: equalShare,
        color: slice.color,
        mint: slice.asset.mint,
        icon: slice.asset.icon.src,
      })),
      isEmptyDistribution: true,
    }
  }, [slices])

  const sliceIcons = useMemo(
    () => (showSliceIcons ? buildSliceIcons(chartData, 42) : []),
    [chartData, showSliceIcons],
  )

  const showTrackOnly = isLoading || chartData.length === 0
  const activeItem = activeIndex === null ? null : chartData[activeIndex] ?? null

  useEffect(() => {
    setActiveIndex(null)
  }, [chartData])

  const handleSectorEnter = (_: unknown, index: number) => {
    setActiveIndex(index)
  }

  return (
    <div
      className={`grai-donut-wrap${isEmptyDistribution ? ' is-empty-distribution' : ''}${
        showSliceIcons ? ' has-slice-icons' : ''
      }`}
      onMouseLeave={() => setActiveIndex(null)}
    >
      <div
        className={`grai-donut-tooltip grai-donut-tooltip--pinned ${activeItem ? 'is-visible' : ''}`}
        aria-hidden={!activeItem}
      >
        {activeItem && (
          <>
            <span
              className="grai-donut-tooltip-dot"
              style={{ backgroundColor: activeItem.color }}
              aria-hidden="true"
            />
            <span className="grai-donut-tooltip-label">{activeItem.name}</span>
            <span className="grai-donut-tooltip-value">
              {isEmptyDistribution ? '0.0%' : `${activeItem.value.toFixed(1)}%`}
            </span>
          </>
        )}
      </div>
      <ResponsiveContainer className="grai-donut-chart" width="100%" height="100%">
        <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          {showTrackOnly ? (
            <Pie
              data={[{ value: 1 }]}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius="72%"
              outerRadius="88%"
              stroke="none"
              fill={TRACK_FILL}
              isAnimationActive={false}
            />
          ) : (
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius={showSliceIcons ? '72%' : '88%'}
              paddingAngle={0}
              // Equal/empty slices + cornerRadius leave visible gaps; skip both for a continuous ring.
              cornerRadius={isEmptyDistribution ? 0 : 3}
              stroke="none"
              isAnimationActive={!isEmptyDistribution}
              animationDuration={500}
              onMouseEnter={handleSectorEnter}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={entry.mint}
                  fill={entry.color}
                  fillOpacity={
                    isEmptyDistribution
                      ? activeIndex === index
                        ? 0.55
                        : activeIndex !== null
                          ? 0.15
                          : undefined
                      : activeIndex === null || activeIndex === index
                        ? 1
                        : 0.4
                  }
                  stroke={activeIndex === index ? ACTIVE_SECTOR_STROKE : 'none'}
                  strokeWidth={activeIndex === index ? 2 : 0}
                />
              ))}
            </Pie>
          )}
        </PieChart>
      </ResponsiveContainer>
      {showSliceIcons && !showTrackOnly && sliceIcons.length > 0 ? (
        <div className="grai-donut-slice-icons" aria-hidden="true">
          {sliceIcons.map((marker) => (
            <span
              key={marker.mint}
              className={`grai-donut-slice-icon${
                activeIndex !== null && chartData[activeIndex]?.mint === marker.mint
                  ? ' is-active'
                  : ''
              }`}
              style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
              title={marker.name}
            >
              <img src={marker.icon} alt="" width={16} height={16} loading="lazy" decoding="async" />
              <span className="grai-donut-slice-symbol">{marker.name}</span>
            </span>
          ))}
        </div>
      ) : null}
      <div className="grai-donut-center">
        <span className="grai-donut-total-label">{centerLabel}</span>
        <span className="grai-donut-total-value">
          {totalNavLabel} {valueUnit}
        </span>
      </div>
    </div>
  )
}
