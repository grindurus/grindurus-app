import { useState, useMemo } from "react"
import * as Select from "@radix-ui/react-select"
import { Title } from "@landing/components/ui/Title"
import { PerformanceChart, type ChartDataPoint } from "./PerformanceChart"
import { FieldLabel } from "@landing/components/ui/FieldLabel"

// ─── Data ─────────────────────────────────────────────────────────────────────
const ALL_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

type PairKey = "SOL/USDC" | "ETH/USDC" | "BTC/USDC" | "ARB/USDC"
const PAIRS: PairKey[] = ["SOL/USDC", "ETH/USDC", "BTC/USDC", "ARB/USDC"]

const PAIR_DATA: Record<PairKey, ChartDataPoint[]> = {
  "SOL/USDC": [
    { month: "Jan", strategy: 100, market: 100 },
    { month: "Feb", strategy: 104, market: 101 },
    { month: "Mar", strategy: 109, market: 99 },
    { month: "Apr", strategy: 113, market: 103 },
    { month: "May", strategy: 118, market: 100 },
    { month: "Jun", strategy: 124, market: 105 },
    { month: "Jul", strategy: 130, market: 102 },
    { month: "Aug", strategy: 135, market: 108 },
    { month: "Sep", strategy: 140, market: 104 },
    { month: "Oct", strategy: 144, market: 107 },
    { month: "Nov", strategy: 148, market: 110 },
    { month: "Dec", strategy: 153, market: 112 },
  ],
  "ETH/USDC": [
    { month: "Jan", strategy: 100, market: 100 },
    { month: "Feb", strategy: 103, market: 102 },
    { month: "Mar", strategy: 107, market: 100 },
    { month: "Apr", strategy: 111, market: 104 },
    { month: "May", strategy: 116, market: 101 },
    { month: "Jun", strategy: 121, market: 106 },
    { month: "Jul", strategy: 126, market: 103 },
    { month: "Aug", strategy: 131, market: 109 },
    { month: "Sep", strategy: 136, market: 107 },
    { month: "Oct", strategy: 140, market: 111 },
    { month: "Nov", strategy: 145, market: 113 },
    { month: "Dec", strategy: 150, market: 116 },
  ],
  "BTC/USDC": [
    { month: "Jan", strategy: 100, market: 100 },
    { month: "Feb", strategy: 102, market: 101 },
    { month: "Mar", strategy: 105, market: 103 },
    { month: "Apr", strategy: 108, market: 105 },
    { month: "May", strategy: 112, market: 103 },
    { month: "Jun", strategy: 116, market: 107 },
    { month: "Jul", strategy: 120, market: 105 },
    { month: "Aug", strategy: 124, market: 110 },
    { month: "Sep", strategy: 128, market: 108 },
    { month: "Oct", strategy: 132, market: 112 },
    { month: "Nov", strategy: 137, market: 114 },
    { month: "Dec", strategy: 142, market: 117 },
  ],
  "ARB/USDC": [
    { month: "Jan", strategy: 100, market: 100 },
    { month: "Feb", strategy: 106, market: 100 },
    { month: "Mar", strategy: 112, market: 97 },
    { month: "Apr", strategy: 117, market: 101 },
    { month: "May", strategy: 123, market: 98 },
    { month: "Jun", strategy: 130, market: 103 },
    { month: "Jul", strategy: 137, market: 100 },
    { month: "Aug", strategy: 143, market: 106 },
    { month: "Sep", strategy: 149, market: 102 },
    { month: "Oct", strategy: 154, market: 105 },
    { month: "Nov", strategy: 159, market: 108 },
    { month: "Dec", strategy: 165, market: 111 },
  ],
}

// ─── Radix UI Select (matches app design language) ────────────────────────────
interface CustomSelectProps<T extends string | number> {
  value: T
  onChange: (v: T) => void
  options: { label: string; value: T; disabled?: boolean }[]
  id?: string
}

