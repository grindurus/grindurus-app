import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './BacktestPage.css'

const BASE_ASSETS = ['ETH', 'BTC', 'SOL', 'ARB', 'MATIC'] as const
const QUOTE_ASSETS = ['USDC', 'USDT', 'USD', 'SOL'] as const

const PAY_METHODS = ['x402', 'kirapay'] as const
type PayMethod = (typeof PAY_METHODS)[number]
const PAY_METHOD_LABEL: Record<PayMethod, string> = {
  x402: 'x402',
  kirapay: 'kirapay',
}

type BacktestQueueItem = {
  id: string
  base: string
  quote: string
  dateFrom: string
  dateTo: string
  baseAmount: string
  quoteAmount: string
  /** Full creator wallet address (EVM-style demo) */
  creatorAddress: string
  usdcPaid: string
}

type ApiQueueItem = {
  id: string
  base_asset: string
  quote_asset: string
  period_start: string
  period_end: string
  base_balance_start: string | number
  quote_balance_start: string | number
  priority_usdc: string | number
  creator_address: string
}

function shortenCreatorAddress(addr: string, head = 6, tail = 4) {
  const t = addr.trim()
  if (t.length <= head + tail + 1) return t
  return `${t.slice(0, head)}…${t.slice(-tail)}`
}

function toDateOnly(value: string) {
  if (!value) return ''
  const d = new Date(value)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return value.slice(0, 10)
}

function toAmountString(value: string | number, fractionDigits = 8) {
  const n = Number(value)
  if (Number.isFinite(n)) {
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: fractionDigits,
    })
  }
  return String(value)
}

const DEMO_BACKTEST_QUEUE: BacktestQueueItem[] = [
  {
    id: 'q1',
    base: 'ETH',
    quote: 'USDC',
    dateFrom: '2026-01-02',
    dateTo: '2026-01-31',
    baseAmount: '2.5',
    quoteAmount: '8,420',
    creatorAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    usdcPaid: '120.00',
  },
  {
    id: 'q2',
    base: 'BTC',
    quote: 'USDT',
    dateFrom: '2026-02-01',
    dateTo: '2026-02-20',
    baseAmount: '0.12',
    quoteAmount: '11,200',
    creatorAddress: '0xdD2FD4581271e230360230F9337D5c0430Bf44C0',
    usdcPaid: '110.00',
  },
  {
    id: 'q3',
    base: 'SOL',
    quote: 'USDC',
    dateFrom: '2026-02-05',
    dateTo: '2026-02-28',
    baseAmount: '40',
    quoteAmount: '6,800',
    creatorAddress: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
    usdcPaid: '100.00',
  },
  {
    id: 'q4',
    base: 'ARB',
    quote: 'USDC',
    dateFrom: '2026-01-10',
    dateTo: '2026-02-09',
    baseAmount: '1,200',
    quoteAmount: '1,950',
    creatorAddress: '0x147B8eb97fD247D06C4006D269c90C1908Fb5D54',
    usdcPaid: '90.00',
  },
  {
    id: 'q5',
    base: 'MATIC',
    quote: 'USDT',
    dateFrom: '2026-03-01',
    dateTo: '2026-03-22',
    baseAmount: '3,000',
    quoteAmount: '1,240',
    creatorAddress: '0x23618e81E3f5cdF7f54C3e65f804F9Ef7f9a3C12',
    usdcPaid: '80.00',
  },
  {
    id: 'q6',
    base: 'ETH',
    quote: 'USDT',
    dateFrom: '2025-12-01',
    dateTo: '2025-12-31',
    baseAmount: '1.0',
    quoteAmount: '3,380',
    creatorAddress: '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720',
    usdcPaid: '70.00',
  },
  {
    id: 'q7',
    base: 'BTC',
    quote: 'USD',
    dateFrom: '2026-03-10',
    dateTo: '2026-04-08',
    baseAmount: '0.25',
    quoteAmount: '21,500',
    creatorAddress: '0xbcd4042de499d14e55001cccb24a551f3b954096',
    usdcPaid: '60.00',
  },
  {
    id: 'q8',
    base: 'SOL',
    quote: 'ETH',
    dateFrom: '2026-01-15',
    dateTo: '2026-02-14',
    baseAmount: '85',
    quoteAmount: '1.15',
    creatorAddress: '0x71be63f3384f5fb989958598A552e0CC2F7f420f',
    usdcPaid: '50.00',
  },
  {
    id: 'q9',
    base: 'ETH',
    quote: 'USDC',
    dateFrom: '2026-04-01',
    dateTo: '2026-04-20',
    baseAmount: '0.5',
    quoteAmount: '1,620',
    creatorAddress: '0xF977814e90dA44bFA03b6295A0616a897441aceC',
    usdcPaid: '40.00',
  },
  {
    id: 'q10',
    base: 'ARB',
    quote: 'USDT',
    dateFrom: '2026-02-12',
    dateTo: '2026-03-13',
    baseAmount: '800',
    quoteAmount: '1,020',
    creatorAddress: '0x8ba1f109551bD432803012645Ac136c22C9e8D5',
    usdcPaid: '30.00',
  },
  {
    id: 'q11',
    base: 'MATIC',
    quote: 'USDC',
    dateFrom: '2026-01-20',
    dateTo: '2026-02-18',
    baseAmount: '5,000',
    quoteAmount: '1,890',
    creatorAddress: '0x28C6c06298d514Db089934071355E5743bf21d60',
    usdcPaid: '20.00',
  },
  {
    id: 'q12',
    base: 'BTC',
    quote: 'USDC',
    dateFrom: '2026-03-25',
    dateTo: '2026-04-23',
    baseAmount: '0.08',
    quoteAmount: '7,100',
    creatorAddress: '0x21a31Ee1afC51d94C2eFcCAa2092a102D454F74a',
    usdcPaid: '10.00',
  },
]

