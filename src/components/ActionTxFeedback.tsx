import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { shortenAddress } from '../utils/shortenAddress'
import { grsExplorerTxUrl, type GrsConfig } from '../grs/deployments'
import './ActionTxFeedback.css'

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
    return (
      <p className={`${base} is-error action-tx-feedback`} role="alert">
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
          title={errorCopied ? 'Copied to clipboard' : 'Copy error message'}
          aria-label={errorCopied ? 'Copied to clipboard' : 'Copy error message'}
        >
          {errorCopied ? 'Copied!' : error}
        </button>
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
