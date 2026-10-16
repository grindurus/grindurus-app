import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import {
  formatProjectedYieldPct,
  formatVolatilityPct,
  lookupGraiAssetYieldMetrics,
} from '../grai/assetYieldMetrics'
import { FALLBACK_GRAI_ASSETS, type GraiAssetIcon } from '../grai/knownMints'
import { assetUrl } from '../utils/appPaths'
import './FloatingTokenBackground.css'

export type FloatingTokenSpec = {
  icon: GraiAssetIcon
  symbol: string
  x: number
  y: number
  size: number
  delay: number
  duration: number
  rotate: number
}

const REVEAL_RADIUS = 210
const FULL_REVEAL_DISTANCE = 90
const FLOATING_TOKEN_COUNT = 6
const TOKEN_MIST_BLEED_PX = 22
const FLOATING_BG_REFERENCE_HEIGHT = 380
const MIN_LAYOUT_WIDTH = 100
const MIN_LAYOUT_HEIGHT = 100

type LayoutSize = { width: number; height: number }

function tokenCenterX(xPercent: number, layoutWidth: number): number {
  return (xPercent / 100) * layoutWidth
}

function tokenCenterY(yPercent: number): number {
  return (yPercent / 100) * FLOATING_BG_REFERENCE_HEIGHT
}

function readLayoutSize(container: HTMLElement): LayoutSize | null {
  const rect = container.getBoundingClientRect()
  if (rect.width < MIN_LAYOUT_WIDTH || rect.height < MIN_LAYOUT_HEIGHT) return null
  return { width: rect.width, height: rect.height }
}

/** 3 in the left gutter + 3 in the right — keeps tokens clear of the center form. */
function buildSpreadLayout(count: number) {
  const leftXs = [11, 8, 13]
  const rightXs = [89, 92, 87]
  const ys = [24, 50, 76]
  const perSide = Math.ceil(count / 2)
  const items: Array<{
    x: number
    y: number
    size: number
    delay: number
    duration: number
    rotate: number
  }> = []

  for (let i = 0; i < count; i++) {
    const onLeft = i < perSide
    const sideIndex = onLeft ? i : i - perSide
    const xBase = onLeft ? leftXs[sideIndex % leftXs.length]! : rightXs[sideIndex % rightXs.length]!
    const yBase = ys[sideIndex % ys.length]!
    const jitterX = Math.sin(i * 2.17 + 0.5) * 1.5
    const jitterY = Math.cos(i * 1.83 + 1.2) * 2.5

    items.push({
      x: Math.round(Math.min(94, Math.max(6, xBase + jitterX))),
      y: Math.round(Math.min(88, Math.max(14, yBase + jitterY))),
      size: 46 + (sideIndex % 3) * 6,
      delay: Number(((i * 0.47) % 4.8).toFixed(1)),
      duration: Number((19 + (i % 5) * 1.6).toFixed(1)),
      rotate: Number((Math.sin(i * 4.73 + 1.1) * 28).toFixed(1)),
    })
  }

  return items
}

const FLOATING_LAYOUT = buildSpreadLayout(FLOATING_TOKEN_COUNT)

export function buildFloatingTokens(icons: GraiAssetIcon[]): FloatingTokenSpec[] {
  const graiIcon: GraiAssetIcon = { src: assetUrl('grai.png'), alt: 'GRAI' }
  const usdtFromInput = icons.find((icon) => icon.alt.toUpperCase() === 'USDT')
  const usdtIcon: GraiAssetIcon = usdtFromInput ?? {
    src: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
    alt: 'USDT',
  }
  const unique = [...new Map(icons.map((icon) => [icon.src, icon])).values()].filter(
    (icon) =>
      icon.src !== graiIcon.src &&
      icon.src !== usdtIcon.src &&
      icon.alt.toUpperCase() !== 'GRAI' &&
      icon.alt.toUpperCase() !== 'USDT',
  )
  // Keep GRAI + USDT on the mist background and weight them higher than the rest.
  const pool = [graiIcon, usdtIcon, ...unique, graiIcon, usdtIcon]
  if (pool.length === 0) return []

  return FLOATING_LAYOUT.map((layout, index) => {
    const icon = pool[index % pool.length]!
    const symbol = (icon.alt || 'TOKEN').toUpperCase()
    return { icon, symbol, ...layout }
  })
}

