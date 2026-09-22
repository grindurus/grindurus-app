import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"

// ─── Types ───────────────────────────────────────────────────────────────────
export interface ChartDataPoint {
  month: string
  strategy: number
  market: number
}

export interface PerformanceChartProps {
  data: ChartDataPoint[]
  strategyLabel?: string
  marketLabel?: string
}

// ─── Custom legend ────────────────────────────────────────────────────────────
function CustomLegend({ strategyLabel, marketLabel }: { strategyLabel: string; marketLabel: string }) {
  return (
    <div style={{ display: "flex", gap: 20, justifyContent: "flex-end", paddingRight: 8 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#ff69b4",
            display: "inline-block",
            boxShadow: "0 0 6px rgba(255,105,180,0.65)",
          }}
        />
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.15 }}>
          <span style={{ color: "#ff69b4", fontSize: 13, fontWeight: 600, letterSpacing: "0.04em" }}>
            {strategyLabel}
          </span>
          <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, letterSpacing: "0.03em" }}>
            volatility yield
          </span>
        </span>
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#00d4ff",
            display: "inline-block",
          }}
        />
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.15 }}>
          <span style={{ color: "#00d4ff", fontSize: 13, fontWeight: 600, letterSpacing: "0.04em" }}>
            {marketLabel}
          </span>
          <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, letterSpacing: "0.03em" }}>
            locked yield
          </span>
        </span>
      </span>
    </div>
  )
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: "rgba(10,10,10,0.97)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10,
        padding: "10px 16px",
        fontSize: 13,
        color: "#fff",
        backdropFilter: "blur(8px)",
      }}
    >
      <p style={{ margin: "0 0 6px", color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ margin: "2px 0", color: entry.color ?? entry.stroke }}>
          {entry.name}: {entry.value}%
        </p>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function PerformanceChart({
  data,
  strategyLabel = "Strategy",
  marketLabel = "Market",
}: PerformanceChartProps) {
  return (
    <div
      style={{
        background: "#0a0a0a",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        padding: "10px",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      <CustomLegend strategyLabel={strategyLabel} marketLabel={marketLabel} />

      {/* Chart */}
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="strategyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff69b4" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#ff1493" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" strokeDasharray="0" />

          <XAxis
            dataKey="month"
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />

          <YAxis
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            domain={["dataMin - 5", "dataMax + 5"]}
            width={52}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Strategy — filled area */}
          <Area
            type="monotone"
            dataKey="strategy"
            name={strategyLabel}
            stroke="#ff69b4"
            strokeWidth={2.5}
            fill="url(#strategyGradient)"
            dot={false}
            activeDot={{ r: 5, fill: "#ff69b4", stroke: "#fff", strokeWidth: 2 }}
          />

          {/* Market — dashed line */}
          <Line
            type="monotone"
            dataKey="market"
            name={marketLabel}
            stroke="#00d4ff"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            activeDot={{ r: 5, fill: "#00d4ff", stroke: "#fff", strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
