import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { BALANCE_FIELD_ICON, FIELD_INFO_ICON } from './graiPageIcons'

type TooltipCoords = {
  top: number
  left: number
  maxWidth: number
}

export function GraiFieldInfoButton({
  hint,
  ariaLabel,
  structured = false,
  className,
  tooltipClassName,
  interactive = true,
  children,
}: {
  hint: ReactNode
  ariaLabel?: string
  structured?: boolean
  className?: string
  tooltipClassName?: string
  /** When false, render children only (no tooltip / trigger). */
  interactive?: boolean
  children?: ReactNode
}) {
  const wrapRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const closeTimerRef = useRef<number | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [coords, setCoords] = useState<TooltipCoords | null>(null)

  const accessibleLabel =
    ariaLabel ?? (typeof hint === 'string' ? hint : 'More information')
  const visible = isOpen || isHovered

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const scheduleHoverClose = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      setIsHovered(false)
      closeTimerRef.current = null
    }, 140)
  }, [clearCloseTimer])

  const openHover = useCallback(() => {
    clearCloseTimer()
    setIsHovered(true)
  }, [clearCloseTimer])

  const updatePosition = useCallback(() => {
    const wrap = wrapRef.current
    const tip = tooltipRef.current
    if (!wrap || !tip) return

    const trigger = wrap.getBoundingClientRect()
    const tipRect = tip.getBoundingClientRect()
    const gap = 10
    const pad = 8
    const maxWidth = Math.min(structured ? 22 * 16 : 18 * 16, window.innerWidth - pad * 2)

    let top = trigger.bottom + gap
    if (top + tipRect.height > window.innerHeight - pad) {
      top = Math.max(pad, trigger.top - tipRect.height - gap)
    }

    // Prefer left-align for structured hints (metric rows); otherwise center on trigger.
    let left = structured
      ? trigger.left
      : trigger.left + trigger.width / 2 - tipRect.width / 2
    left = Math.max(pad, Math.min(left, window.innerWidth - tipRect.width - pad))

    setCoords({ top, left, maxWidth })
  }, [structured])

  useLayoutEffect(() => {
    if (!visible) {
      setCoords(null)
      return
    }
    updatePosition()
  }, [visible, hint, updatePosition])

  useEffect(() => {
    if (!visible) return

    const onReposition = () => updatePosition()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [visible, updatePosition])

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer])

  if (!interactive) {
    if (children) {
      return <span className={className}>{children}</span>
    }
    return null
  }

  const toggleOpen = () => {
    setIsOpen((open) => !open)
  }

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget as Node | null
    if (wrapRef.current?.contains(next) || tooltipRef.current?.contains(next)) {
      return
    }
    setIsOpen(false)
  }

  const measureMaxWidth = Math.min(structured ? 22 * 16 : 18 * 16, typeof window !== 'undefined' ? window.innerWidth - 16 : 22 * 16)
  const tooltipStyle: CSSProperties = coords
    ? {
        top: coords.top,
        left: coords.left,
        maxWidth: coords.maxWidth,
      }
    : {
        // Measure off-screen before first paint to avoid a flash at 0,0.
        top: -9999,
        left: -9999,
        maxWidth: measureMaxWidth,
        visibility: 'hidden',
      }

  const tooltip = visible
    ? createPortal(
        <span
          ref={tooltipRef}
          className={`grai-field-info-tooltip is-portaled${structured ? ' is-structured' : ''}${
            tooltipClassName ? ` ${tooltipClassName}` : ''
          }`}
          role="tooltip"
          style={tooltipStyle}
          onMouseEnter={openHover}
          onMouseLeave={scheduleHoverClose}
        >
          {hint}
        </span>,
        document.body,
      )
    : null

  return (
    <span
      ref={wrapRef}
      className={`grai-field-info-wrap${className ? ` ${className}` : ''}${visible ? ' is-open' : ''}`}
      onMouseEnter={openHover}
      onMouseLeave={scheduleHoverClose}
    >
      {children ? (
        <span
          className="grai-field-info-trigger"
          tabIndex={0}
          role="button"
          aria-label={accessibleLabel}
          aria-expanded={visible}
          onClick={(event) => {
            event.stopPropagation()
            toggleOpen()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              toggleOpen()
            }
          }}
          onBlur={handleBlur}
        >
          {children}
        </span>
      ) : (
        <button
          type="button"
          className="grai-field-info-btn"
          aria-label={accessibleLabel}
          aria-expanded={visible}
          onClick={(event) => {
            event.stopPropagation()
            toggleOpen()
          }}
          onBlur={handleBlur}
        >
          {FIELD_INFO_ICON}
        </button>
      )}
      {tooltip}
    </span>
  )
}

export function GraiBalanceFieldLabel({ hint }: { hint: string }) {
  return (
    <span className="grai-balance-field-label-wrap">
      <span className="grai-field-label grai-field-label--with-icon">
        <span className="grai-field-label-icon">{BALANCE_FIELD_ICON}</span>
        Balance
      </span>
      <GraiFieldInfoButton hint={hint} />
    </span>
  )
}
