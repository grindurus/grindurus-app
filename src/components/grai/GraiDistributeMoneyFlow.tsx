import { useEffect, useMemo, useRef, useState } from 'react'
import { ResponsiveContainer, Sankey, Tooltip } from 'recharts'
import type { SankeyLinkProps, SankeyNodeProps } from 'recharts'

/** Colors: Money in, Claim, Treasury, Buyback */
const NODE_COLORS = ['#ff69b4', '#22c55e', '#c9a227', '#ff69b4'] as const
const SHARE_COUNT = 3
const NODE_WIDTH = 14
/** Match `.grai-liquidation-ops-row` / escrow body width. */
const FLOW_WIDTH_REM = 25.3125
const MIN_SIDE_MARGIN = 96

type Props = {
  amountLabel: string
  assetSymbol?: string
}

type NodePayload = {
  name?: string
  amountLabel?: string
}

function parseDistributeAmount(amountLabel: string): number {
  const n = Number(amountLabel.replace(/,/g, '').trim())
  return Number.isFinite(n) && n > 0 ? n : 0
}

function formatCompactAmount(value: number): string {
  if (!(value > 0) || !Number.isFinite(value)) return '0'
  if (value >= 1000) {
    return value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 })
  }
  return value
    .toLocaleString('en-US', { maximumFractionDigits: 6 })
    .replace(/\.?0+$/, '')
}

function formatShareAmount(total: number, symbol?: string): string {
  if (!(total > 0)) return symbol ? `0 ${symbol}` : '0'
  const formatted = formatCompactAmount(total / SHARE_COUNT)
  return symbol ? `${formatted} ${symbol}` : formatted
}

function formatFlowShare(value: number, total: number): string {
  if (!(total > 0) || !Number.isFinite(value)) return '—'
  const pct = (value / total) * 100
  return `${pct.toFixed(pct >= 10 || Number.isInteger(pct) ? 0 : 1)}%`
}

function readRemPx(): number {
  if (typeof window === 'undefined') return 16
  const root = window.getComputedStyle(document.documentElement).fontSize
  const n = Number.parseFloat(root)
  return Number.isFinite(n) && n > 0 ? n : 16
}

function SankeyNode({ x, y, width, height, index, payload }: SankeyNodeProps) {
  const color = NODE_COLORS[index % NODE_COLORS.length] ?? '#ff69b4'
  const isSource = index === 0
  const labelX = isSource ? x - 8 : x + width + 8
  const textAnchor = isSource ? 'end' : 'start'
  const node = payload as NodePayload
  const name = String(node.name ?? '')
  const amountUnder = !isSource ? node.amountLabel : undefined
  const labelY = isSource
    ? y + height / 2 + 8
    : amountUnder
      ? y + height / 2 - 10
      : y + height / 2

  return (
    <g className="grai-distribute-sankey-node">
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        fillOpacity={0.92}
        rx={3}
        ry={3}
      />
      {isSource ? (
        <text
          x={labelX}
          y={labelY - 16}
          textAnchor={textAnchor}
          dominantBaseline="middle"
          className="grai-distribute-sankey-node-caption"
          fontSize={12}
          fontWeight={600}
        >
          Asset in
        </text>
      ) : null}
      <text
        x={labelX}
        y={labelY}
        textAnchor={textAnchor}
        dominantBaseline="middle"
        className={
          isSource
            ? 'grai-distribute-sankey-node-label grai-distribute-sankey-node-amount-text'
            : 'grai-distribute-sankey-node-label'
        }
        fill="var(--text-primary)"
        fontSize={isSource ? undefined : 12}
        fontWeight={600}
      >
        {name}
      </text>
      {amountUnder ? (
        <text
          x={labelX}
          y={labelY + 18}
          textAnchor={textAnchor}
          dominantBaseline="middle"
          className="grai-distribute-sankey-node-amount grai-distribute-sankey-node-amount-text"
          fontWeight={600}
        >
          {amountUnder}
        </text>
      ) : null}
    </g>
  )
}