function toInputDateValue(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseInputDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

function daysInclusive(from: string, to: string) {
  const a = parseInputDate(from)
  const b = parseInputDate(to)
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000)
  return Math.max(1, diff + 1)
}

function chunkArray<T>(arr: T[], size: number) {
  if (size <= 0) return [arr]
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function formatBacktestApiError(data: unknown, status: number): string {
  if (typeof data === 'string' && data.trim()) return data.trim()
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>
    const detail = o.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (typeof item === 'string') return item
          if (item && typeof item === 'object' && 'msg' in item && typeof (item as { msg: unknown }).msg === 'string') {
            return (item as { msg: string }).msg
          }
          try {
            return JSON.stringify(item)
          } catch {
            return String(item)
          }
        })
        .join('; ')
    }
    if (typeof o.message === 'string') return o.message
  }
  return `Request failed (${status})`
}

function BacktestPage() {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 29)

  const [dateFrom, setDateFrom] = useState(() => toInputDateValue(start))
  const [dateTo, setDateTo] = useState(() => toInputDateValue(end))
  const [baseAsset, setBaseAsset] = useState<(typeof BASE_ASSETS)[number]>('ETH')
  const [quoteAsset, setQuoteAsset] = useState<(typeof QUOTE_ASSETS)[number]>('USDC')
  const [baseAmount, setBaseAmount] = useState('')
  const [quoteAmount, setQuoteAmount] = useState('')
  const [payBusy, setPayBusy] = useState(false)
  const [payError, setPayError] = useState('')
  const [paySuccess, setPaySuccess] = useState('')
  const [payMethod, setPayMethod] = useState<PayMethod>('x402')
  const [payMenuOpen, setPayMenuOpen] = useState(false)
  const [promoExpanded, setPromoExpanded] = useState(false)
  const [promocode, setPromocode] = useState('')
  const [promoApplied, setPromoApplied] = useState(false)
  const [queueColumns, setQueueColumns] = useState(4)
  const [queueBidValues, setQueueBidValues] = useState<Record<string, string>>({})
  const [queueItems, setQueueItems] = useState<BacktestQueueItem[]>([])
  const [queueLoading, setQueueLoading] = useState(false)
  const [queueError, setQueueError] = useState('')
  const payMethodWrapRef = useRef<HTMLDivElement>(null)
  const queueScrollerRef = useRef<HTMLDivElement>(null)

  const quoteOptions = useMemo(
    () => QUOTE_ASSETS.filter((q) => !(baseAsset === 'SOL' && q === 'SOL')),
    [baseAsset]
  )

  const onFromChange = (v: string) => {
    setDateFrom(v)
    if (parseInputDate(v) > parseInputDate(dateTo)) setDateTo(v)
  }

  const onToChange = (v: string) => {
    setDateTo(v)
    if (parseInputDate(v) < parseInputDate(dateFrom)) setDateFrom(v)
  }

  const sanitizeDecimal = (raw: string) => {
    const v = raw.replace(/[^\d.]/g, '')
    const [int, dec] = v.split('.')
    return dec !== undefined ? `${int}.${dec.slice(0, 12)}` : int
  }

  const handlePay = async () => {
    setPayMenuOpen(false)
    setPayError('')
    setPaySuccess('')
    setPayBusy(true)
    try {
      const endpoint = `${backtestApiOrigin}/backtest`
      const body = JSON.stringify({
        owner_address: '0x0000000000000000000000000000000000000001',
        params: {
          payment_method: payMethod,
          base_asset: baseAsset,
          quote_asset: quoteValue,
          base_amount: baseAmount.trim() || '0',
          quote_amount: quoteAmount.trim() || '0',
          date_from: `${dateFrom}T00:00:00`,
          date_to: `${dateTo}T23:59:59.999`,
          priority_usdc: '1',
        },
      })
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Method': payMethod,
        },
        body,
      })
      const rawText = await response.text()
      let data: unknown = null
      if (rawText) {
        try {
          data = JSON.parse(rawText) as unknown
        } catch {
          data = rawText
        }
      }
      if (!response.ok) {
        throw new Error(formatBacktestApiError(data, response.status))
      }
      const created = data && typeof data === 'object' ? (data as { id?: string }) : null
      const id = created?.id
      setPaySuccess(
        id
          ? `Backtest queued (${PAY_METHOD_LABEL[payMethod]}). Id: ${id}`
          : `Backtest queued (${PAY_METHOD_LABEL[payMethod]}).`
      )
      await loadQueue()
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Failed to enqueue backtest')
    } finally {
      setPayBusy(false)
    }
  }

  const handlePromoToggle = (checked: boolean) => {
    setPromoExpanded(checked)
    if (!checked) {
      setPromocode('')
      setPromoApplied(false)
    }
  }

  const handlePromoApply = () => {
    const code = promocode.trim()
    if (!code) return
    setPromoApplied(true)
  }

  const handleQueueBidChange = (id: string, raw: string) => {
    setQueueBidValues((prev) => ({ ...prev, [id]: sanitizeDecimal(raw) }))
  }

  const handleQueueBidSubmit = (id: string) => {
    const value = (queueBidValues[id] ?? '').trim()
    if (!value) return
    setQueueBidValues((prev) => ({ ...prev, [id]: value }))
  }

  const quoteValue = quoteOptions.includes(quoteAsset) ? quoteAsset : quoteOptions[0]

  const backtestApiOrigin = useMemo(
    () => (import.meta.env.VITE_BACKTEST_API_URL ?? 'http://localhost:8001').replace(/\/$/, ''),
    []
  )

  const loadQueue = useCallback(
    async (signal?: AbortSignal) => {
      setQueueLoading(true)
      setQueueError('')
      try {
        const response = await fetch(`${backtestApiOrigin}/queue?limit=1000`, { signal })
        const raw = await response.text()
        const payload = raw ? (JSON.parse(raw) as unknown) : []
        if (!response.ok) {
          throw new Error(`Queue request failed with status ${response.status}`)
        }
        if (!Array.isArray(payload)) {
          throw new Error('Queue response is not an array')
        }
        const mapped = payload.map((item) => {
          const q = item as ApiQueueItem
          return {
            id: q.id,
            base: q.base_asset,
            quote: q.quote_asset,
            dateFrom: toDateOnly(q.period_start),
            dateTo: toDateOnly(q.period_end),
            baseAmount: toAmountString(q.base_balance_start),
            quoteAmount: toAmountString(q.quote_balance_start),
            creatorAddress: q.creator_address,
            usdcPaid: toAmountString(q.priority_usdc, 2),
          } satisfies BacktestQueueItem
        })
        if (signal?.aborted) return
        setQueueItems(mapped)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (signal?.aborted) return
        const message = err instanceof Error ? err.message : 'Failed to load queue'
        setQueueError(message)
        setQueueItems([])
      } finally {
        setQueueLoading(false)
      }
    },
    [backtestApiOrigin]
  )

  useEffect(() => {
    const ac = new AbortController()
    void loadQueue(ac.signal)
    return () => ac.abort()
  }, [loadQueue])

  useEffect(() => {
    if (!quoteOptions.includes(quoteAsset)) {
      setQuoteAsset(quoteOptions[0])
    }
  }, [baseAsset, quoteAsset, quoteOptions])

  useEffect(() => {
    if (!payMenuOpen) return
    const onPointerDown = (e: PointerEvent) => {
      const el = payMethodWrapRef.current
      if (el && !el.contains(e.target as Node)) {
        setPayMenuOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPayMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [payMenuOpen])

  useEffect(() => {
    const el = queueScrollerRef.current
    if (!el) return

    const updateColumns = () => {
      const cardMin = 168
      const gap = 10
      const cols = Math.max(1, Math.floor((el.clientWidth + gap) / (cardMin + gap)))
      setQueueColumns(cols)
    }

    updateColumns()
    window.addEventListener('resize', updateColumns)
    return () => window.removeEventListener('resize', updateColumns)
  }, [])

  const visibleQueue = queueItems
  const queueRows = useMemo(() => chunkArray(visibleQueue, queueColumns), [visibleQueue, queueColumns])
  const queueRowWidthRem = useMemo(
    () => queueColumns * 12 + Math.max(0, queueColumns - 1) * 0.6,
    [queueColumns]
  )
  const featuredBacktest = visibleQueue[0] ?? DEMO_BACKTEST_QUEUE[0]
  const featuredRangeDays = useMemo(
    () => daysInclusive(featuredBacktest.dateFrom, featuredBacktest.dateTo),
    [featuredBacktest.dateFrom, featuredBacktest.dateTo]
  )

  return (
    <div className="backtest-page">
      <div className="backtest-layout">
        <div className="backtest-panel-wrap">
          <h2 id="backtest-panel-title" className="backtest-panel-title">
            Create backtest
          </h2>
          <aside className="backtest-panel" aria-labelledby="backtest-panel-title">

          <div className="backtest-field">
            <div className="backtest-dates" role="group" aria-label="Backtest date range">
              <div className="backtest-date-col">
                <label className="backtest-sublabel" htmlFor="backtest-date-from">
                  From
                </label>
                <input
                  id="backtest-date-from"
                  type="date"
                  className="backtest-date-input"
                  value={dateFrom}
                  onChange={(e) => onFromChange(e.target.value)}
                />
              </div>
              <span className="backtest-date-sep" aria-hidden="true">
                –
              </span>
              <div className="backtest-date-col">
                <label className="backtest-sublabel" htmlFor="backtest-date-to">
                  To
                </label>
                <input
                  id="backtest-date-to"
                  type="date"
                  className="backtest-date-input"
                  value={dateTo}
                  onChange={(e) => onToChange(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="backtest-pair-card" role="group" aria-label="Trading pair">
            <div className="backtest-pair-row">
              <div className="backtest-pair-col">
                <label className="backtest-sublabel" htmlFor="backtest-base">
                  Base
                </label>
                <select
                  id="backtest-base"
                  className="backtest-select"
                  value={baseAsset}
                  onChange={(e) => {
                    const v = e.target.value as (typeof BASE_ASSETS)[number]
                    setBaseAsset(v)
                    if (v === 'SOL' && quoteAsset === 'SOL') setQuoteAsset('USDC')
                  }}
                >
                  {BASE_ASSETS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="backtest-pair-col">
                <label className="backtest-sublabel" htmlFor="backtest-quote">
                  Quote
                </label>
                <select
                  id="backtest-quote"
                  className="backtest-select"
                  value={quoteValue}
                  onChange={(e) => setQuoteAsset(e.target.value as (typeof QUOTE_ASSETS)[number])}
                >
                  {quoteOptions.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="backtest-field backtest-amounts" role="group" aria-label="Amounts">
            <div className="backtest-amount-row">
              <div className="backtest-amount-with-suffix">
                <input
                  id="backtest-base-amt"
                  type="text"
                  inputMode="decimal"
                  className="backtest-amount-input"
                  placeholder="0"
                  value={baseAmount}
                  onChange={(e) => setBaseAmount(sanitizeDecimal(e.target.value))}
                  aria-label={`Amount, ${baseAsset}`}
                />
                <span className="backtest-amount-suffix">{baseAsset}</span>
              </div>
            </div>
            <div className="backtest-amount-row">
              <div className="backtest-amount-with-suffix">
                <input
                  id="backtest-quote-amt"
                  type="text"
                  inputMode="decimal"
                  className="backtest-amount-input"
                  placeholder="0"
                  value={quoteAmount}
                  onChange={(e) => setQuoteAmount(sanitizeDecimal(e.target.value))}
                  aria-label={`Amount, ${quoteAsset}`}
                />
                <span className="backtest-amount-suffix">{quoteAsset}</span>
              </div>
            </div>
          </div>

          <div className="backtest-pay-block">
            <div className="backtest-pay-actions-wrap" ref={payMethodWrapRef}>
              <div className="backtest-pay-actions-row">
                <div className="backtest-pay-actions">
                  <button
                    type="button"
                    className="backtest-pay-btn"
                    onClick={handlePay}
                    disabled={payBusy}
                    aria-label={payBusy ? 'Processing payment' : `Pay 1 ${quoteValue} and run backtest`}
                  >
                    {payBusy ? 'Processing…' : `Pay 1 ${quoteValue}`}
                  </button>
                  <div className="backtest-pay-method-wrap">
                    <button
                      type="button"
                      className={`backtest-pay-method-btn ${payMenuOpen ? 'is-open' : ''}`}
                      onClick={() => {
                        if (!payBusy) setPayMenuOpen((o) => !o)
                      }}
                      disabled={payBusy}
                      title={`Payment method: ${PAY_METHOD_LABEL[payMethod]}`}
                      aria-label={`Payment method: ${PAY_METHOD_LABEL[payMethod]}. Open options.`}
                      aria-expanded={payMenuOpen}
                      aria-haspopup="listbox"
                    >
                      <span className="backtest-pay-method-label">
                        {PAY_METHOD_LABEL[payMethod]}
                      </span>
                      <span className="backtest-pay-method-caret" aria-hidden="true">
                        ▾
                      </span>
                    </button>
                  </div>
                </div>
                {payMenuOpen && (
                  <div
                    className="backtest-pay-method-list"
                    role="listbox"
                    aria-label="Payment method"
                  >
                    {PAY_METHODS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="option"
                        aria-selected={payMethod === m}
                        className={`backtest-pay-method-list-item ${
                          payMethod === m ? 'is-active' : ''
                        }`}
                        onClick={() => {
                          setPayMethod(m)
                          setPayMenuOpen(false)
                        }}
                      >
                        {PAY_METHOD_LABEL[m]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {(payError || paySuccess) && (
              <p className={`backtest-pay-status ${payError ? 'is-error' : 'is-success'}`} aria-live="polite">
                {payError || paySuccess}
              </p>
            )}
            <div className="backtest-promo-anchor">
              <label className="backtest-promo-check">
                <input
                  id="backtest-promo-toggle"
                  type="checkbox"
                  className="backtest-promo-check-input"
                  checked={promoExpanded}
                  onChange={(e) => handlePromoToggle(e.target.checked)}
                />
                <span className="backtest-promo-check-text">I have promocode</span>
              </label>
              {promoExpanded && (
                <div className="backtest-promo-panel">
                  {promoApplied && (
                    <span
                      id="backtest-promo-applied-ann"
                      className="backtest-sr-only"
                      aria-live="polite"
                    >
                      Promocode applied
                    </span>
                  )}
                  <div className="backtest-promo-row">
                    <input
                      id="backtest-promocode"
                      type="text"
                      className="backtest-promo-input"
                      value={promocode}
                      onChange={(e) => {
                        setPromocode(e.target.value)
                        setPromoApplied(false)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && promocode.trim()) {
                          e.preventDefault()
                          handlePromoApply()
                        }
                      }}
                      placeholder="Enter code"
                      autoComplete="off"
                      spellCheck={false}
                      aria-label="Promocode"
                      aria-describedby={promoApplied ? 'backtest-promo-applied-ann' : undefined}
                    />
                    {promoApplied && (
                      <span className="backtest-promo-checkmark" aria-hidden="true">
                        ✓
                      </span>
                    )}
                    <button
                      type="button"
                      className="backtest-promo-apply"
                      onClick={handlePromoApply}
                      disabled={!promocode.trim()}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          </aside>
        </div>

        <section className="backtest-main" aria-label="Backtest results">
          <div
            className="backtest-queue-wrap"
            role="region"
            aria-labelledby="backtest-queue-label"
          >
            <div className="backtest-queue-head">
              <p id="backtest-queue-label" className="backtest-queue-label">
                Backtest queue
              </p>
            </div>
            <div
              id="backtest-queue-scroller"
              className="backtest-queue-scroller is-extended"
              ref={queueScrollerRef}
              tabIndex={0}
              aria-label="Scroll horizontally to browse the backtest queue"
            >
              <div className="backtest-queue-grid-rows" role="list">
                {queueRows.map((row, rowIdx) => {
                  const isReverse = rowIdx % 2 === 1
                  const visualRow = row
                  return (
                    <div
                      key={`queue-row-${rowIdx}`}
                      className={`backtest-queue-grid-row ${isReverse ? 'is-reverse' : ''} ${
                        rowIdx < queueRows.length - 1 ? 'has-next' : ''
                      }`}
                      style={{ width: `${queueRowWidthRem}rem` }}
                      role="listitem"
                    >
                      {visualRow.map((item, visualIdx) => {
                        const originalIdx = visibleQueue.findIndex((q) => q.id === item.id)
                        return (
                          <div
                            key={item.id}
                            className={`backtest-queue-item ${visualIdx < visualRow.length - 1 ? 'has-connector' : ''}`}
                          >
                            <div
                              className="backtest-queue-card"
                              title={`${item.base} / ${item.quote}, ${item.dateFrom} – ${item.dateTo}, ${item.baseAmount} ${item.base}, ${item.quoteAmount} ${item.quote}, ${item.creatorAddress}`}
                            >
                              <span className="backtest-queue-index">#{originalIdx + 1}</span>
                              <span className="backtest-queue-pair">
                                {item.base} / {item.quote}
                              </span>
                              <div className="backtest-queue-grid">
                                <span className="backtest-queue-date-start">{item.dateFrom}</span>
                                <span className="backtest-queue-amt-base">
                                  {item.baseAmount} {item.base}
                                </span>
                                <span className="backtest-queue-date-end">{item.dateTo}</span>
                                <span className="backtest-queue-amt-quote">
                                  {item.quoteAmount} {item.quote}
                                </span>
                              </div>
                              <div className="backtest-queue-creator">
                                <div className="backtest-queue-creator-top">
                                  <span className="backtest-queue-creator-label">Creator</span>
                                  <span className="backtest-queue-priority-label">Priority</span>
                                </div>
                                <div className="backtest-queue-creator-bottom">
                                  <span
                                    className="backtest-queue-creator-addr"
                                    title={item.creatorAddress}
                                  >
                                    {shortenCreatorAddress(item.creatorAddress)}
                                  </span>
                                  <span className="backtest-queue-priority-value">
                                    {item.usdcPaid} USDC
                                  </span>
                                </div>
                              </div>
                              <div className="backtest-queue-bid-row">
                                <div className="backtest-queue-bid-input-wrap">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    className="backtest-queue-bid-input"
                                    placeholder={`#${originalIdx + 1} bid`}
                                    value={queueBidValues[item.id] ?? ''}
                                    onChange={(e) => handleQueueBidChange(item.id, e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault()
                                        handleQueueBidSubmit(item.id)
                                      }
                                    }}
                                    aria-label={`Bid amount for queue item #${originalIdx + 1}`}
                                  />
                                  <span className="backtest-queue-bid-suffix">USDC</span>
                                </div>
                                <button
                                  type="button"
                                  className="backtest-queue-bid-btn"
                                  onClick={() => handleQueueBidSubmit(item.id)}
                                  disabled={!(queueBidValues[item.id] ?? '').trim()}
                                >
                                  BID
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
            {queueLoading && <div className="backtest-queue-end-hint">Loading queue…</div>}
            {!queueLoading && queueError && <div className="backtest-queue-end-hint">{queueError}</div>}
            {!queueLoading && !queueError && visibleQueue.length === 0 && (
              <div className="backtest-queue-end-hint">Queue is empty.</div>
            )}
          </div>
          <section className="backtest-results-card" aria-label="Backtest output">
            <h1 className="backtest-main-title">Backtest</h1>
            <p className="backtest-main-subtitle">
              Pair <strong>{featuredBacktest.base}</strong> / <strong>{featuredBacktest.quote}</strong>,{' '}
              <strong>
                {featuredBacktest.dateFrom} – {featuredBacktest.dateTo}
              </strong>{' '}
              ({featuredRangeDays} days). Charts and fills will appear here after payment.
            </p>
            <div className="backtest-placeholder" aria-label="Backtest chart preview">
              <svg
                className="backtest-placeholder-chart"
                viewBox="0 0 100 42"
                role="img"
                aria-label="Upward pink equity curve"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="backtest-chart-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(255, 105, 180, 0.42)" />
                    <stop offset="100%" stopColor="rgba(255, 105, 180, 0.02)" />
                  </linearGradient>
                </defs>
                <g className="backtest-placeholder-grid">
                  <line x1="0" y1="10" x2="100" y2="10" />
                  <line x1="0" y1="20" x2="100" y2="20" />
                  <line x1="0" y1="30" x2="100" y2="30" />
                </g>
                <path
                  className="backtest-placeholder-area"
                  d="M2 36 L2 31 L10 32 L18 29 L26 27 L34 28 L42 24 L50 22 L58 19 L66 17 L74 14 L82 12 L90 9 L98 6 L98 36 Z"
                />
                <path
                  className="backtest-placeholder-line"
                  d="M2 31 L10 32 L18 29 L26 27 L34 28 L42 24 L50 22 L58 19 L66 17 L74 14 L82 12 L90 9 L98 6"
                />
              </svg>
            </div>
          </section>
        </section>
      </div>
    </div>
  )
}

export default BacktestPage
