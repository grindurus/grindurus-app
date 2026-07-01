import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { FALLBACK_GRAI_ASSETS, type GraiAssetIcon } from '../grai/knownMints'
import { assetUrl } from '../utils/appPaths'
import './FloatingTokenBackground.css'

export type FloatingTokenSpec = {
  icon: GraiAssetIcon
  x: number
  y: number
  size: number
  delay: number
  duration: number
  rotate: number
}

const REVEAL_RADIUS = 210
const FULL_REVEAL_DISTANCE = 90
const FLOATING_TOKEN_COUNT = 22
const TOKEN_DRIFT_PX = 16
const TOKEN_MIST_BLEED_PX = 22
const FLOATING_BG_REFERENCE_HEIGHT = 380
const MIN_LAYOUT_WIDTH = 100
const MIN_LAYOUT_HEIGHT = 100

type FrozenLayout = { width: number; height: number }

function tokenCenterX(xPercent: number, layoutWidth: number): number {
  return (xPercent / 100) * layoutWidth
}

function tokenCenterY(yPercent: number): number {
  return (yPercent / 100) * FLOATING_BG_REFERENCE_HEIGHT
}

function tokenWithinBounds(
  token: { x: number; y: number; size: number },
  layoutWidth: number,
  layoutHeight: number,
): boolean {
  const centerX = tokenCenterX(token.x, layoutWidth)
  const centerY = tokenCenterY(token.y)
  const extent = (token.size / 2) * 1.22 + TOKEN_MIST_BLEED_PX + TOKEN_DRIFT_PX
  const pad = 3
  const boundsHeight = Math.min(layoutHeight, FLOATING_BG_REFERENCE_HEIGHT)

  return (
    centerX - extent >= pad &&
    centerX + extent <= layoutWidth - pad &&
    centerY - extent >= pad &&
    centerY + extent <= boundsHeight - pad
  )
}

function captureFrozenLayout(container: HTMLElement, current: FrozenLayout | null): FrozenLayout | null {
  if (current) return current
  const rect = container.getBoundingClientRect()
  if (rect.width < MIN_LAYOUT_WIDTH || rect.height < MIN_LAYOUT_HEIGHT) return null
  return { width: rect.width, height: rect.height }
}

function buildSpreadLayout(count: number) {
  const cols = 6
  const rows = Math.ceil(count / cols)
  const items: Array<{
    x: number
    y: number
    size: number
    delay: number
    duration: number
    rotate: number
  }> = []

  for (let i = 0; i < count; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const baseX = 6 + (col / Math.max(1, cols - 1)) * 88
    const baseY = 5 + (row / Math.max(1, rows - 1)) * 90
    const jitterX = Math.sin(i * 2.17 + 0.5) * 6
    const jitterY = Math.cos(i * 1.83 + 1.2) * 7

    items.push({
      x: Math.round(Math.min(94, Math.max(6, baseX + jitterX))),
      y: Math.round(Math.min(95, Math.max(5, baseY + jitterY))),
      size: 48 + (i % 7) * 5,
      delay: Number(((i * 0.47) % 4.8).toFixed(1)),
      duration: Number((19 + (i % 5) * 1.6).toFixed(1)),
      rotate: Number((Math.sin(i * 4.73 + 1.1) * 32).toFixed(1)),
    })
  }

  return items
}

const FLOATING_LAYOUT = buildSpreadLayout(FLOATING_TOKEN_COUNT)

export function buildFloatingTokens(icons: GraiAssetIcon[]): FloatingTokenSpec[] {
  const graiIcon: GraiAssetIcon = { src: assetUrl('logo.png'), alt: 'GRAI' }
  const unique = [...new Map(icons.map((icon) => [icon.src, icon])).values()].filter(
    (icon) => icon.src !== graiIcon.src,
  )
  const pool = [graiIcon, ...unique]
  if (pool.length === 0) return []

  return FLOATING_LAYOUT.map((layout, index) => {
    const stride = Math.max(1, Math.floor(pool.length / 2) + 1)
    const icon = pool[(index * stride) % pool.length]
    return { icon, ...layout }
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
  const frozenLayoutRef = useRef<FrozenLayout | null>(null)
  const [frozenLayout, setFrozenLayout] = useState<FrozenLayout | null>(null)

  const lockLayout = useCallback((container: HTMLElement) => {
    const next = captureFrozenLayout(container, frozenLayoutRef.current)
    if (!next || frozenLayoutRef.current) return frozenLayoutRef.current
    frozenLayoutRef.current = next
    setFrozenLayout(next)
    return next
  }, [])

  const applyReveal = useCallback(() => {
    const container = wrapRef.current
    const mouse = mouseRef.current
    if (!container) return

    const layout = lockLayout(container) ?? frozenLayoutRef.current
    if (!layout) return

    const rect = container.getBoundingClientRect()

    tokenRefs.current.forEach((el, index) => {
      if (!el) return
      const token = tokens[index]
      if (!token) return

      const tokenWrap = el.parentElement
      const fits = tokenWithinBounds(token, layout.width, layout.height)
      tokenWrap?.classList.toggle('is-clipped', !fits)

      if (!fits) {
        el.style.setProperty('--reveal', '0')
        el.classList.remove('is-revealed')
        return
      }

      const centerX = rect.left + tokenCenterX(token.x, layout.width)
      const centerY = rect.top + tokenCenterY(token.y)

      let reveal = 0
      if (mouse) {
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
  }, [tokens, lockLayout])

  const scheduleApply = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(applyReveal)
  }, [applyReveal])

  useEffect(() => {
    const container = wrapRef.current
    if (!container) return

    const tryLockLayout = () => {
      if (frozenLayoutRef.current) return
      const next = captureFrozenLayout(container, null)
      if (!next) return
      frozenLayoutRef.current = next
      setFrozenLayout(next)
      scheduleApply()
    }

    tryLockLayout()
    requestAnimationFrame(() => requestAnimationFrame(tryLockLayout))

    const observer = new ResizeObserver(() => {
      tryLockLayout()
      if (frozenLayoutRef.current) scheduleApply()
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(rafRef.current)
    }
  }, [scheduleApply])

  const onMouseMove = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      mouseRef.current = { x: event.clientX, y: event.clientY }
      scheduleApply()
    },
    [scheduleApply],
  )

  const onMouseLeave = useCallback(() => {
    mouseRef.current = null
    scheduleApply()
  }, [scheduleApply])

  const wrapClass = ['floating-token-bg-wrap', className].filter(Boolean).join(' ')

  return (
    <div
      ref={wrapRef}
      className={wrapClass}
      style={{ ['--floating-token-reference-height' as string]: `${FLOATING_BG_REFERENCE_HEIGHT}px` }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {tokens.length > 0 && frozenLayout && (
        <div className="floating-token-bg is-layout-ready" aria-hidden="true">
          {tokens.map((token, index) => (
            <div
              key={`${index}-${token.x}-${token.y}`}
              className="floating-token-bg__token"
              style={{
                left: `${tokenCenterX(token.x, frozenLayout.width)}px`,
                top: `${tokenCenterY(token.y)}px`,
                width: token.size,
                height: token.size,
                ['--float-delay' as string]: `${token.delay}s`,
                ['--float-duration' as string]: `${token.duration}s`,
                ['--token-rotate' as string]: `${token.rotate}deg`,
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
          ))}
        </div>
      )}
      <div className="floating-token-bg-content">{children}</div>
    </div>
  )
}
