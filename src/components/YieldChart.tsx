import { useEffect, useMemo, useRef } from 'react'
import { createChart, LineSeries, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts'
import { toUniqueUtcLineData } from '../chart/chartTimeUtils'
import { buildGrindurusChartOptions, buildLineSeriesOptions } from '../chart/grindurusChartTheme'
import { useDocumentChartTheme } from '../chart/useDocumentChartTheme'
import '../chart/grindurusCharts.css'

export interface YieldHistoryPoint {
  t: number
  pnlQuote: number
  pnlBase: number
  /** Spot (or mark) at sample time — total = pnlQuote + pnlBase * price */
  price: number
  totalPnl: number
}

interface YieldChartProps {
  history: YieldHistoryPoint[]
  baseAsset: string
  quoteAsset: string
  emptyMessage?: string
}

export function YieldChart({
  history,
  baseAsset,
  quoteAsset,
  emptyMessage = 'No yield history yet',
}: YieldChartProps) {
  const theme = useDocumentChartTheme()
  const hostRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const quoteSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const baseSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const totalSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  const points = useMemo(() => history.slice(-5000), [history])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const chart = createChart(host, {
      ...buildGrindurusChartOptions(theme),
      width: Math.max(host.clientWidth, 1),
      height: Math.max(host.clientHeight, 1),
    })

    const quoteSeries = chart.addSeries(LineSeries, buildLineSeriesOptions(theme, 'yieldQuote'))
    const baseSeries = chart.addSeries(
      LineSeries,
      buildLineSeriesOptions(theme, 'yieldBaseQ', { lineStyle: 0 })
    )
    const totalSeries = chart.addSeries(
      LineSeries,
      buildLineSeriesOptions(theme, 'yieldTotal', { lineStyle: 2, lineWidth: 2 })
    )

    chartRef.current = chart
    quoteSeriesRef.current = quoteSeries
    baseSeriesRef.current = baseSeries
    totalSeriesRef.current = totalSeries

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
      baseSeriesRef.current = null
      totalSeriesRef.current = null
    }
    // theme applied in a separate effect; create once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    chartRef.current?.applyOptions(buildGrindurusChartOptions(theme))
    quoteSeriesRef.current?.applyOptions(buildLineSeriesOptions(theme, 'yieldQuote'))
    baseSeriesRef.current?.applyOptions(buildLineSeriesOptions(theme, 'yieldBaseQ'))
    totalSeriesRef.current?.applyOptions(buildLineSeriesOptions(theme, 'yieldTotal', { lineStyle: 2 }))
  }, [theme])

  useEffect(() => {
    const quoteSeries = quoteSeriesRef.current
    const baseSeries = baseSeriesRef.current
    const totalSeries = totalSeriesRef.current
    const chart = chartRef.current
    if (!quoteSeries || !baseSeries || !totalSeries || !chart) return

    if (points.length === 0) {
      const now = Math.floor(Date.now() / 1000) as UTCTimestamp
      const placeholder = [
        { time: ((now as number) - 86_400) as UTCTimestamp, value: 0 },
        { time: now, value: 0 },
      ]
      quoteSeries.setData(placeholder)
      baseSeries.setData([])
      totalSeries.setData([])
      chart.timeScale().fitContent()
      return
    }

    quoteSeries.setData(toUniqueUtcLineData(points, (p) => p.t, (p) => p.pnlQuote))
    baseSeries.setData(
      toUniqueUtcLineData(points, (p) => p.t, (p) => p.pnlBase * p.price)
    )
    totalSeries.setData(toUniqueUtcLineData(points, (p) => p.t, (p) => p.totalPnl))
    chart.timeScale().fitContent()
  }, [points])

  const baseLegend = `${(baseAsset || 'BASE').toUpperCase()}×px`

  return (
    <div className="yield-history-chart">
      <div className="yield-history-plot lwc-yield-layout">
        <div className="yield-plot-main lwc-yield-main lwc-chart-frame">
          {points.length > 0 ? (
            <div className="inventory-hover-values inventory-lwc-legend yield-lwc-legend">
              <span className="quote">{(quoteAsset || 'QUOTE').toUpperCase()}</span>
              <span className="base">{baseLegend}</span>
              <span className="total">Total</span>
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