export const STABLE_FLOATING_TOKENS: FloatingTokenSpec[] = buildFloatingTokens(
  FALLBACK_GRAI_ASSETS.map((asset) => asset.icon),
)

type FloatingTokenBackgroundProps = {
  tokens: FloatingTokenSpec[]
  className?: string
  children: ReactNode
}

export function FloatingTokenBackground({ tokens, className, children }: FloatingTokenBackgroundProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const tokenRefs = useRef<(HTMLDivElement | null)[]>([])
  const rafRef = useRef(0)
  const mouseRef = useRef<{ x: number; y: number } | null>(null)
  const hoveredIndexRef = useRef<number | null>(null)
  const layoutRef = useRef<LayoutSize | null>(null)
  const [layout, setLayout] = useState<LayoutSize | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const syncLayout = useCallback((container: HTMLElement) => {
    const next = readLayoutSize(container)
    if (!next) return null
    const prev = layoutRef.current
    if (
      prev &&
      Math.abs(prev.width - next.width) < 0.5 &&
      Math.abs(prev.height - next.height) < 0.5
    ) {
      return prev
    }
    layoutRef.current = next
    setLayout(next)
    return next
  }, [])

  const applyReveal = useCallback(() => {
    const container = wrapRef.current
    const mouse = mouseRef.current
    if (!container) return

    const measured = syncLayout(container) ?? layoutRef.current
    if (!measured) return

    const rect = container.getBoundingClientRect()
    const occluders = Array.from(
      container.querySelectorAll<HTMLElement>(
        '.grai-actions-block, .grai-action-card, .grai-page-meta',
      ),
    ).map((el) => el.getBoundingClientRect())

    tokenRefs.current.forEach((el, index) => {
      if (!el) return
      const token = tokens[index]
      if (!token) return

      const tokenWrap = el.parentElement
      // Always scale X with the live container width so resize keeps gutters visible.
      const centerX = rect.left + tokenCenterX(token.x, rect.width)
      const centerY = rect.top + tokenCenterY(token.y)
      const half = token.size / 2 + TOKEN_MIST_BLEED_PX * 0.35
      const behindForm = occluders.some(
        (box) =>
          centerX + half >= box.left &&
          centerX - half <= box.right &&
          centerY + half >= box.top &&
          centerY - half <= box.bottom,
      )
      // Only hide tokens covered by the deposit card — never drop them on window resize.
      tokenWrap?.classList.toggle('is-clipped', behindForm)

      if (behindForm) {
        el.style.setProperty('--reveal', '0')
        el.classList.remove('is-revealed')
        return
      }

      let reveal = 0
      if (hoveredIndexRef.current === index) {
        reveal = 1
      } else if (mouse) {
        const distance = Math.hypot(mouse.x - centerX, mouse.y - centerY)
        if (distance <= FULL_REVEAL_DISTANCE) {
          reveal = 1
        } else {
          const proximity = Math.max(0, 1 - distance / REVEAL_RADIUS)
          reveal = proximity * proximity * proximity
        }
      }

      el.style.setProperty('--reveal', reveal.toFixed(3))
      el.classList.toggle('is-revealed', reveal >= 0.92)
    })
  }, [tokens, syncLayout])

  const scheduleApply = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(applyReveal)
  }, [applyReveal])

  useEffect(() => {
    const container = wrapRef.current
    if (!container) return

    const refresh = () => {
      syncLayout(container)
      scheduleApply()
    }

    refresh()
    requestAnimationFrame(() => requestAnimationFrame(refresh))

    const observer = new ResizeObserver(() => {
      refresh()
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(rafRef.current)
    }
  }, [scheduleApply, syncLayout])

  const onMouseMove = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      mouseRef.current = { x: event.clientX, y: event.clientY }
      scheduleApply()
    },
    [scheduleApply],
  )

  const onMouseLeave = useCallback(() => {
    mouseRef.current = null
    hoveredIndexRef.current = null
    setHoveredIndex(null)
    scheduleApply()
  }, [scheduleApply])

  const hoveredToken = hoveredIndex == null ? null : tokens[hoveredIndex] ?? null
  const hoveredMetrics = useMemo(
    () => (hoveredToken ? lookupGraiAssetYieldMetrics(hoveredToken.symbol) : null),
    [hoveredToken],
  )
  const tooltipSide = hoveredToken && hoveredToken.x >= 50 ? 'right' : 'left'
  const tooltipStyle =
    hoveredToken && layout
      ? {
          left: `${
            tokenCenterX(hoveredToken.x, layout.width) +
            (tooltipSide === 'left' ? hoveredToken.size / 2 + 12 : -(hoveredToken.size / 2 + 12))
          }px`,
          top: `${tokenCenterY(hoveredToken.y)}px`,
        }
      : undefined

  const wrapClass = ['floating-token-bg-wrap', className].filter(Boolean).join(' ')

  return (
    <div
      ref={wrapRef}
      className={wrapClass}
      style={{ ['--floating-token-reference-height' as string]: `${FLOATING_BG_REFERENCE_HEIGHT}px` }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {tokens.length > 0 && layout && (
        <div className="floating-token-bg is-layout-ready">
          {tokens.map((token, index) => {
            const isHovered = hoveredIndex === index
            return (
              <div
                key={`${index}-${token.x}-${token.y}`}
                className={`floating-token-bg__token${isHovered ? ' is-hovered' : ''}`}
                style={{
                  left: `${token.x}%`,
                  top: `${tokenCenterY(token.y)}px`,
                  width: token.size,
                  height: token.size,
                  ['--float-delay' as string]: `${token.delay}s`,
                  ['--float-duration' as string]: `${token.duration}s`,
                  ['--token-rotate' as string]: `${token.rotate}deg`,
                }}
                onMouseEnter={() => {
                  hoveredIndexRef.current = index
                  setHoveredIndex(index)
                  scheduleApply()
                }}
                onMouseLeave={() => {
                  if (hoveredIndexRef.current === index) {
                    hoveredIndexRef.current = null
                    setHoveredIndex(null)
                    scheduleApply()
                  }
                }}
              >
                <div
                  ref={(el) => {
                    tokenRefs.current[index] = el
                  }}
                  className="floating-token-bg__token-inner"
                >
                  <img
                    className="floating-token-bg__img"
                    src={token.icon.src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
      {hoveredToken && tooltipStyle ? (
        <div
          className={`floating-token-bg__tooltip is-${tooltipSide}`}
          style={tooltipStyle}
          role="tooltip"
        >
          <div className="floating-token-bg__tooltip-ticker">{hoveredToken.symbol}</div>
          <div className="floating-token-bg__tooltip-row">
            <span>Avg. Volatility</span>
            <strong>
              {hoveredMetrics ? formatVolatilityPct(hoveredMetrics.volatilityPct) : '—'}
            </strong>
          </div>
          <div className="floating-token-bg__tooltip-row">
            <span>Indexed Yield</span>
            <strong className="is-yield">
              {hoveredMetrics
                ? formatProjectedYieldPct(hoveredMetrics.projectedAnnualYieldPct)
                : '—'}
            </strong>
          </div>
        </div>
      ) : null}
      <div className="floating-token-bg-content">{children}</div>
    </div>
  )
}
