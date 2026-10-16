import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { shortenAddress } from '../utils/shortenAddress'
import { grsExplorerTxUrl, type GrsConfig } from '../grs/deployments'
import { FIELD_INFO_ICON } from './grai/graiPageIcons'
import './ActionTxFeedback.css'

/**
 * Keep a short headline visible; stash viem "Request Arguments" / Contract Call dumps
 * for the info tooltip.
 */
export function splitTxErrorMessage(error: string): { summary: string; details: string | null } {
  const trimmed = error.trim()
  if (!trimmed) return { summary: 'Transaction failed', details: null }

  const requestArgsIdx = trimmed.search(/\bRequest Arguments\s*:/i)
  if (requestArgsIdx >= 0) {
    const summary = trimmed.slice(0, requestArgsIdx).trim() || 'User rejected the request.'
    return { summary, details: trimmed.slice(requestArgsIdx).trim() }
  }

  const contractCallIdx = trimmed.search(/\bContract Call\s*:/i)
  if (contractCallIdx > 0) {
    return {
      summary: trimmed.slice(0, contractCallIdx).trim(),
      details: trimmed.slice(contractCallIdx).trim(),
    }
  }

  if (trimmed.length > 160) {
    const firstSentence = trimmed.match(/^(.+?[.!?])(?:\s|$)/)
    if (firstSentence?.[1] && firstSentence[1].length <= 140) {
      return { summary: firstSentence[1], details: trimmed }
    }
  }

  return { summary: trimmed, details: null }
}

const EXPLORER_ICON = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M14 5h5v5" />
    <path d="M10 14 19 5" />
    <path d="M19 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4" />
  </svg>
)

/** Prefer clipboard API; fall back for non-secure contexts. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.left = '-9999px'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(area)
      return ok
    } catch {
      return false
    }
  }
}

/** Pull a Solana signature or EVM tx hash out of free-form RPC / wallet errors. */
export function extractTxHashFromText(text: string): string | null {
  const evm = text.match(/0x[a-fA-F0-9]{64}\b/)
  if (evm) return evm[0]
  const sol = text.match(/\b[1-9A-HJ-NP-Za-km-z]{80,90}\b/)
  return sol?.[0] ?? null
}

export type PersistedActionTx = {
  hash: string
  href: string | null
  successLabel?: string
  linkLabel?: string
}

export function usePersistedActionTx() {
  const [lastTx, setLastTx] = useState<PersistedActionTx | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)

  const begin = useCallback(() => {
    setLastTx(null)
    setLastError(null)
  }, [])

  const succeed = useCallback((tx: PersistedActionTx) => {
    setLastTx(tx)
    setLastError(null)
  }, [])

  const fail = useCallback((error: unknown, fallback = 'Transaction failed') => {
    setLastError(error instanceof Error ? error.message : fallback)
  }, [])

  const clear = useCallback(() => {
    setLastTx(null)
    setLastError(null)
  }, [])

  return { lastTx, lastError, begin, succeed, fail, clear }
}

/** Portaled tooltip above the icon — parent cards use overflow:hidden, so CSS hover tooltips clip. */
function ErrorDetailsInfo({ details }: { details: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<number | null>(null)
  const selectingRef = useRef(false)

  const updatePosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const maxWidth = Math.min(window.innerWidth - 16, 352)
    let left = rect.left + rect.width / 2
    left = Math.min(window.innerWidth - maxWidth / 2 - 8, Math.max(maxWidth / 2 + 8, left))
    setMenuStyle({
      position: 'fixed',
      left,
      bottom: window.innerHeight - rect.top + 8,
      transform: 'translateX(-50%)',
      width: maxWidth,
      zIndex: 240,
    })
  }, [])

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const tipHasSelection = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return false
    const tip = tipRef.current
    if (!tip) return false
    const anchor = selection.anchorNode
    const focus = selection.focusNode
    return Boolean((anchor && tip.contains(anchor)) || (focus && tip.contains(focus)))
  }, [])

  const openTip = useCallback(() => {
    cancelClose()
    updatePosition()
    setOpen(true)
  }, [cancelClose, updatePosition])

  const scheduleClose = useCallback(() => {
    cancelClose()
    closeTimerRef.current = window.setTimeout(() => {
      if (selectingRef.current || tipHasSelection()) {
        closeTimerRef.current = null
        return
      }
      setOpen(false)
      closeTimerRef.current = null
    }, 220)
  }, [cancelClose, tipHasSelection])

  useEffect(() => () => cancelClose(), [cancelClose])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || tipRef.current?.contains(target)) return
      setOpen(false)
    }
    const onPointerUp = () => {
      selectingRef.current = false
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('pointerup', onPointerUp)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('pointerup', onPointerUp)
    }
  }, [open])

  useEffect(() => {
    if (!open) setCopied(false)
  }, [open])

  const tip = open
    ? createPortal(
        <div
          ref={tipRef}
          className="action-tx-feedback-error-tooltip-portal"
          style={menuStyle}
          role="tooltip"
          onMouseEnter={openTip}
          onMouseLeave={scheduleClose}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => {
            event.stopPropagation()
            selectingRef.current = true
            cancelClose()
          }}
        >
          <div className="action-tx-feedback-error-tooltip-toolbar">
            <button
              type="button"
              className={`action-tx-feedback-error-copy-btn${copied ? ' is-copied' : ''}`}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void copyTextToClipboard(details).then((ok) => {
                  if (!ok) return
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 1500)
                })
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="action-tx-feedback-error-details" tabIndex={0}>
            {details}
          </pre>
        </div>,
        document.body,
      )
    : null

  return (
    <span className="action-tx-feedback-error-info">
      <button
        ref={buttonRef}
        type="button"
        className={`action-tx-feedback-error-info-btn${open ? ' is-open' : ''}`}
        aria-label="Request arguments and error details"
        aria-expanded={open}
        title="Show request arguments"
        onMouseEnter={openTip}
        onMouseLeave={scheduleClose}
        onFocus={openTip}
        onBlur={(event) => {
          if (tipRef.current?.contains(event.relatedTarget as Node)) return
          scheduleClose()
        }}
        onClick={(event) => {
          // Never bubble to the summary "copy error" control.
          event.preventDefault()
          event.stopPropagation()
          cancelClose()
          updatePosition()
          setOpen((value) => !value)
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {FIELD_INFO_ICON}
      </button>
      {tip}
    </span>
  )
}

function TxHashActions({
  hash,
  href,
  linkLabel,
}: {
  hash: string
  href: string | null
  linkLabel?: string
}) {
  const [copied, setCopied] = useState(false)
  const short = shortenAddress(hash)

  useEffect(() => {
    setCopied(false)
  }, [hash])

  return (
    <span className="action-tx-feedback-actions">
      <button
        type="button"
        className={`action-tx-feedback-hash${copied ? ' is-copied' : ''}`}
        onClick={() => {
          void copyTextToClipboard(hash).then((ok) => {
            if (!ok) return
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
          })
        }}
        title={copied ? 'Copied to clipboard' : `Copy ${hash}`}
        aria-label={copied ? 'Copied to clipboard' : `Copy transaction ${short}`}
      >
        {copied ? 'Copied!' : short}
      </button>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="action-tx-feedback-explorer"
          title={linkLabel ?? 'View transaction'}
          aria-label={linkLabel ?? 'View transaction on explorer'}
        >
          {EXPLORER_ICON}
          <span>{linkLabel ?? 'View'}</span>
        </a>
      ) : null}
    </span>
  )
}