function SankeyLink(props: SankeyLinkProps) {
  const {
    sourceX,
    targetX,
    sourceY,
    targetY,
    sourceControlX,
    targetControlX,
    linkWidth,
    payload,
    index,
  } = props
  const sourceIndex =
    typeof payload.source === 'object' ? Number((payload.source as { index?: number }).index ?? 0) : 0
  const targetIndex =
    typeof payload.target === 'object'
      ? Number((payload.target as { index?: number }).index ?? index + 1)
      : index + 1
  const sourceColor = NODE_COLORS[sourceIndex % NODE_COLORS.length] ?? '#ff69b4'
  const targetColor = NODE_COLORS[targetIndex % NODE_COLORS.length] ?? '#ff69b4'
  const gradientId = `grai-sankey-link-${index}`

  return (
    <g className="grai-distribute-sankey-link">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={sourceColor} stopOpacity={0.45} />
          <stop offset="100%" stopColor={targetColor} stopOpacity={0.35} />
        </linearGradient>
      </defs>
      <path
        d={`
          M${sourceX},${sourceY + linkWidth / 2}
          C${sourceControlX},${sourceY + linkWidth / 2}
            ${targetControlX},${targetY + linkWidth / 2}
            ${targetX},${targetY + linkWidth / 2}
          L${targetX},${targetY - linkWidth / 2}
          C${targetControlX},${targetY - linkWidth / 2}
            ${sourceControlX},${sourceY - linkWidth / 2}
            ${sourceX},${sourceY - linkWidth / 2}
          Z
        `}
        fill={`url(#${gradientId})`}
        stroke="none"
      />
    </g>
  )
}

/** Sankey money flow: input amount splits evenly into Claim, Treasury, Buyback. */
export function GraiDistributeMoneyFlow({ amountLabel, assetSymbol }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(0)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const update = () => setChartWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const totalAmount = useMemo(() => parseDistributeAmount(amountLabel), [amountLabel])
  const shareAmountLabel = useMemo(
    () => formatShareAmount(totalAmount, assetSymbol),
    [totalAmount, assetSymbol],
  )
  const sourceName = useMemo(() => {
    const amount = formatCompactAmount(totalAmount)
    return assetSymbol ? `${amount} ${assetSymbol}` : amount
  }, [totalAmount, assetSymbol])

  const margin = useMemo(() => {
    const targetLink = FLOW_WIDTH_REM * readRemPx()
    const contentWidth = targetLink + NODE_WIDTH * 2
    const width = chartWidth > 0 ? chartWidth : contentWidth + MIN_SIDE_MARGIN * 2
    const side = Math.max(MIN_SIDE_MARGIN, (width - contentWidth) / 2)
    return { top: 14, right: side, bottom: 14, left: side }
  }, [chartWidth])

  const sankeyData = useMemo(() => {
    const share = 1
    return {
      nodes: [
        { name: sourceName },
        { name: 'Claim', amountLabel: shareAmountLabel },
        { name: 'Treasury', amountLabel: shareAmountLabel },
        { name: 'Buyback', amountLabel: shareAmountLabel },
      ],
      links: [
        { source: 0, target: 1, value: share },
        { source: 0, target: 2, value: share },
        { source: 0, target: 3, value: share },
      ],
    }
  }, [sourceName, shareAmountLabel])

  const totalFlow = SHARE_COUNT

  return (
    <div ref={rootRef} className="grai-distribute-money-flow" aria-label="Distribute money flow">
      <ResponsiveContainer width="100%" height="100%">
        <Sankey
          data={sankeyData}
          nodeWidth={NODE_WIDTH}
          nodePadding={28}
          linkCurvature={0.55}
          iterations={48}
          margin={margin}
          node={SankeyNode}
          link={SankeyLink}
        >
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null
              const entry = payload[0].payload as {
                source?: { name?: string }
                target?: { name?: string; amountLabel?: string }
                value?: number
                name?: string
                amountLabel?: string
              }
              const value = Number(entry.value)
              if (entry.source?.name && entry.target?.name && Number.isFinite(value)) {
                return (
                  <div className="grai-distribute-sankey-tooltip">
                    <span>
                      {entry.source.name} → {entry.target.name}
                    </span>
                    <strong>{entry.target.amountLabel ?? formatFlowShare(value, totalFlow)}</strong>
                  </div>
                )
              }
              if (entry.name) {
                return (
                  <div className="grai-distribute-sankey-tooltip">
                    <strong>{entry.name}</strong>
                    {entry.amountLabel ? <span>{entry.amountLabel}</span> : null}
                  </div>
                )
              }
              return null
            }}
          />
        </Sankey>
      </ResponsiveContainer>
    </div>
  )
}
