import { useEffect, useRef, useState } from 'react'
import {
  TOKEN_AD_SLOTS,
  TOKEN_AD_SLOTS_MOBILE,
  formatAdPct,
  type TokenAdSlot,
} from '../../../constants/tokens'

/** Radians per second — full lap ≈ 90s */
const ORBIT_SPEED = (Math.PI * 2) / 90

function MetricRow({
  label,
  value,
  accent,
  compact,
}: {
  label: string
  value: string
  accent?: boolean
  compact?: boolean
}) {
  return (
    <div className="flex flex-col leading-tight gap-0.5">
      <span
        className={`uppercase tracking-[0.04em] text-white/45 whitespace-nowrap ${
          compact ? 'text-[8px]' : 'text-[9px] sm:text-[10px]'
        }`}
      >
        {label}
      </span>
      <span
        className={`font-semibold tabular-nums whitespace-nowrap ${
          compact ? 'text-[10px]' : 'text-[11px] sm:text-[12px]'
        } ${accent ? 'text-brand-pink' : 'text-white/85'}`}
      >
        {value}
      </span>
    </div>
  )
}

function TokenAdSlotItem({
  slot,
  compact,
  active,
  itemRef,
  metricsRef,
  onEnter,
  onLeave,
  onSelect,
}: {
  slot: TokenAdSlot
  compact?: boolean
  active: boolean
  itemRef: (el: HTMLDivElement | null) => void
  metricsRef: (el: HTMLDivElement | null) => void
  onEnter: () => void
  onLeave: () => void
  onSelect: () => void
}) {
  const iconSize = compact ? 'clamp(40px, 11vw, 52px)' : 'clamp(56px, 5.5vw, 88px)'

  return (
    <div
      ref={itemRef}
      className="absolute group/slot"
      style={{
        left: slot.left,
        top: slot.top,
        width: iconSize,
        height: iconSize,
        transform: 'translate(-50%, -50%)',
        willChange: 'left, top',
        zIndex: active ? 5 : 1,
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-pressed={active}
      aria-label={`${slot.symbol} ad metrics`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      <div
        className="absolute rounded-full cursor-pointer"
        style={{ inset: compact ? -10 : -14 }}
        aria-hidden
      />

      <div
        className={`
          pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
          rounded-full border border-[#9ca3af]/60
          w-[128%] h-[128%]
          transition-all duration-200 ease-out
          ${active ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
        `}
        aria-hidden
      />

      <div
        className={`
          token-ad-icon relative flex items-center justify-center w-full h-full
          rounded-full overflow-hidden
          shadow-[0_2px_20px_rgba(0,0,0,0.35)]
          transition-transform duration-200 ease-out
          cursor-pointer
          ${slot.iconBg === 'black' ? 'bg-black' : 'bg-white'}
          ${active ? 'scale-110' : 'scale-100'}
        `}
        title={`${slot.symbol} ad slot`}
      >
        <img
          src={slot.src}
          alt={slot.symbol}
          draggable={false}
          className="object-contain pointer-events-none"
          style={{
            width: `${(slot.imgSize ?? 1) * 100}%`,
            height: `${(slot.imgSize ?? 1) * 100}%`,
          }}
        />
      </div>

      <span
        className={`
          absolute left-1/2 -translate-x-1/2 top-full mt-1.5
          font-mono font-bold uppercase tracking-[0.08em] whitespace-nowrap
          text-[10px] sm:text-[11px] text-white/90
          [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]
          pointer-events-none
          transition-opacity duration-200 ease-out
          ${active || compact ? 'opacity-100' : 'opacity-0'}
        `}
      >
        {slot.symbol}
      </span>

      <div
        ref={metricsRef}
        className={`
          absolute top-1/2 -translate-y-1/2 flex flex-col font-mono pointer-events-none
          transition-opacity duration-200 ease-out
          ${compact ? 'gap-1' : 'gap-1.5'}
          ${active ? 'opacity-100' : 'opacity-0'}
        `}
        style={
          slot.metricsSide === 'left'
            ? {
                right: '100%',
                marginRight: compact ? 10 : 12,
                left: 'auto',
                alignItems: 'flex-end',
                textAlign: 'right',
              }
            : {
                left: '100%',
                marginLeft: compact ? 10 : 12,
                right: 'auto',
                alignItems: 'flex-start',
                textAlign: 'left',
              }
        }
      >
        <MetricRow
          label="Daily Price Volatility"
          value={formatAdPct(slot.dailyVolatilityPct)}
          compact={compact}
        />
        <MetricRow
          label="Annual Price Volatility"
          value={formatAdPct(slot.annualVolatilityPct)}
          compact={compact}
        />
        <MetricRow
          label="Indexed Yield"
          value={formatAdPct(slot.priceVolatilityYieldPct, true)}
          accent
          compact={compact}
        />
      </div>
    </div>
  )
}

/**
 * Hero background as a token ad banner.
 * Tokens slowly orbit an oval; metrics + ring appear on hover/tap (orbit pauses while active).
 */
export function TokenAdBanner({ contained = false }: { contained?: boolean }) {
  const slots = contained ? TOKEN_AD_SLOTS_MOBILE : TOKEN_AD_SLOTS
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const metricsRefs = useRef<(HTMLDivElement | null)[]>([])
  const rafRef = useRef(0)
  const startRef = useRef(0)
  const frozenElapsedRef = useRef(0)
  const pausedRef = useRef(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    // Mobile keeps a rotating highlight for discoverability — don't freeze the orbit.
    pausedRef.current = !contained && activeId !== null
  }, [activeId, contained])

  // Mobile has no hover — keep one slot highlighted so metrics stay discoverable.
  useEffect(() => {
    if (!contained || slots.length === 0) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setActiveId(slots[0]?.id ?? null)
      return
    }

    setActiveId((cur) => cur ?? slots[0]?.id ?? null)
    const id = window.setInterval(() => {
      setActiveId((cur) => {
        const idx = slots.findIndex((s) => s.id === cur)
        const next = slots[(idx + 1 + slots.length) % slots.length]
        return next?.id ?? null
      })
    }, 3200)
    return () => clearInterval(id)
  }, [contained, slots])

  useEffect(() => {
    const n = slots.length
    if (!n) return

    const baseAngles = Array.from({ length: n }, (_, i) => -Math.PI / 2 + (2 * Math.PI * i) / n)

    const rx = contained ? 38 : 46
    const ry = contained ? 34 : 40
    const cx = 50
    const cy = 50
    const gap = contained ? 8 : 12

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function place(angles: number[]) {
      for (let i = 0; i < n; i++) {
        const el = itemRefs.current[i]
        const metrics = metricsRefs.current[i]
        if (!el) continue

        const t = angles[i]
        const cos = Math.cos(t)
        const sin = Math.sin(t)
        el.style.left = `${cx + rx * cos}%`
        el.style.top = `${cy + ry * sin}%`

        if (metrics) {
          const onLeft = cos >= 0
          if (onLeft) {
            metrics.style.right = '100%'
            metrics.style.left = 'auto'
            metrics.style.marginRight = `${gap}px`
            metrics.style.marginLeft = '0'
            metrics.style.alignItems = 'flex-end'
            metrics.style.textAlign = 'right'
          } else {
            metrics.style.left = '100%'
            metrics.style.right = 'auto'
            metrics.style.marginLeft = `${gap}px`
            metrics.style.marginRight = '0'
            metrics.style.alignItems = 'flex-start'
            metrics.style.textAlign = 'left'
          }
        }
      }
    }

    if (prefersReduced) {
      place(baseAngles)
      return
    }

    frozenElapsedRef.current = 0
    startRef.current = performance.now()
    let wasPaused = false

    function step(now: number) {
      if (pausedRef.current) {
        if (!wasPaused) {
          frozenElapsedRef.current += (now - startRef.current) / 1000
          wasPaused = true
        }
        const angles = baseAngles.map((a) => a + frozenElapsedRef.current * ORBIT_SPEED)
        place(angles)
      } else {
        if (wasPaused) {
          startRef.current = now
          wasPaused = false
        }
        const elapsed = frozenElapsedRef.current + (now - startRef.current) / 1000
        const angles = baseAngles.map((a) => a + elapsed * ORBIT_SPEED)
        place(angles)
      }
      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [slots, contained])

  return (
    <div
      className={
        contained
          ? 'relative z-0 w-full h-full overflow-visible isolate'
          : 'absolute inset-0 z-0 overflow-hidden isolate'
      }
      aria-label="Token advertising banner"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: contained
            ? 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(0,0,0,0.55) 0%, transparent 75%)'
            : 'radial-gradient(ellipse 55% 50% at 50% 45%, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.25) 55%, transparent 80%)',
        }}
      />

      <div
        className={`absolute opacity-90 ${
          contained ? 'inset-2' : 'inset-x-10 inset-y-12 lg:inset-x-14 lg:inset-y-14'
        }`}
      >
        {slots.map((slot, i) => (
          <TokenAdSlotItem
            key={slot.id}
            slot={slot}
            compact={contained}
            active={activeId === slot.id}
            itemRef={(el) => {
              itemRefs.current[i] = el
            }}
            metricsRef={(el) => {
              metricsRefs.current[i] = el
            }}
            onEnter={() => {
              if (!contained) setActiveId(slot.id)
            }}
            onLeave={() => {
              if (!contained) setActiveId((id) => (id === slot.id ? null : id))
            }}
            onSelect={() => setActiveId(slot.id)}
          />
        ))}
      </div>
    </div>
  )
}