export type ActionTxFeedbackProps = {
  isPending: boolean
  pendingLabel: string
  error: string | null
  hash: string | null
  chainId?: number
  config?: GrsConfig | null
  successLabel: string
  /** Override explorer URL (e.g. LayerZero Scan for bridge). */
  txHref?: string | null
  linkLabel?: string
  className?: string
}

export function ActionTxFeedback({
  isPending,
  pendingLabel,
  error,
  hash,
  chainId,
  config,
  successLabel,
  txHref,
  linkLabel,
  className,
}: ActionTxFeedbackProps): ReactNode {
  const [errorCopied, setErrorCopied] = useState(false)
  const base = className ?? 'grai-manage-feedback'

  const resolveHref = (txHash: string) =>
    txHref ??
    (config
      ? grsExplorerTxUrl(config, txHash)
      : chainId
        ? grsExplorerTxUrl(chainId, txHash)
        : null)

  if (isPending) {
    return <p className={`${base} is-pending`}>{pendingLabel}</p>
  }

  if (error) {
    const embedded = hash ?? extractTxHashFromText(error)
    const href = embedded ? resolveHref(embedded) : null
    const { summary, details } = splitTxErrorMessage(error)
    return (
      <p className={`${base} is-error action-tx-feedback`} role="alert">
        <span className="action-tx-feedback-error-row">
          <button
            type="button"
            className={`action-tx-feedback-error-text${errorCopied ? ' is-copied' : ''}`}
            onClick={() => {
              void copyTextToClipboard(error).then((ok) => {
                if (!ok) return
                setErrorCopied(true)
                window.setTimeout(() => setErrorCopied(false), 1500)
              })
            }}
            title={errorCopied ? 'Copied to clipboard' : 'Copy full error message'}
            aria-label={errorCopied ? 'Copied to clipboard' : 'Copy full error message'}
          >
            {errorCopied ? 'Copied!' : summary}
          </button>
          {details ? <ErrorDetailsInfo details={details} /> : null}
        </span>
        {embedded ? <TxHashActions hash={embedded} href={href} linkLabel={linkLabel} /> : null}
      </p>
    )
  }

  if (hash) {
    return (
      <p className={`${base} is-success action-tx-feedback`} role="status">
        <span className="action-tx-feedback-label">{successLabel}</span>
        <TxHashActions hash={hash} href={resolveHref(hash)} linkLabel={linkLabel} />
      </p>
    )
  }

  return null
}

/** Idle copy under the submit button, replaced by tx status when present. */
export function ActionDepositNote({
  isPending,
  pendingLabel,
  error,
  hash,
  successLabel,
  txHref,
  linkLabel,
  config,
  chainId,
  children,
}: ActionTxFeedbackProps & { children?: ReactNode }) {
  const showFeedback = Boolean(isPending || error || hash)
  return (
    <div className="grai-action-deposit-notes">
      {showFeedback ? (
        <ActionTxFeedback
          className="grai-action-deposit-note"
          isPending={isPending}
          pendingLabel={pendingLabel}
          error={error}
          hash={hash}
          successLabel={successLabel}
          txHref={txHref}
          linkLabel={linkLabel}
          config={config}
          chainId={chainId}
        />
      ) : children ? (
        <p className="grai-action-deposit-note">{children}</p>
      ) : null}
    </div>
  )
}
