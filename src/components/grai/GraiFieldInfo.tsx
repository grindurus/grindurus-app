import { useState, type FocusEvent, type ReactNode } from 'react'
import { BALANCE_FIELD_ICON, FIELD_INFO_ICON } from './graiPageIcons'

export function GraiFieldInfoButton({
  hint,
  ariaLabel,
  structured = false,
  className,
  tooltipClassName,
  children,
}: {
  hint: ReactNode
  ariaLabel?: string
  structured?: boolean
  className?: string
  tooltipClassName?: string
  children?: ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)
  const accessibleLabel =
    ariaLabel ?? (typeof hint === 'string' ? hint : 'More information')

  const toggleOpen = () => {
    setIsOpen((open) => !open)
  }

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node)) {
      setIsOpen(false)
    }
  }

  return (
    <span className={`grai-field-info-wrap${className ? ` ${className}` : ''}${isOpen ? ' is-open' : ''}`}>
      {children ? (
        <span
          className="grai-field-info-trigger"
          tabIndex={0}
          role="button"
          aria-label={accessibleLabel}
          aria-expanded={isOpen}
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
          aria-expanded={isOpen}
          onClick={(event) => {
            event.stopPropagation()
            toggleOpen()
          }}
          onBlur={handleBlur}
        >
          {FIELD_INFO_ICON}
        </button>
      )}
      <span
        className={`grai-field-info-tooltip${structured ? ' is-structured' : ''}${tooltipClassName ? ` ${tooltipClassName}` : ''}`}
        role="tooltip"
      >
        {hint}
      </span>
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
