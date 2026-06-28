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
  isLoading?: boolean
}

type DonutChartEntry = {
  name: string
  value: number
  color: string
  mint: string
}

const TRACK_FILL = 'var(--grai-donut-track-fill)'
const ACTIVE_SECTOR_STROKE = 'var(--grai-donut-sector-stroke)'

export function GraiNavDonut({ slices, totalNavLabel, centerLabel, isLoading = false }: GraiNavDonutProps) {
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
      })),
      isEmptyDistribution: true,
    }
  }, [slices])

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
      className={`grai-donut-wrap${isEmptyDistribution ? ' is-empty-distribution' : ''}`}
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
              innerRadius="72%"
              outerRadius="88%"
              paddingAngle={0}
              cornerRadius={3}
              stroke="none"
              isAnimationActive
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
      <div className="grai-donut-center">
        <span className="grai-donut-total-label">{centerLabel}</span>
        <span className="grai-donut-total-value">{totalNavLabel} USDC</span>
      </div>
    </div>
  )
}
