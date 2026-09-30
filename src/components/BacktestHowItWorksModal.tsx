import { useCallback, useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { GraiUiCaret } from './grai/GraiUiCaret'
import '../pages/BacktestPage.css'
import './HowItWorksModal.css'
import './BacktestHowItWorksModal.css'

const USDC_ICON = 'https://assets.coingecko.com/coins/images/6319/small/usdc.png'
const SOL_ICON = 'https://assets.coingecko.com/coins/images/4128/small/solana.png'

function MiniAssetIcon({ src, size = 18 }: { src: string; size?: number }) {
  return (
    <span className="backtest-pair-asset-icon" aria-hidden="true">
      <img src={src} alt="" width={size} height={size} />
    </span>
  )
}

function PreviewMetadata() {
  return (
    <div className="backtest-hiw-preview-frame backtest-hiw-preview-frame--create">
      <div className="backtest-dates">
        <div className="backtest-date-col">
          <span className="backtest-sublabel is-from">From</span>
          <div className="backtest-date-input-wrap">
            <span className="backtest-date-input backtest-hiw-fake-input">2026-09-01</span>
          </div>
        </div>
        <span className="backtest-date-sep" aria-hidden="true">
          –
        </span>
        <div className="backtest-date-col">
          <span className="backtest-sublabel is-to">To</span>
          <div className="backtest-date-input-wrap">
            <span className="backtest-date-input backtest-hiw-fake-input">2026-09-05</span>
          </div>
        </div>
      </div>
      <p className="backtest-date-limit-note">
        <span className="backtest-date-limit-note-label">Max period:</span>
        <span className="backtest-date-limit-note-value">5 days</span>
        <span className="backtest-date-limit-note-label">· UTC</span>
      </p>
      <div className="backtest-pair-card">
        <div className="backtest-pair-row">
          <div className="backtest-pair-col">
            <div className="backtest-pair-field">
              <span className="backtest-sublabel is-base">Base</span>
              <div className="backtest-pair-input-row">
                <div className="backtest-amount-with-action">
                  <span className="backtest-amount-input backtest-hiw-fake-amount">10.5</span>
                  <span className="backtest-amount-random-btn">RANDOM</span>
                </div>
                <div className="backtest-pair-asset-select-wrap">
                  <div className="backtest-pair-asset-trigger">
                    <span className="backtest-pair-asset-token">
                      <MiniAssetIcon src={SOL_ICON} />
                      <span className="backtest-amount-input backtest-pair-asset-input is-selected">
                        SOL
                      </span>
                    </span>
                    <span className="backtest-pair-asset-caret-btn">
                      <GraiUiCaret className="backtest-pair-asset-caret" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="backtest-pair-col">
            <div className="backtest-pair-field">
              <span className="backtest-sublabel is-quote">Quote</span>
              <div className="backtest-pair-input-row">
                <div className="backtest-amount-with-action">
                  <span className="backtest-amount-input backtest-hiw-fake-amount">3400</span>
                  <span className="backtest-amount-random-btn">RANDOM</span>
                </div>
                <div className="backtest-pair-asset-select-wrap">
                  <div className="backtest-pair-asset-trigger">
                    <span className="backtest-pair-asset-token">
                      <MiniAssetIcon src={USDC_ICON} />
                      <span className="backtest-amount-input backtest-pair-asset-input is-selected">
                        USDC
                      </span>
                    </span>
                    <span className="backtest-pair-asset-caret-btn">
                      <GraiUiCaret className="backtest-pair-asset-caret" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PreviewPay() {
  return (
    <div className="backtest-hiw-preview-frame backtest-hiw-preview-frame--pay">
      <div className="backtest-pay-block">
        <div className="backtest-pay-actions">
          <div className="backtest-pay-method-wrap">
            <span className="backtest-pay-method-caption">Payment method</span>
            <div className="backtest-pay-method-control">
              <span className="backtest-pay-method-btn">
                <span className="backtest-pay-method-label">x402</span>
                <GraiUiCaret className="backtest-pay-method-caret" />
              </span>
            </div>
          </div>
          <span className="backtest-pay-btn">
            <span className="backtest-pay-btn-usdc-label">
              Pay 1
              <img className="backtest-usdc-ticker-icon" src={USDC_ICON} alt="" width={14} height={14} />
              USDC
            </span>
          </span>
          <p className="backtest-time-estimate-note">
            <span className="backtest-time-estimate-note-line">
              After payment queues backtest’s to order.
            </span>
            <span className="backtest-time-estimate-note-line">
              Results appear when finished (~5&nbsp;min once started).
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

function PreviewQueue() {
  return (
    <div className="backtest-hiw-preview-frame backtest-hiw-preview-frame--queue">
      <div className="backtest-queue-view-switch">
        <span className="backtest-queue-view-btn is-queue is-active">Queue</span>
        <span className="backtest-queue-view-btn is-stack">Results</span>
      </div>
      <div className="backtest-queue-card backtest-queue-card--leader">
        <span className="backtest-queue-index">#1</span>
        <span className="backtest-queue-pair">ID: 8f2a…c91e</span>
        <div className="backtest-queue-grid">
          <span className="backtest-queue-date-start">
            <span className="backtest-queue-date-label">from</span>
            2026-09-01
          </span>
          <span className="backtest-queue-amt-base">10.5 SOL</span>
          <span className="backtest-queue-date-end">
            <span className="backtest-queue-date-label">to</span>
            2026-09-05
          </span>
          <span className="backtest-queue-amt-quote">3400 USDC</span>
        </div>
        <div className="backtest-queue-creator">
          <div className="backtest-queue-creator-top">
            <span className="backtest-queue-creator-label">Creator</span>
            <span className="backtest-queue-priority-label">BID</span>
          </div>
          <div className="backtest-queue-creator-bottom">
            <span className="backtest-queue-creator-main">
              <span className="backtest-queue-creator-addr">7xK…9mQ</span>
            </span>
            <span className="backtest-queue-priority-value">1 USDC</span>
          </div>
        </div>
        <div className="backtest-queue-executing" role="status">
          <span className="backtest-queue-executing-dot" aria-hidden />
          <span className="backtest-queue-executing-label">Executing…</span>
        </div>
      </div>
    </div>
  )
}

function PreviewResults() {
  return (
    <div className="backtest-hiw-preview-frame backtest-hiw-preview-frame--results">
      <div className="backtest-queue-view-switch">
        <span className="backtest-queue-view-btn is-queue">Queue</span>
        <span className="backtest-queue-view-btn is-stack is-active">Results</span>
      </div>
      <article className="backtest-history-card">
        <div className="backtest-history-main">
          <div className="backtest-history-headline">
            <div className="backtest-history-id-row">
              <span className="backtest-history-id">ID: 8f2a…c91e</span>
            </div>
            <div className="backtest-history-period-meta">
              <span className="backtest-history-index">#1</span>
            </div>
            <div className="backtest-history-period-range">
              <span>
                <span className="backtest-history-period-label">FROM</span>
                <span>2026-09-01</span>
              </span>
              <span>
                <span className="backtest-history-period-label">TO</span>
                <span>2026-09-05</span>
              </span>
              <div className="backtest-history-period-duration">
                <span className="backtest-history-period-label">PERIOD</span>
                <span>4d</span>
              </div>
            </div>
            <div className="backtest-history-pair">
              <span>
                <span className="backtest-history-pair-amount">10.5</span>
                <span className="backtest-history-pair-asset">SOL</span>
              </span>
              <span>
                <span className="backtest-history-pair-amount">3400</span>
                <span className="backtest-history-pair-asset">USDC</span>
              </span>
            </div>
          </div>
          <div className="backtest-history-meta">
            <span className="backtest-history-creator">7xK…9mQ</span>
            <div className="backtest-history-priority">
              <span className="backtest-history-priority-value">1</span>
              <img className="backtest-usdc-ticker-icon" src={USDC_ICON} alt="" width={11} height={11} />
              <span className="backtest-history-priority-unit">USDC</span>
            </div>
          </div>
        </div>
        <div className="backtest-history-stats">
          <div className="backtest-history-balances">
            <div className="backtest-history-balances-head" aria-hidden="true">
              <span />
              <span>End balance</span>
              <span className="backtest-history-pnl-head">PnL</span>
            </div>
            <div className="backtest-history-balances-row">
              <span className="backtest-history-balances-asset">SOL</span>
              <span className="backtest-history-balances-num">11.2</span>
              <span className="backtest-history-balances-num backtest-history-pnl-cell is-pnl-pos">
                <span className="backtest-history-pnl-amt">+0.7</span>
                <span className="backtest-history-pnl-pct">+6.7%</span>
              </span>
            </div>
            <div className="backtest-history-balances-row">
              <span className="backtest-history-balances-asset">USDC</span>
              <span className="backtest-history-balances-num">3612</span>
              <span className="backtest-history-balances-num backtest-history-pnl-cell is-pnl-pos">
                <span className="backtest-history-pnl-amt">+212</span>
                <span className="backtest-history-pnl-pct">+6.2%</span>
              </span>
            </div>
          </div>
        </div>
      </article>
    </div>
  )
}

const STEPS: Array<{ title: string; body: string; preview: ReactNode }> = [
  {
    title: 'Fill backtest metadata',
    body: 'Choose the period (from / to), base and quote assets, and starting amounts.',
    preview: <PreviewMetadata />,
  },
  {
    title: 'Pay or enter a promocode',
    body: 'Confirm with x402 from your wallet, or unlock the run with a promocode.',
    preview: <PreviewPay />,
  },
  {
    title: 'Backtest joins the queue',
    body: 'Your job is added to Queue and waits its turn — higher bids move up sooner.',
    preview: <PreviewQueue />,
  },
  {
    title: 'Results appear in Results',
    body: 'When the run finishes, open Results to see inventory, yield, and PnL.',
    preview: <PreviewResults />,
  },
]

type Props = {
  isOpen: boolean
  onClose: () => void
}

export function BacktestHowItWorksModal({ isOpen, onClose }: Props) {
  const backdropDismissArmedRef = useRef(false)

  useEffect(() => {
    if (!isOpen) {
      backdropDismissArmedRef.current = false
      return
    }

    backdropDismissArmedRef.current = false
    const armTimer = window.setTimeout(() => {
      backdropDismissArmedRef.current = true
    }, 300)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.clearTimeout(armTimer)
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, onClose])

  const handleBackdropClick = useCallback(
    (event: MouseEvent) => {
      if (!backdropDismissArmedRef.current) return
      if (event.target === event.currentTarget) onClose()
    },
    [onClose],
  )

  if (!isOpen) return null

  return createPortal(
    <div className="hiw-modal-backdrop" onClick={handleBackdropClick}>
      <div
        className="hiw-modal backtest-hiw-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backtest-hiw-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="hiw-modal-header">
          <h2 id="backtest-hiw-title" className="hiw-modal-title">
            How it works
          </h2>
          <button type="button" className="hiw-modal-close" onClick={onClose} aria-label="Close">
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="hiw-modal-body backtest-hiw-modal-body">
          <ol className="backtest-hiw-steps">
            {STEPS.map((step, index) => (
              <li key={step.title} className="backtest-hiw-step">
                <div className="backtest-hiw-step-art" aria-hidden="true">
                  <div className="backtest-hiw-preview">
                    <div className="backtest-hiw-preview-scale">{step.preview}</div>
                  </div>
                </div>
                <div className="backtest-hiw-step-copy">
                  <div className="backtest-hiw-step-heading">
                    <span className="backtest-hiw-step-index">{index + 1}</span>
                    <span className="backtest-hiw-step-title">{step.title}</span>
                  </div>
                  <span className="backtest-hiw-step-body">{step.body}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>,
    document.body,
  )
}
