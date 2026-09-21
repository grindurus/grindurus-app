import { useEffect, useMemo, useRef } from 'react'
import { createChart, LineSeries, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts'
import { toUniqueUtcLineData } from '../chart/chartTimeUtils'
import { buildInventoryChartOptions, buildLineSeriesOptions, nonNegativeAutoscaleInfoProvider } from '../chart/grindurusChartTheme'
import { useDocumentChartTheme } from '../chart/useDocumentChartTheme'
import '../chart/grindurusCharts.css'

export interface InventoryHistoryPoint {
  t: number
  base: number
  quote: number
  spot?: number
}

function inventoryBaseQuote(point: InventoryHistoryPoint): number | null {
  if (point.spot == null || !Number.isFinite(point.spot) || point.spot <= 0) return null
  const value = point.base * point.spot
  return Number.isFinite(value) ? Math.max(0, value) : null
}

function inventoryNav(point: InventoryHistoryPoint): number | null {
  if (point.spot == null || !Number.isFinite(point.spot) || point.spot <= 0) return null
  const nav = point.quote + point.base * point.spot
  return Number.isFinite(nav) ? Math.max(0, nav) : null
}

const inventorySeriesExtra = {
  priceScaleId: 'left' as const,
  autoscaleInfoProvider: nonNegativeAutoscaleInfoProvider,
}

interface InventoryHistoryChartProps {
  history: InventoryHistoryPoint[]
  baseAsset: string
  quoteAsset: string
  emptyMessage?: string
}

export function InventoryHistoryChart({
  history,
  baseAsset,
  quoteAsset,
  emptyMessage = 'No inventory history yet',
}: InventoryHistoryChartProps) {
  const theme = useDocumentChartTheme()
  const hostRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const quoteSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const baseSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const navSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  const points = useMemo(() => history.slice(-5000), [history])
  const spotPoints = useMemo(
    () => points.filter((p) => inventoryBaseQuote(p) != null),
    [points]
  )

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const chart = createChart(host, {
      ...buildInventoryChartOptions(theme),
      width: Math.max(host.clientWidth, 1),
      height: Math.max(host.clientHeight, 1),
    })

    const quoteSeries = chart.addSeries(
      LineSeries,
      buildLineSeriesOptions(theme, 'quote', inventorySeriesExtra)
    )
    const baseSeries = chart.addSeries(
      LineSeries,
      buildLineSeriesOptions(theme, 'base', inventorySeriesExtra)
    )
    const navSeries = chart.addSeries(
      LineSeries,
      buildLineSeriesOptions(theme, 'nav', { ...inventorySeriesExtra, lineWidth: 2, lineStyle: 0 })
    )

    chartRef.current = chart
    quoteSeriesRef.current = quoteSeries
    baseSeriesRef.current = baseSeries
    navSeriesRef.current = navSeries

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) chart.applyOptions({ width, height })
    })
    ro.observe(host)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      quoteSeriesRef.current = null
      navSeriesRef.current = null
      baseSeriesRef.current = null
    }
    // theme applied in a separate effect; create once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    chartRef.current?.applyOptions(buildInventoryChartOptions(theme))
    quoteSeriesRef.current?.applyOptions(buildLineSeriesOptions(theme, 'quote', inventorySeriesExtra))
    baseSeriesRef.current?.applyOptions(buildLineSeriesOptions(theme, 'base', inventorySeriesExtra))
    navSeriesRef.current?.applyOptions(
      buildLineSeriesOptions(theme, 'nav', { ...inventorySeriesExtra, lineWidth: 2, lineStyle: 0 })
    )
  }, [theme])

  useEffect(() => {
    const quoteSeries = quoteSeriesRef.current
    const navSeries = navSeriesRef.current
    const baseSeries = baseSeriesRef.current
    const chart = chartRef.current
    if (!quoteSeries || !navSeries || !baseSeries || !chart) return

    if (points.length === 0) {
      // Placeholder points so price/time axes render while idle (overlay covers the line).
      const now = Math.floor(Date.now() / 1000) as UTCTimestamp
      const placeholder = [
        { time: ((now as number) - 86_400) as UTCTimestamp, value: 0 },
        { time: now, value: 0 },
      ]
      quoteSeries.setData(placeholder)
      baseSeries.setData([])
      navSeries.setData([])
      chart.timeScale().fitContent()
      return
    }

    quoteSeries.setData(toUniqueUtcLineData(points, (p) => p.t, (p) => Math.max(0, p.quote)))
    baseSeries.setData(
      toUniqueUtcLineData(spotPoints, (p) => p.t, (p) => inventoryBaseQuote(p) as number)
    )
    navSeries.setData(
      toUniqueUtcLineData(spotPoints, (p) => p.t, (p) => inventoryNav(p) as number)
    )
    chart.timeScale().fitContent()
  }, [points, spotPoints])

  const baseLegend = `${(baseAsset || 'BASE').toUpperCase()}×px`

  return (
    <div className="inventory-history-chart">
      <div className="inventory-history-plot lwc-inventory-layout">
        <div className="inventory-plot-main lwc-inventory-main lwc-chart-frame">
          {points.length > 0 ? (
            <div className="inventory-hover-values inventory-lwc-legend">
              <span className="quote">{(quoteAsset || 'QUOTE').toUpperCase()}</span>
              <span className="base">{baseLegend}</span>
              <span className="nav">NAV</span>
            </div>
          ) : null}
          {/* Host must stay mounted: createChart runs once; toggling empty↔data used to orphan the canvas. */}
          <div ref={hostRef} className="lwc-chart-host" />
          {points.length === 0 ? (
            <div className="lwc-chart-empty">{emptyMessage}</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