function CustomSelect<T extends string | number>({ value, onChange, options, id }: CustomSelectProps<T>) {
  return (
    <Select.Root
      value={String(value)}
      onValueChange={(raw) =>
        onChange((typeof value === "number" ? Number(raw) : raw) as T)
      }
    >
      <Select.Trigger
        id={id}
        className={[
          "w-full flex items-center justify-between",
          "bg-black border border-white/10 rounded-xl",
          "px-4 py-3",
          "font-mono font-bold text-white text-sm",
          "cursor-pointer outline-none",
          "hover:border-brand-pink/30 focus:border-brand-pink/50",
          "transition-colors duration-150",
          "data-[placeholder]:text-white/40",
        ].join(" ")}
      >
        <Select.Value />
        <Select.Icon className="text-white/35 ml-2 flex-shrink-0">
          <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          style={{
            background: "#0a0a0a",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 12,
            padding: "4px",
            width: "var(--radix-select-trigger-width)",
            maxHeight: "var(--radix-select-content-available-height)",
            overflowY: "auto",
            zIndex: 50,
          }}
        >
          <Select.Viewport>
            {options.map((opt) => (
              <Select.Item
                key={String(opt.value)}
                value={String(opt.value)}
                disabled={opt.disabled}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "monospace",
                  color: opt.disabled ? "rgba(255,255,255,0.25)" : "#fff",
                  cursor: opt.disabled ? "not-allowed" : "pointer",
                  outline: "none",
                  userSelect: "none",
                }}
                className="hover:bg-white/[0.06] data-[highlighted]:bg-white/[0.08] data-[highlighted]:outline-none transition-colors"
              >
                <Select.ItemText>{opt.label}</Select.ItemText>
                <Select.ItemIndicator>
                  <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="#ff69b4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

// ─── Controls panel ───────────────────────────────────────────────────────────
interface ControlsProps {
  pair: PairKey
  onPair: (p: PairKey) => void
  fromMonth: number
  onFrom: (m: number) => void
  toMonth: number
  onTo: (m: number) => void
}

function ChartControls({ pair, onPair, fromMonth, onFrom, toMonth, onTo }: ControlsProps) {
  const pairOptions = PAIRS.map((p) => ({ label: p, value: p }))

  const fromOptions = ALL_MONTHS.map((m, i) => ({
    label: m,
    value: i,
    disabled: i >= toMonth,
  }))

  const toOptions = ALL_MONTHS.map((m, i) => ({
    label: m,
    value: i,
    disabled: i <= fromMonth,
  }))

  return (
    <div className="bg-[#0a0a0a] border border-white/[0.08] rounded-2xl p-4 md:p-6 flex flex-col gap-4 md:gap-6 h-full">
      <div>
        <FieldLabel>Asset Pair</FieldLabel>
        <CustomSelect value={pair} onChange={onPair} options={pairOptions} id="ctrl-pair" />
      </div>

      {/* Period: From → To */}
      <div className="flex gap-4">
        <div className="flex-1">
          <FieldLabel>From</FieldLabel>
          <CustomSelect value={fromMonth} onChange={onFrom} options={fromOptions} id="ctrl-from" />
        </div>

        <div className="flex-1">
          <FieldLabel>To</FieldLabel>
          <CustomSelect value={toMonth} onChange={onTo} options={toOptions} id="ctrl-to" />
        </div>
      </div>

      <div className="hidden flex-1 flex flex-col min-h-0 md:flex">
        <FieldLabel>Year</FieldLabel>
        <div className="flex-1 font-mono font-bold flex flex-col justify-between w-full">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="flex justify-between w-full">
              {[0, 1, 2, 3].map((col) => {
                const isPink = (row + col) % 2 === 1
                return (
                  <span
                    key={col}
                    className={isPink ? "text-brand-pink" : "text-white"}
                  >
                    2025
                  </span>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────
export function AnnualResultsSection() {
  const [pair, setPair] = useState<PairKey>("SOL/USDC")
  const [fromMonth, setFromMonth] = useState(0)
  const [toMonth, setToMonth] = useState(11)

  const chartData = useMemo<ChartDataPoint[]>(() => {
    return PAIR_DATA[pair].slice(fromMonth, toMonth + 1)
  }, [pair, fromMonth, toMonth])

  const [asset] = pair.split("/")
  const marketLabel = `Market ${asset}`

  return (
    <section className="relative w-full py-6 md:py-12 lg:py-16 bg-black">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8">

        <div className="text-center mb-12">
          <Title>Performance</Title>
        </div>

        {/* controls above chart on mobile, 1/3+2/3 from md */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:items-stretch">

          {/* Controls — 1 col */}
          <div className="md:col-span-1">
            <ChartControls
              pair={pair}
              onPair={setPair}
              fromMonth={fromMonth}
              onFrom={(m) => {
                setFromMonth(m)
                if (m >= toMonth) setToMonth(Math.min(m + 1, 11))
              }}
              toMonth={toMonth}
              onTo={(m) => {
                setToMonth(m)
                if (m <= fromMonth) setFromMonth(Math.max(m - 1, 0))
              }}
            />
          </div>

          {/* Chart — 2 cols */}
          <div className="md:col-span-2">
            <PerformanceChart
              data={chartData}
              strategyLabel="Strategy"
              marketLabel={marketLabel}
            />
          </div>

        </div>
      </div>
    </section>
  )
}
