import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { x402Client, wrapFetchWithPayment } from '@x402/fetch'
import { registerExactEvmScheme } from '@x402/evm/exact/client'
import { ExactSvmScheme } from '@x402/svm/exact/client'
import { getBase64EncodedWireTransaction, getTransactionDecoder } from '@solana/kit'
import { VersionedTransaction } from '@solana/web3.js'
import { Buffer } from 'buffer'
import { useSolanaWallet } from '../hooks/useSolanaWallet'
import { useEvmWallet } from '../hooks/useEvmWallet'
import { useActiveWallet } from '../hooks/useActiveWallet'
import { useEvmWalletClient } from '../providers/EvmWalletClientContext'
import { stripTrailingSlash } from '../utils/urlUtils'
import { useWalletContext } from '../providers/AppWalletProvider'
import { InventoryHistoryChart, type InventoryHistoryPoint } from '../components/InventoryHistoryChart'
import { YieldChart, type YieldHistoryPoint } from '../components/YieldChart'
import { GraiUiCaret } from '../components/grai/GraiUiCaret'
import { consumeCompleteSseEvents } from '../boss/sseParser'
import {
  BACKTEST_SECTION_IDS,
  readBacktestSectionFromHash,
} from '../utils/backtestNavigation'
import { SOLANA_MAINNET_GENESIS } from '../wallet/caip2Network'
import './BacktestPage.css'

const DEFAULT_BASE_ASSETS = ['ETH', 'BTC', 'SOL', 'ARB', 'MATIC'] as const
const DEFAULT_QUOTE_ASSETS = ['USDC', 'USDT', 'USD', 'SOL'] as const
const DEFAULT_BASE_ASSET = 'SOL'
/** Backtest x402 SVM accepts only Solana mainnet (CAIP-2 genesis). */
const X402_SOLANA_MAINNET = `solana:${SOLANA_MAINNET_GENESIS}` as const
/** Inclusive calendar-day cap for From–To (matches UI “Max period”). */
const MAX_BACKTEST_PERIOD_DAYS = 5
const QUEUE_VISIBLE_COUNT = 9
/** Minimum custom / paid queue bid (USDC). */
const MIN_QUEUE_BID_USDC = 1

function parseBidUsdcAmount(raw: string): number | null {
  const n = Number(raw.trim())
  if (!Number.isFinite(n)) return null
  return n
}

function isValidQueueBidAmount(raw: string): boolean {
  const n = parseBidUsdcAmount(raw)
  return n !== null && n >= MIN_QUEUE_BID_USDC
}
const USDC_ICON_URL = 'https://assets.coingecko.com/coins/images/6319/small/usdc.png'

/** Fallback when `/symbols` has not loaded icons yet. */
const FALLBACK_ASSET_ICON_URLS: Record<string, string> = {
  ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  ARB: 'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg',
  MATIC: 'https://assets.coingecko.com/coins/images/4713/small/polygon.png',
  USDC: USDC_ICON_URL,
  USDT: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  USD: USDC_ICON_URL,
}

function BacktestUsdcTickerIcon({ size = 14 }: { size?: number }) {
  return (
    <img
      className="backtest-usdc-ticker-icon"
      src={USDC_ICON_URL}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
    />
  )
}

function normalizeAssetQuery(value: string) {
  return value.trim().toUpperCase()
}

function assetIconUrl(symbol: string, icons?: Record<string, string>): string | null {
  const key = normalizeAssetQuery(symbol)
  if (!key) return null
  return icons?.[key] ?? FALLBACK_ASSET_ICON_URLS[key] ?? null
}

function BacktestAssetIcon({
  symbol,
  size = 24,
  icons,
}: {
  symbol: string
  size?: number
  icons?: Record<string, string>
}) {
  const src = assetIconUrl(symbol, icons)
  if (!src) return null
  return (
    <span className="backtest-pair-asset-icon" aria-hidden="true">
      <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" />
    </span>
  )
}

function assetMatchesOption(value: string, options: readonly string[]) {
  const query = normalizeAssetQuery(value)
  return query.length > 0 && options.includes(query)
}

function filterAssetOptions(options: readonly string[], query: string) {
  const normalized = normalizeAssetQuery(query)
  if (!normalized) return [...options]
  return options.filter((option) => option.includes(normalized))
}

const PAY_METHODS = ['x402', 'promocode'] as const
type PayMethod = (typeof PAY_METHODS)[number]
const PAY_METHOD_LABEL: Record<PayMethod, string> = {
  x402: 'x402',
  promocode: 'promocode',
}

const X402_METHOD_ICON = (
  <img
    src={USDC_ICON_URL}
    alt=""
    width={16}
    height={16}
    className="backtest-pay-method-brand-icon"
    decoding="async"
  />
)

const PAY_METHOD_ICON: Record<PayMethod, ReactNode> = {
  x402: X402_METHOD_ICON,
  promocode: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M9 12h6" />
    </svg>
  ),
}

const PAIR_FIELD_ICONS = {
  base: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8" />
      <path d="M9.5 10.5h3a2 2 0 1 1 0 4h-3" />
    </svg>
  ),
  quote: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2v20" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
} as const

const DATE_FIELD_ICONS = {
  from: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
    </svg>
  ),
  to: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M16 14h.01" />
      <path d="M12 18h.01" />
    </svg>
  ),
} as const

const PAY_METHOD_CAPTION_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect width="20" height="14" x="2" y="5" rx="2" />
    <line x1="2" x2="22" y1="10" y2="10" />
  </svg>
)

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
  status?: string
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
  status?: string
}

type ApiHistoryItem = {
  id: string
  base_asset: string
  quote_asset: string
  period_start: string
  period_end: string
  base_balance_start: string | number
  base_balance_end: string | number
  quote_balance_start: string | number
  quote_balance_end: string | number
  pnl_base: string | number
  pnl_quote: string | number
  priority_usdc?: string | number
  creator_address: string
}

type BacktestHistoryItem = {
  id: string
  pair: string
  baseAsset: string
  quoteAsset: string
  period: string
  periodDuration: string
  baseStart: string
  baseEnd: string
  quoteStart: string
  quoteEnd: string
  pnlBase: string
  pnlQuote: string
  pnlBasePct: string
  pnlQuotePct: string
  priorityUsdc: string
  creatorAddress: string
}

type ApiHealth = {
  status: string
  backtest_price?: string
  grinder_id?: string
}

type ApiSymbols = {
  base_assets?: unknown
  quote_assets?: unknown
  icons?: unknown
}

function shortenCreatorAddress(addr: string, head = 6, tail = 4) {
  const t = addr.trim()
  if (t.length <= head + tail + 1) return t
  return `${t.slice(0, head)}…${t.slice(-tail)}`
}

function queueItemsEqual(a: BacktestQueueItem[], b: BacktestQueueItem[]) {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i]
    const y = b[i]
    if (
      x.id !== y.id ||
      x.status !== y.status ||
      x.usdcPaid !== y.usdcPaid ||
      x.base !== y.base ||
      x.quote !== y.quote ||
      x.dateFrom !== y.dateFrom ||
      x.dateTo !== y.dateTo ||
      x.baseAmount !== y.baseAmount ||
      x.quoteAmount !== y.quoteAmount ||
      x.creatorAddress !== y.creatorAddress
    ) {
      return false
    }
  }
  return true
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

/** Compact amount for tight history-card cells. */
function toCompactAmount(value: string | number) {
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value)
  const abs = Math.abs(n)
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : abs >= 0.01 ? 4 : 6
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })
}

function pnlToneClass(value: string | number) {
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''))
  if (!Number.isFinite(n) || n <= 0) return ''
  return 'is-pnl-pos'
}

function parseAmount(value: string | number) {
  return typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''))
}

/** PnL as % of end balance for that asset. */
function pnlPctOfEnd(pnl: string | number, endBalance: string | number) {
  const p = parseAmount(pnl)
  const end = parseAmount(endBalance)
  if (!Number.isFinite(p) || !Number.isFinite(end) || end === 0) return '—'
  const pct = (p / Math.abs(end)) * 100
  const formatted = pct.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  if (pct > 0) return `+${formatted}%`
  return `${formatted}%`
}

function normalizeUsdcAmount(raw: string | undefined, fallback = '1') {
  if (!raw) return fallback
  const cleaned = raw.replace(/^\$/, '').trim()
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return String(n)
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
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Calendar day at 00:00 UTC (date-only math for the backtest picker). */
function utcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function parseInputDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1))
}

function addDays(date: Date, days: number) {
  const out = new Date(date)
  out.setUTCDate(out.getUTCDate() + days)
  return out
}

function daysInclusive(from: string, to: string) {
  const a = parseInputDate(from)
  const b = parseInputDate(to)
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000)
  return Math.max(1, diff + 1)
}

/** `YYYY-MM-DD` for query `from` / `to`, or null if invalid. */
function parseQueryDateParam(raw: string | null | undefined): string | null {
  const s = raw?.trim().slice(0, 10) ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = parseInputDate(s)
  if (Number.isNaN(d.getTime())) return null
  return toInputDateValue(d) === s ? s : null
}

function sanitizeDecimalInput(raw: string) {
  const v = raw.replace(/[^\d.]/g, '')
  const [int, dec] = v.split('.')
  return dec !== undefined ? `${int}.${dec.slice(0, 12)}` : int
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
    const code = typeof o.code === 'string' ? o.code : ''
    if (code === 'promocode_missing') return 'Promocode is required. Enter a code in the field.'
    if (code === 'promocode_invalid') return 'Invalid promocode. Check the code and try again.'

    if (typeof o.error === 'string' && o.error.trim()) return o.error
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

function buildBacktestChartHistory(
  dateFrom: string,
  dateTo: string,
  rangeDays: number,
  baseAmount: string,
  quoteAmount: string
): { inventoryHistory: InventoryHistoryPoint[]; yieldHistory: YieldHistoryPoint[] } {
  const days = Math.max(8, Math.min(32, rangeDays))
  const fromMs = new Date(`${dateFrom}T00:00:00`).getTime()
  const toMs = new Date(`${dateTo}T00:00:00`).getTime()
  const stepMs = days > 1 ? (toMs - fromMs) / (days - 1) : 0
  const baseSeed = Number(baseAmount.replace(/,/g, '')) || 1
  const quoteSeed = Number(quoteAmount.replace(/,/g, '')) || 1
  const spotSeed = Math.max(1, quoteSeed / Math.max(baseSeed, 1e-9))

  const inventoryHistory: InventoryHistoryPoint[] = []
  const yieldHistory: YieldHistoryPoint[] = []

  for (let i = 0; i < days; i++) {
    const t = fromMs + stepMs * i
    const base = baseSeed * (0.9 + i * 0.004) + Math.sin(i / 2.1) * baseSeed * 0.03
    const quote = quoteSeed * (0.92 + i * 0.0036) + Math.cos(i / 2.6) * quoteSeed * 0.02
    const spot = spotSeed * (0.98 + i * 0.0012) + Math.sin(i / 3.4) * spotSeed * 0.015
    const pnlQuote = (i / Math.max(1, days - 1)) * 7.5 + Math.sin(i / 3) * 1.2
    const pnlBase = ((i / Math.max(1, days - 1)) * 5.4 + Math.cos(i / 2.3) * 0.9) / Math.max(spot, 1e-9)
    const totalPnl = pnlQuote + pnlBase * spot

    inventoryHistory.push({ t, base, quote, spot })
    yieldHistory.push({ t, pnlQuote, pnlBase, price: spot, totalPnl })
  }

  return { inventoryHistory, yieldHistory }
}

function logEventToChartPoints(raw: unknown): {
  inventory?: InventoryHistoryPoint
  yieldPoint?: YieldHistoryPoint
} {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const timeRaw = o.time
  let t = Date.now()
  if (typeof timeRaw === 'string') {
    const parsed = Date.parse(timeRaw)
    if (Number.isFinite(parsed)) t = parsed
  } else if (typeof timeRaw === 'number' && Number.isFinite(timeRaw)) {
    t = timeRaw > 1e12 ? timeRaw : timeRaw * 1000
  }
  const base = Number(o.balance_base)
  const quote = Number(o.balance_quote)
  const spot = Number(o.spot_price)
  const pnlQuote = Number(o.pnl_quote)
  const pnlBase = Number(o.pnl_base)
  const inventory =
    Number.isFinite(base) && Number.isFinite(quote)
      ? {
          t,
          base,
          quote,
          spot: Number.isFinite(spot) && spot > 0 ? spot : undefined,
        }
      : undefined
  const price = Number.isFinite(spot) && spot > 0 ? spot : 1
  const yieldPoint =
    Number.isFinite(pnlQuote) || Number.isFinite(pnlBase)
      ? {
          t,
          pnlQuote: Number.isFinite(pnlQuote) ? pnlQuote : 0,
          pnlBase: Number.isFinite(pnlBase) ? pnlBase : 0,
          price,
          totalPnl:
            (Number.isFinite(pnlQuote) ? pnlQuote : 0) +
            (Number.isFinite(pnlBase) ? pnlBase : 0) * price,
        }
      : undefined
  return { inventory, yieldPoint }
}

function BacktestPage() {
  const { openChainSelector, warmEvmStack, isEvmStackReady } = useWalletContext()
  const activeWallet = useActiveWallet()
  const [dateFrom, setDateFrom] = useState(() => toInputDateValue(addDays(utcDay(), -1)))
  const [dateTo, setDateTo] = useState(() => toInputDateValue(addDays(utcDay(), -1)))
  const [baseAssets, setBaseAssets] = useState<string[]>([...DEFAULT_BASE_ASSETS])
  const [quoteAssets, setQuoteAssets] = useState<string[]>([...DEFAULT_QUOTE_ASSETS])
  const [assetIcons, setAssetIcons] = useState<Record<string, string>>({})

  const [baseAsset, setBaseAsset] = useState<string>(DEFAULT_BASE_ASSET)
  const [quoteAsset, setQuoteAsset] = useState<string>(DEFAULT_QUOTE_ASSETS[0])
  const [baseAmount, setBaseAmount] = useState('')
  const [quoteAmount, setQuoteAmount] = useState('')
  const [payBusy, setPayBusy] = useState(false)
  const [payBusyLabel, setPayBusyLabel] = useState('Processing…')
  const [payError, setPayError] = useState('')
  const [paySuccess, setPaySuccess] = useState('')
  const [payMethod, setPayMethod] = useState<PayMethod>('x402')
  const [payMenuOpen, setPayMenuOpen] = useState(false)
  const [baseAssetMenuOpen, setBaseAssetMenuOpen] = useState(false)
  const [quoteAssetMenuOpen, setQuoteAssetMenuOpen] = useState(false)
  const [baseAssetListAll, setBaseAssetListAll] = useState(true)
  const [quoteAssetListAll, setQuoteAssetListAll] = useState(true)
  const [promocode, setPromocode] = useState('')
  const createQueryFromUrlApplied = useRef(false)
  const [queueColumns, setQueueColumns] = useState(3)
  const [queueBidValues, setQueueBidValues] = useState<Record<string, string>>({})
  const [queueBidCustomOpen, setQueueBidCustomOpen] = useState<Record<string, boolean>>({})
  const [queueBidBusy, setQueueBidBusy] = useState<Record<string, boolean>>({})
  const [defaultBidPrice, setDefaultBidPrice] = useState('1')
  const [queueItems, setQueueItems] = useState<BacktestQueueItem[]>([])
  const [queueSearch, setQueueSearch] = useState('')
  const [queueView, setQueueView] = useState<'queue' | 'history'>('queue')
  const [queueLoading, setQueueLoading] = useState(false)
  const [queueError, setQueueError] = useState('')
  const [priorityTotals, setPriorityTotals] = useState({
    queue_usdc: 0,
    stack_usdc: 0,
    total_usdc: 0,
  })
  const [liveInventoryHistory, setLiveInventoryHistory] = useState<InventoryHistoryPoint[]>([])
  const [liveYieldHistory, setLiveYieldHistory] = useState<YieldHistoryPoint[]>([])
  /** Once live SSE has been used, keep showing live series (incl. empty after run ends). */
  const [useLiveCharts, setUseLiveCharts] = useState(false)
  const [copiedHistoryId, setCopiedHistoryId] = useState('')
  const [copiedCreatorKey, setCopiedCreatorKey] = useState('')
  const [historyItems, setHistoryItems] = useState<BacktestHistoryItem[]>([])
  const [historyPage, setHistoryPage] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [showX402NetworkSwitch, setShowX402NetworkSwitch] = useState(false)
  const payMethodWrapRef = useRef<HTMLDivElement>(null)
  const baseAssetMenuRef = useRef<HTMLDivElement>(null)
  const quoteAssetMenuRef = useRef<HTMLDivElement>(null)
  const queueScrollerRef = useRef<HTMLDivElement>(null)
  const queueWrapRef = useRef<HTMLDivElement>(null)
  const queueWrapAnimFromRef = useRef<number | null>(null)
  const queueSearchInputRef = useRef<HTMLInputElement>(null)
  const solanaWallet = useSolanaWallet()
  const evmWallet = useEvmWallet()
  const { walletClient } = useEvmWalletClient()
  const isEvmConnected = evmWallet.isConnected
  const evmAccountAddress = evmWallet.address
  const chainId = evmWallet.chainId
  const switchChain = evmWallet.switchToChain

  useEffect(() => {
    warmEvmStack()
  }, [warmEvmStack])

  // `/backtest?from=&to=&base=&quote=&promo=` → hydrate create form once.
  useEffect(() => {
    if (createQueryFromUrlApplied.current) return
    let params: URLSearchParams
    try {
      params = new URLSearchParams(window.location.search)
    } catch {
      return
    }
    const fromParam = params.get('from')
    const toParam = params.get('to')
    const baseParam = params.get('base')
    const quoteParam = params.get('quote')
    const promoParam = params.get('promo')?.trim() ?? ''
    if (!fromParam && !toParam && !baseParam && !quoteParam && !promoParam) return

    createQueryFromUrlApplied.current = true

    const fromDate = parseQueryDateParam(fromParam)
    const toDate = parseQueryDateParam(toParam)
    if (fromDate || toDate) {
      let nextFrom = fromDate ?? toDate!
      let nextTo = toDate ?? fromDate!
      if (parseInputDate(nextFrom) > parseInputDate(nextTo)) {
        const swap = nextFrom
        nextFrom = nextTo
        nextTo = swap
      }
      const maxTo = addDays(parseInputDate(nextFrom), MAX_BACKTEST_PERIOD_DAYS - 1)
      if (parseInputDate(nextTo) > maxTo) {
        nextTo = toInputDateValue(maxTo)
      }
      setDateFrom(nextFrom)
      setDateTo(nextTo)
    }

    if (baseParam != null && baseParam.trim() !== '') {
      const cleaned = sanitizeDecimalInput(baseParam)
      if (cleaned !== '') setBaseAmount(cleaned)
    }
    if (quoteParam != null && quoteParam.trim() !== '') {
      const cleaned = sanitizeDecimalInput(quoteParam)
      if (cleaned !== '') setQuoteAmount(cleaned)
    }

    if (promoParam) {
      setPromocode(promoParam)
      setPayMethod('promocode')
      setPayError('')
    }
  }, [])

  const evmWalletNetwork = useMemo(() => (chainId ? `eip155:${chainId}` : null), [chainId])
  const preferSolanaPayment = useMemo(() => {
    if (payMethod !== 'x402') return false
    if (!solanaWallet.isConnected || !solanaWalletWalletSignerReady(solanaWallet.signTransaction)) {
      return false
    }
    // Prefer Solana when it's the active wallet, or when no EVM signer is ready.
    if (activeWallet.chainType === 'solana') return true
    if (!(isEvmConnected || evmWallet.isConnected || activeWallet.chainType === 'evm')) return true
    return false
  }, [
    activeWallet.chainType,
    evmWallet.isConnected,
    isEvmConnected,
    payMethod,
    solanaWallet.isConnected,
    solanaWallet.signTransaction,
  ])
  const walletNetwork = useMemo(() => {
    if (payMethod !== 'x402') return evmWalletNetwork
    // Payment options are Base + Solana mainnet — never advertise wallet-UI devnet.
    if (preferSolanaPayment) return X402_SOLANA_MAINNET
    return evmWalletNetwork
  }, [evmWalletNetwork, payMethod, preferSolanaPayment])

  const quoteOptions = useMemo(
    () => quoteAssets.filter((q) => !(baseAsset === 'SOL' && q === 'SOL')),
    [baseAsset, quoteAssets]
  )

  const filteredBaseAssets = useMemo(
    () => filterAssetOptions(baseAssets, baseAsset),
    [baseAsset, baseAssets]
  )

  const filteredQuoteAssets = useMemo(
    () => filterAssetOptions(quoteOptions, quoteAsset),
    [quoteAsset, quoteOptions]
  )

  const visibleBaseAssets = baseAssetListAll ? baseAssets : filteredBaseAssets
  const visibleQuoteAssets = quoteAssetListAll ? quoteOptions : filteredQuoteAssets

  const onFromChange = (v: string) => {
    const nextFrom = parseInputDate(v)
    const currentTo = parseInputDate(dateTo)
    const maxTo = addDays(nextFrom, MAX_BACKTEST_PERIOD_DAYS - 1)
    setDateFrom(v)
    if (nextFrom > currentTo) {
      setDateTo(v)
      return
    }
    if (currentTo > maxTo) {
      setDateTo(toInputDateValue(maxTo))
    }
  }

  const onToChange = (v: string) => {
    const nextTo = parseInputDate(v)
    const currentFrom = parseInputDate(dateFrom)
    const minFrom = addDays(nextTo, -(MAX_BACKTEST_PERIOD_DAYS - 1))
    if (nextTo < currentFrom) {
      setDateTo(v)
      setDateFrom(v)
      return
    }
    if (currentFrom < minFrom) {
      setDateFrom(toInputDateValue(minFrom))
    }
    setDateTo(v)
  }

  const sanitizeDecimal = (raw: string) => sanitizeDecimalInput(raw)

  const hasPositiveAmount = (raw: string) => {
    const n = Number(raw.trim())
    return Number.isFinite(n) && n > 0
  }

  const handlePay = async () => {
    setPayMenuOpen(false)
    setPayError('')
    setPaySuccess('')
    setShowX402NetworkSwitch(false)
    const promoCode = promocode.trim()
    if (!hasPositiveAmount(baseAmount) && !hasPositiveAmount(quoteAmount)) {
      setPayError('Enter a base or quote starting amount.')
      return
    }
    if (payMethod === 'x402' && !hasEvmSigner && !hasSvmSigner) {
      setPayError('Connect an EVM or Solana wallet to pay with x402.')
      return
    }
    if (payMethod === 'x402' && !x402PaymentReady) {
      setPayError('Waiting for wallet signer. Try again in a moment.')
      return
    }
    if (payMethod === 'x402' && !paidFetch) {
      setPayError('Unable to initialize x402 payment client.')
      return
    }
    if (payMethod === 'promocode' && !promoCode) {
      setPayError('Enter a promocode.')
      return
    }
    setPayBusy(true)
    setPayBusyLabel(
      payMethod === 'x402'
        ? 'Confirm payment in wallet…'
        : 'Processing…'
    )
    try {
      const endpoint = `${backtestApiOrigin}/create`
      const body = JSON.stringify({
        owner_address:
          solanaWallet.address ||
          walletClient?.account?.address ||
          evmAccountAddress ||
          evmWallet.address ||
          '0x0000000000000000000000000000000000000001',
        params: {
          payment_method: payMethod,
          wallet_network: walletNetwork,
          base_asset: baseValue,
          quote_asset: quoteValue,
          base_amount: baseAmount.trim() || '0',
          quote_amount: quoteAmount.trim() || '0',
          date_from: `${dateFrom}T00:00:00Z`,
          date_to: `${dateTo}T23:59:59.999Z`,
          priority_usdc: '1',
        },
      })

      const requestWithPayment = payMethod === 'x402' ? paidFetch : fetch
      if (!requestWithPayment) {
        throw new Error('Unable to initialize payment transport.')
      }
      const payHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Payment-Method': payMethod,
      }
      if (payMethod === 'promocode' && promoCode) {
        payHeaders['X-Promocode'] = promoCode
      }
      if (walletNetwork) {
        payHeaders['X-Wallet-Network'] = walletNetwork
      }
      if (payMethod === 'x402') {
        setPayBusyLabel('Confirm payment in wallet…')
      } else {
        setPayBusyLabel('Queuing backtest…')
      }
      const response = await requestWithPayment(endpoint, {
        method: 'POST',
        headers: payHeaders,
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
      // Refresh lists after clearing busy so Processing… does not wait on queue I/O.
      void Promise.allSettled([loadQueue(undefined, { silent: true }), loadPriority()])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to enqueue backtest'
      const lowerMessage = message.toLowerCase()
      const isUserRejectedSignature =
        lowerMessage.includes('user rejected') ||
        lowerMessage.includes('user denied') ||
        lowerMessage.includes('request rejected') ||
        lowerMessage.includes('rejected the request') ||
        lowerMessage.includes('signature rejected') ||
        lowerMessage.includes('transaction rejected') ||
        lowerMessage.includes('cancelled')

      if (payMethod === 'x402' && isUserRejectedSignature) {
        setPayError('Signature request was cancelled.')
        return
      }
      if (
        payMethod === 'x402' &&
        (message.includes('No scheme registered') ||
          message.includes('No network/scheme registered') ||
          message.includes('Failed to create payment payload'))
      ) {
        setPayError(
          'x402 is not available for the current wallet network. Please switch network.'
        )
        setShowX402NetworkSwitch(true)
      } else {
        setPayError(message)
      }
    } finally {
      setPayBusy(false)
    }
  }

  const handleQueueBidChange = (id: string, raw: string) => {
    setQueueBidValues((prev) => ({ ...prev, [id]: sanitizeDecimal(raw) }))
  }

  const handleQueueBidSubmit = async (id: string, explicitAmount?: string) => {
    const value = (explicitAmount ?? queueBidValues[id] ?? '').trim()
    if (!value) return
    if (!isValidQueueBidAmount(value)) {
      setQueueError(`Bid must be at least ${MIN_QUEUE_BID_USDC} USDC.`)
      return
    }
    if (!paidFetch) {
      setQueueError('Connect wallet to pay bid via x402.')
      return
    }
    setQueueBidBusy((prev) => ({ ...prev, [id]: true }))
    setQueueError('')
    try {
      const endpoint = `${backtestApiOrigin}/backtest/${id}/bid`
      const response = await paidFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Method': 'x402',
          'X-Bid-Amount': value,
          ...(walletNetwork ? { 'X-Wallet-Network': walletNetwork } : {}),
        },
        body: JSON.stringify({ amount_usdc: value }),
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
      setQueueBidValues((prev) => ({ ...prev, [id]: '' }))
      setQueueBidCustomOpen((prev) => ({ ...prev, [id]: false }))
      await loadQueue(undefined, { silent: true })
      await loadPriority()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit bid'
      setQueueError(message)
    } finally {
      setQueueBidBusy((prev) => ({ ...prev, [id]: false }))
    }
  }

  const handleQueueBidOneUsdc = (id: string) => {
    const amount = defaultBidPrice
    setQueueBidValues((prev) => ({ ...prev, [id]: amount }))
    void handleQueueBidSubmit(id, amount)
  }

  const handleSwitchBase = () => {
    setPayError('')
    setPaySuccess('')
    setShowX402NetworkSwitch(false)
    switchChain(8453)
  }

  const handleSwitchSolana = () => {
    setPayError('')
    setPaySuccess('')
    setShowX402NetworkSwitch(false)
  }

  const baseValue = baseAsset.trim() || baseAssets[0] || DEFAULT_BASE_ASSET
  const quoteValue = quoteAsset.trim() || quoteOptions[0] || DEFAULT_QUOTE_ASSETS[0]
  const isBaseSelected = assetMatchesOption(baseAsset, baseAssets)
  const isQuoteSelected = assetMatchesOption(quoteAsset, quoteOptions)
  const isBaseUnmatched = normalizeAssetQuery(baseAsset).length > 0 && !isBaseSelected
  const isQuoteUnmatched = normalizeAssetQuery(quoteAsset).length > 0 && !isQuoteSelected
  const hasEvmSigner = Boolean(
    (isEvmConnected || evmWallet.isConnected || activeWallet.chainType === 'evm') &&
      (walletClient?.account?.address ||
        evmAccountAddress ||
        evmWallet.address ||
        (activeWallet.chainType === 'evm' ? activeWallet.address : ''))
  )
  const hasSvmSigner = Boolean(
    (solanaWallet.isConnected || activeWallet.chainType === 'solana') &&
      (solanaWallet.address || (activeWallet.chainType === 'solana' ? activeWallet.address : ''))
  )
  const hasSvmSignFn = solanaWalletWalletSignerReady(solanaWallet.signTransaction)
  const x402PaymentReady =
    (hasEvmSigner && !!walletClient?.account?.address) || (hasSvmSigner && hasSvmSignFn)
  const walletConnecting =
    activeWallet.isConnecting ||
    evmWallet.isConnecting ||
    solanaWallet.isConnecting ||
    (payMethod !== 'promocode' && !hasEvmSigner && !hasSvmSigner && !isEvmStackReady)
  const x402NeedsWalletConnection =
    payMethod === 'x402' && !hasEvmSigner && !hasSvmSigner && !walletConnecting
  const x402WalletPreparing =
    payMethod === 'x402' && !x402NeedsWalletConnection && !x402PaymentReady && !walletConnecting
  const needsWalletConnection = x402NeedsWalletConnection
  const walletPreparing = x402WalletPreparing || walletConnecting
  const payStatusMessage = payError || paySuccess
  const amountsMissing =
    payError === 'Enter a base or quote starting amount.' &&
    !hasPositiveAmount(baseAmount) &&
    !hasPositiveAmount(quoteAmount)
  const payUsdcLabel = (
    <span className="backtest-pay-btn-usdc-label">
      Pay {defaultBidPrice}
      <BacktestUsdcTickerIcon size={14} />
      USDC
    </span>
  )
  const payButtonLabel: ReactNode =
    needsWalletConnection
      ? 'Connect wallet'
      : walletConnecting
      ? 'Connecting…'
      : walletPreparing && hasEvmSigner && !walletClient?.account?.address
      ? 'Switch network'
      : walletPreparing
      ? 'Preparing wallet…'
      : payMethod === 'promocode'
      ? 'QUEUE BACKTEST'
      : payUsdcLabel
  const payButtonAriaLabel = payBusy
    ? payBusyLabel
    : payStatusMessage
      ? payStatusMessage
      : needsWalletConnection
      ? 'Connect wallet to pay with x402'
      : walletConnecting
      ? 'Connecting wallet'
      : walletPreparing && hasEvmSigner && !walletClient?.account?.address
      ? 'Switch wallet network to continue payment'
      : walletPreparing
      ? 'Waiting for wallet signer'
      : payMethod === 'promocode'
      ? 'Run backtest with promocode'
      : `Pay ${defaultBidPrice} USDC and run backtest`

  const backtestApiOrigin = useMemo(
    () =>
      stripTrailingSlash(
        (import.meta.env.VITE_BACKTEST_API_URL || 'http://localhost:8001').trim() ||
          'http://localhost:8001'
      ),
    []
  )
  const paidFetch = useMemo(() => {
    const canPayEvm = Boolean(hasEvmSigner && walletClient?.account?.address)
    const canPaySvm = Boolean(hasSvmSigner && hasSvmSignFn && solanaWallet.address)
    if (!canPayEvm && !canPaySvm) return null

    const preferSolanaForX402 = preferSolanaPayment && canPaySvm
    const client = new (x402Client as any)((_: number, accepts: Array<{ network?: string }>) => {
      const byNetwork = (prefix: string) =>
        accepts.filter((item) => typeof item.network === 'string' && item.network.startsWith(prefix))

      if (preferSolanaForX402) {
        const exactMainnet = accepts.find((item) => item.network === X402_SOLANA_MAINNET)
        if (exactMainnet) return exactMainnet
        const solanaAccepts = byNetwork('solana:')
        if (solanaAccepts.length > 0) return solanaAccepts[0]
      }

      if (walletNetwork?.startsWith('eip155:') || canPayEvm) {
        const exactEvm = walletNetwork
          ? accepts.find((item) => item.network === walletNetwork)
          : undefined
        if (exactEvm) return exactEvm
        const evmAccepts = byNetwork('eip155:')
        if (evmAccepts.length > 0) return evmAccepts[0]
      }

      if (canPaySvm) {
        const exactMainnet = accepts.find((item) => item.network === X402_SOLANA_MAINNET)
        if (exactMainnet) return exactMainnet
        const solanaAccepts = byNetwork('solana:')
        if (solanaAccepts.length > 0) return solanaAccepts[0]
      }

      return accepts[0]
    })
    // x402 defaults maxAmountPerPayment to $1 — blocks custom queue bids above 1 USDC.
    // Amounts are confirmed in the UI (create + bid), so lift the client-side USD ceiling.
    ;(client as any).setSpendControls({ maxAmountPerPayment: false })
    // Always register EVM when available — Solana connected on the wrong cluster must not
    // block Base payments (previous bug: preferSolana skipped EVM registration entirely).
    if (canPayEvm && walletClient?.account) {
      const account = walletClient.account
      registerExactEvmScheme(client, {
        signer: {
          address: account.address,
          signTypedData: (typedData: Parameters<typeof walletClient.signTypedData>[0]) =>
            walletClient.signTypedData({
              ...typedData,
              account,
            }),
        } as any,
      })
    }
    if (canPaySvm && solanaWallet.address) {
      const solanaSignTransaction = solanaWallet.signTransaction
      // Kit TransactionModifyingSigner: wallets (Phantom/Solflare) may inject Lighthouse
      // ixs and change the message. Returning only signatures for the *original* message
      // makes PayAI verify fail with invalid_exact_svm_payload_signature_invalid.
      const svmSigner = {
        address: solanaWallet.address,
        modifyAndSignTransactions: async (transactions: readonly any[]) => {
          return Promise.all(
            transactions.map(async (tx) => {
              const base64Wire = getBase64EncodedWireTransaction(tx)
              const web3Tx = VersionedTransaction.deserialize(Buffer.from(base64Wire, 'base64'))
              const signedWeb3Tx = await solanaSignTransaction!(web3Tx as any)
              return getTransactionDecoder().decode(signedWeb3Tx.serialize())
            })
          )
        },
      }
      // Backtest facilitator only lists Solana mainnet — register that CAIP (and wildcard)
      // with a mainnet RPC even if the wallet UI cluster is still "devnet".
      const rpcUrl =
        import.meta.env.VITE_SOLANA_MAINNET_RPC_URL ||
        import.meta.env.VITE_SOLANA_RPC_URL ||
        'https://api.mainnet-beta.solana.com'
      const svmScheme = new ExactSvmScheme(svmSigner as any, { rpcUrl })
      ;(client as any).register(X402_SOLANA_MAINNET, svmScheme)
      ;(client as any).register('solana:*', svmScheme)
    }
    return wrapFetchWithPayment(fetch, client)
  }, [
    hasEvmSigner,
    hasSvmSignFn,
    hasSvmSigner,
    preferSolanaPayment,
    solanaWallet.address,
    solanaWallet.signTransaction,
    walletClient,
    walletNetwork,
  ])

  const loadQueue = useCallback(
    async (signal?: AbortSignal, opts?: { silent?: boolean }) => {
      const silent = Boolean(opts?.silent)
      if (!silent) {
        setQueueLoading(true)
        setQueueError('')
      }
      try {
        const params = new URLSearchParams({
          limit: '1000',
          sort_by: 'priority',
          sort_order: 'desc',
        })
        const response = await fetch(`${backtestApiOrigin}/queue?${params.toString()}`, { signal })
        const raw = await response.text()
        const payload = raw ? (JSON.parse(raw) as unknown) : []
        if (!response.ok) {
          throw new Error(`Queue request failed with status ${response.status}`)
        }
        if (!Array.isArray(payload)) {
          throw new Error('Queue response is not an array')
        }
        const mapped = payload
          .map((item) => {
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
              status: q.status,
            } satisfies BacktestQueueItem
          })
          .filter((item) => item.status === 'pending' || item.status === 'processing')
          // Keep currently executing job at #1; rest already match worker order from API.
          .sort((a, b) => {
            if (a.status === 'processing' && b.status !== 'processing') return -1
            if (b.status === 'processing' && a.status !== 'processing') return 1
            return 0
          })
        if (signal?.aborted) return
        const scroller = queueScrollerRef.current
        const scrollTop = scroller?.scrollTop ?? 0
        const scrollLeft = scroller?.scrollLeft ?? 0
        setQueueItems((prev) => (queueItemsEqual(prev, mapped) ? prev : mapped))
        if (scroller && (scrollTop > 0 || scrollLeft > 0)) {
          requestAnimationFrame(() => {
            const el = queueScrollerRef.current
            if (!el) return
            el.scrollTop = scrollTop
            el.scrollLeft = scrollLeft
          })
        }
        if (!silent) setQueueError('')
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (signal?.aborted) return
        const message = err instanceof Error ? err.message : 'Failed to load queue'
        if (silent) {
          // Keep current cards on background poll failure — avoid empty flash / jump.
          return
        }
        setQueueError(message)
        setQueueItems([])
      } finally {
        if (!silent) setQueueLoading(false)
      }
    },
    [backtestApiOrigin]
  )

  const loadHistory = useCallback(
    async (signal?: AbortSignal) => {
      setHistoryLoading(true)
      setHistoryError('')
      try {
        const response = await fetch(`${backtestApiOrigin}/stack?limit=200`, { signal })
        const raw = await response.text()
        const payload = raw ? (JSON.parse(raw) as unknown) : []
        if (!response.ok) {
          throw new Error(`History request failed with status ${response.status}`)
        }
        if (!Array.isArray(payload)) {
          throw new Error('History response is not an array')
        }
        const mapped = payload.map((item) => {
          const h = item as ApiHistoryItem
          const periodStart = toDateOnly(h.period_start)
          const periodEnd = toDateOnly(h.period_end)
          const days = daysInclusive(periodStart, periodEnd)
          return {
            id: String(h.id),
            pair: `${h.base_asset} / ${h.quote_asset}`,
            baseAsset: String(h.base_asset || ''),
            quoteAsset: String(h.quote_asset || ''),
            period: `${periodStart} - ${periodEnd}`,
            periodDuration: days === 1 ? '1 day' : `${days} days`,
            baseStart: toCompactAmount(h.base_balance_start),
            baseEnd: toCompactAmount(h.base_balance_end),
            quoteStart: toCompactAmount(h.quote_balance_start),
            quoteEnd: toCompactAmount(h.quote_balance_end),
            pnlBase: toCompactAmount(h.pnl_base),
            pnlQuote: toCompactAmount(h.pnl_quote),
            pnlBasePct: pnlPctOfEnd(h.pnl_base, h.base_balance_end),
            pnlQuotePct: pnlPctOfEnd(h.pnl_quote, h.quote_balance_end),
            priorityUsdc: toAmountString(h.priority_usdc ?? 0, 2),
            creatorAddress: h.creator_address,
          } satisfies BacktestHistoryItem
        })
        if (signal?.aborted) return
        setHistoryItems(mapped)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (signal?.aborted) return
        const message = err instanceof Error ? err.message : 'Failed to load history'
        setHistoryError(message)
        setHistoryItems([])
      } finally {
        setHistoryLoading(false)
      }
    },
    [backtestApiOrigin]
  )

  const loadPriority = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch(`${backtestApiOrigin}/priority`, { signal })
        if (!response.ok) return
        const payload = (await response.json()) as {
          queue_usdc?: string | number
          stack_usdc?: string | number
          total_usdc?: string | number
        }
        if (signal?.aborted) return
        setPriorityTotals({
          queue_usdc: Number(payload.queue_usdc ?? 0) || 0,
          stack_usdc: Number(payload.stack_usdc ?? 0) || 0,
          total_usdc: Number(payload.total_usdc ?? 0) || 0,
        })
      } catch {
        // Keep last known totals when priority endpoint is unavailable.
      }
    },
    [backtestApiOrigin]
  )

  useEffect(() => {
    void loadQueue()
    void loadPriority()
  }, [backtestApiOrigin, loadQueue, loadPriority])

  useEffect(() => {
    const id = window.setInterval(() => {
      void loadQueue(undefined, { silent: true })
      void loadPriority()
    }, 15_000)
    return () => window.clearInterval(id)
  }, [loadQueue, loadPriority])

  useEffect(() => {
    if (queueView !== 'history') return
    void loadHistory()
  }, [loadHistory, queueView])

  useEffect(() => {
    const loadHealth = async () => {
      try {
        const response = await fetch(`${backtestApiOrigin}/health`)
        if (!response.ok) return
        const payload = (await response.json()) as ApiHealth
        setDefaultBidPrice(normalizeUsdcAmount(payload.backtest_price, '1'))
      } catch {
        // Keep defaults if health endpoint unavailable.
      }
    }
    void loadHealth()
  }, [backtestApiOrigin])

  useEffect(() => {
    const ac = new AbortController()
    let buffer = ''
    let sawGrinding = false

    const clearLiveCharts = () => {
      setLiveInventoryHistory([])
      setLiveYieldHistory([])
      setUseLiveCharts(true)
      sawGrinding = false
    }

    const appendLivePoint = <T extends { t: number }>(prev: T[], point: T, replace: boolean): T[] => {
      if (replace) return [point]
      const last = prev[prev.length - 1]
      if (
        last &&
        last.t === point.t &&
        JSON.stringify(last) === JSON.stringify(point)
      ) {
        return prev
      }
      return [...prev.slice(-4999), point]
    }

    const applyLogPayload = (parsed: unknown) => {
      if (!parsed || typeof parsed !== 'object') return
      const o = parsed as Record<string, unknown>
      const status = typeof o.status === 'string' ? o.status : ''

      // Protocol: grind ends GRINDING → INITIALIZED; deconstruct → NOT_INITIALIZED / {}.
      if (sawGrinding && (status === 'INITIALIZED' || status === 'NOT_INITIALIZED')) {
        clearLiveCharts()
        return
      }
      if (Object.keys(o).length === 0) {
        if (sawGrinding) clearLiveCharts()
        return
      }

      const startingRun = status === 'GRINDING' && !sawGrinding
      if (status === 'GRINDING') sawGrinding = true

      const { inventory, yieldPoint } = logEventToChartPoints(parsed)
      if (!inventory && !yieldPoint) return

      setUseLiveCharts(true)
      if (inventory) {
        setLiveInventoryHistory((prev) => appendLivePoint(prev, inventory, startingRun))
      } else if (startingRun) {
        setLiveInventoryHistory([])
      }
      if (yieldPoint) {
        setLiveYieldHistory((prev) => appendLivePoint(prev, yieldPoint, startingRun))
      } else if (startingRun) {
        setLiveYieldHistory([])
      }
    }

    const run = async () => {
      while (!ac.signal.aborted) {
        try {
          const latest = await fetch(`${backtestApiOrigin}/logs`, {
            signal: ac.signal,
            headers: { Accept: 'application/json' },
          })
          if (latest.ok) {
            try {
              applyLogPayload(await latest.json())
            } catch {
              // Ignore malformed latest snapshot.
            }
          }

          const response = await fetch(`${backtestApiOrigin}/logs/stream?interval=1`, {
            signal: ac.signal,
            headers: { Accept: 'text/event-stream' },
          })
          if (!response.ok || !response.body) {
            await new Promise((r) => setTimeout(r, 1000))
            continue
          }
          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          buffer = ''
          while (!ac.signal.aborted) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            buffer = consumeCompleteSseEvents(buffer, (raw) => {
              try {
                applyLogPayload(JSON.parse(raw) as unknown)
              } catch {
                // Ignore malformed SSE frames.
              }
            })
          }
        } catch (err) {
          if ((err as DOMException)?.name === 'AbortError') return
        }
        if (ac.signal.aborted) return
        await new Promise((r) => setTimeout(r, 1000))
      }
    }

    void run()
    return () => ac.abort()
  }, [backtestApiOrigin])

  useEffect(() => {
    const loadSymbols = async () => {
      try {
        const response = await fetch(`${backtestApiOrigin}/symbols`)
        if (!response.ok) return
        const payload = (await response.json()) as ApiSymbols

        const normalizeSymbols = (value: unknown): string[] =>
          Array.isArray(value)
            ? Array.from(
                new Set(
                  value
                    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
                    .map((item) => item.trim().toUpperCase())
                )
              )
            : []

        const nextBaseAssets = normalizeSymbols(payload.base_assets)
        const nextQuoteAssets = normalizeSymbols(payload.quote_assets)
        if (nextBaseAssets.length > 0) setBaseAssets(nextBaseAssets)
        if (nextQuoteAssets.length > 0) setQuoteAssets(nextQuoteAssets)

        const rawIcons = payload.icons
        if (rawIcons && typeof rawIcons === 'object' && !Array.isArray(rawIcons)) {
          const nextIcons: Record<string, string> = {}
          for (const [key, value] of Object.entries(rawIcons as Record<string, unknown>)) {
            const symbol = normalizeAssetQuery(key)
            const url = typeof value === 'string' ? value.trim() : ''
            if (!symbol || !url) continue
            nextIcons[symbol] = url.startsWith('http')
              ? url
              : `${backtestApiOrigin}${url.startsWith('/') ? url : `/${url}`}`
          }
          if (Object.keys(nextIcons).length > 0) setAssetIcons(nextIcons)
        }
      } catch {
        // Keep default symbol lists when symbols endpoint is unavailable.
      }
    }
    void loadSymbols()
  }, [backtestApiOrigin])

  useEffect(() => {
    const scrollToSection = () => {
      const section = readBacktestSectionFromHash()
      if (!section) return
      document
        .getElementById(BACKTEST_SECTION_IDS[section])
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    window.addEventListener('hashchange', scrollToSection)
    window.setTimeout(scrollToSection, 80)
    return () => window.removeEventListener('hashchange', scrollToSection)
  }, [])

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
    if (!baseAssetMenuOpen && !quoteAssetMenuOpen) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (
        baseAssetMenuOpen &&
        baseAssetMenuRef.current &&
        !baseAssetMenuRef.current.contains(target)
      ) {
        setBaseAssetMenuOpen(false)
      }
      if (
        quoteAssetMenuOpen &&
        quoteAssetMenuRef.current &&
        !quoteAssetMenuRef.current.contains(target)
      ) {
        setQuoteAssetMenuOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setBaseAssetMenuOpen(false)
        setQuoteAssetMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [baseAssetMenuOpen, quoteAssetMenuOpen])

  useEffect(() => {
    if (queueView !== 'queue') return
    const el = queueScrollerRef.current
    if (!el) return

    const updateColumns = () => {
      const width = el.clientWidth
      // Snake grid: 3 on desktop, 2 on tablet, 1 on narrow.
      if (width >= 780) setQueueColumns(3)
      else if (width >= 420) setQueueColumns(2)
      else setQueueColumns(1)
    }

    updateColumns()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateColumns) : null
    ro?.observe(el)
    window.addEventListener('resize', updateColumns)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', updateColumns)
    }
  }, [queueView])

  const visibleQueue = useMemo(() => {
    const query = queueSearch.trim().toLowerCase()
    if (!query) return queueItems
    return queueItems.filter((item) => {
      const haystack = [
        item.id,
        item.creatorAddress,
        item.base,
        item.quote,
        item.dateFrom,
        item.dateTo,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [queueItems, queueSearch])
  const visibleHistory = useMemo(() => {
    const query = queueSearch.trim().toLowerCase()
    if (!query) return historyItems
    return historyItems.filter((item) => {
      const haystack = [
        item.id,
        item.creatorAddress,
        item.baseAsset,
        item.quoteAsset,
        item.pair,
        item.period,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [historyItems, queueSearch])
  const isQueueSearchActive = queueSearch.trim().length > 0
  const queuePriorityRaw = priorityTotals.queue_usdc
  const stackPriorityRaw = priorityTotals.stack_usdc
  const totalPriorityRaw = priorityTotals.total_usdc
  const formatUsdc = (value: number) =>
    Number.isFinite(value)
      ? value.toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })
      : '0'
  const totalPaymentsUsdc = useMemo(() => formatUsdc(totalPriorityRaw), [totalPriorityRaw])
  const queuePriorityUsdc = useMemo(() => formatUsdc(queuePriorityRaw), [queuePriorityRaw])
  const stackPriorityUsdc = useMemo(() => formatUsdc(stackPriorityRaw), [stackPriorityRaw])
  const queuePriorityPct = useMemo(
    () => (totalPriorityRaw > 0 ? (queuePriorityRaw / totalPriorityRaw) * 100 : 0),
    [queuePriorityRaw, totalPriorityRaw]
  )
  const stackPriorityPct = useMemo(
    () => (totalPriorityRaw > 0 ? (stackPriorityRaw / totalPriorityRaw) * 100 : 0),
    [stackPriorityRaw, totalPriorityRaw]
  )
  const displayQueue = useMemo(
    () => visibleQueue.slice(0, QUEUE_VISIBLE_COUNT),
    [visibleQueue, QUEUE_VISIBLE_COUNT]
  )
  const queueRows = useMemo(
    () => chunkArray(displayQueue, queueColumns),
    [displayQueue, queueColumns]
  )
  const historyCols = queueColumns
  const historyPageCount = Math.max(1, Math.ceil(visibleHistory.length / QUEUE_VISIBLE_COUNT))
  const pagedHistoryItems = useMemo(() => {
    const start = historyPage * QUEUE_VISIBLE_COUNT
    return visibleHistory.slice(start, start + QUEUE_VISIBLE_COUNT)
  }, [visibleHistory, historyPage, QUEUE_VISIBLE_COUNT])
  const historyRangeStart = visibleHistory.length === 0 ? 0 : historyPage * QUEUE_VISIBLE_COUNT + 1
  const historyRangeEnd = Math.min((historyPage + 1) * QUEUE_VISIBLE_COUNT, visibleHistory.length)
  const showHistoryPagination = visibleHistory.length > QUEUE_VISIBLE_COUNT

  useEffect(() => {
    setHistoryPage((page) => Math.min(page, historyPageCount - 1))
  }, [visibleHistory.length, historyPageCount, QUEUE_VISIBLE_COUNT])

  useEffect(() => {
    setHistoryPage(0)
  }, [queueSearch])

  useEffect(() => {
    if (queueView === 'history') setHistoryPage(0)
  }, [queueView])

  const setQueueViewAnimated = useCallback((next: 'queue' | 'history') => {
    setQueueView((prev) => {
      if (prev === next) return prev
      const el = queueWrapRef.current
      if (el) {
        queueWrapAnimFromRef.current = el.getBoundingClientRect().height
        el.style.height = `${queueWrapAnimFromRef.current}px`
        el.style.overflow = 'hidden'
      }
      return next
    })
  }, [])

  useLayoutEffect(() => {
    const el = queueWrapRef.current
    const from = queueWrapAnimFromRef.current
    if (!el || from == null) return
    queueWrapAnimFromRef.current = null

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    el.style.height = 'auto'
    const to = el.getBoundingClientRect().height

    if (reduceMotion || Math.abs(to - from) < 1) {
      el.style.height = ''
      el.style.overflow = ''
      el.classList.remove('is-height-animating')
      return
    }

    el.style.height = `${from}px`
    void el.offsetHeight
    el.classList.add('is-height-animating')
    el.style.height = `${to}px`

    const onEnd = (event: TransitionEvent) => {
      if (event.target !== el || event.propertyName !== 'height') return
      el.style.height = ''
      el.style.overflow = ''
      el.classList.remove('is-height-animating')
      el.removeEventListener('transitionend', onEnd)
    }
    el.addEventListener('transitionend', onEnd)
    return () => {
      el.removeEventListener('transitionend', onEnd)
    }
  }, [queueView])

  const runningBacktest = useMemo(
    () => queueItems.find((item) => item.status === 'processing') ?? null,
    [queueItems]
  )
  const featuredBacktest = runningBacktest ?? visibleQueue[0] ?? DEMO_BACKTEST_QUEUE[0]
  const featuredRangeDays = useMemo(
    () => daysInclusive(featuredBacktest.dateFrom, featuredBacktest.dateTo),
    [featuredBacktest.dateFrom, featuredBacktest.dateTo]
  )
  const fallbackChartHistory = useMemo(
    () =>
      buildBacktestChartHistory(
        featuredBacktest.dateFrom,
        featuredBacktest.dateTo,
        featuredRangeDays,
        featuredBacktest.baseAmount,
        featuredBacktest.quoteAmount
      ),
    [
      featuredBacktest.baseAmount,
      featuredBacktest.dateFrom,
      featuredBacktest.dateTo,
      featuredBacktest.quoteAmount,
      featuredRangeDays,
    ]
  )
  const backtestChartHistory = useMemo(
    () =>
      useLiveCharts
        ? { inventoryHistory: liveInventoryHistory, yieldHistory: liveYieldHistory }
        : fallbackChartHistory,
    [fallbackChartHistory, liveInventoryHistory, liveYieldHistory, useLiveCharts]
  )

  return (
    <div className="backtest-page">
      <div className="backtest-layout">
        <div className="backtest-create-stack">
          <aside className="backtest-panel backtest-panel--create" id={BACKTEST_SECTION_IDS.create}>
          <div className="backtest-panel-heading" tabIndex={0}>
            <span className="backtest-panel-heading-label">Create Backtest</span>
            <div className="backtest-panel-heading-tip" role="tooltip">
              <span className="backtest-panel-heading-tip-title">How to run</span>
              <ul className="backtest-panel-heading-tip-list">
                <li>
                  <span className="backtest-panel-heading-tip-key">Period</span>
                  UTC dates, max {MAX_BACKTEST_PERIOD_DAYS} days
                </li>
                <li>
                  <span className="backtest-panel-heading-tip-key">Balances</span>
                  at least one starting amount
                </li>
                <li>
                  <span className="backtest-panel-heading-tip-key">Pay</span>
                  x402 or promocode to enqueue
                </li>
                <li>
                  <span className="backtest-panel-heading-tip-key">Runtime</span>
                  ~5 min typical
                </li>
              </ul>
            </div>
          </div>

          <div className="backtest-field">
            <div className="backtest-dates" role="group" aria-label="Backtest date range">
              <div className="backtest-date-col">
                <label className="backtest-sublabel backtest-sublabel--with-icon is-from" htmlFor="backtest-date-from">
                  <span className="backtest-sublabel-icon">{DATE_FIELD_ICONS.from}</span>
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
                <label className="backtest-sublabel backtest-sublabel--with-icon is-to" htmlFor="backtest-date-to">
                  <span className="backtest-sublabel-icon">{DATE_FIELD_ICONS.to}</span>
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
            <p className="backtest-date-limit-note">
              <span className="backtest-date-limit-note-label">Max period:</span>
              <span className="backtest-date-limit-note-value">{MAX_BACKTEST_PERIOD_DAYS} days</span>
              <span className="backtest-date-limit-note-label">· UTC</span>
            </p>
          </div>

          <div className="backtest-pair-card" role="group" aria-label="Trading pair">
            <div className="backtest-pair-row">
              <div className="backtest-pair-col">
                <div className={`backtest-pair-field${amountsMissing ? ' is-invalid' : ''}`}>
                  <label className="backtest-sublabel backtest-sublabel--with-icon is-base" htmlFor="backtest-base-amt">
                    <span className="backtest-sublabel-icon">{PAIR_FIELD_ICONS.base}</span>
                    Base
                  </label>
                  <div className={`backtest-pair-input-row${amountsMissing ? ' is-invalid' : ''}`}>
                    <input
                      id="backtest-base-amt"
                      type="text"
                      inputMode="decimal"
                      className={`backtest-amount-input${amountsMissing ? ' is-invalid' : ''}`}
                      placeholder="0"
                      value={baseAmount}
                      onChange={(e) => {
                        setBaseAmount(sanitizeDecimal(e.target.value))
                        if (payError === 'Enter a base or quote starting amount.') setPayError('')
                      }}
                      aria-invalid={amountsMissing}
                      aria-label={`Amount, ${baseAsset}`}
                    />
                    <div
                      className={`backtest-pair-asset-select-wrap ${baseAssetMenuOpen ? 'is-open' : ''}`}
                      ref={baseAssetMenuRef}
                    >
                      <div
                        className="backtest-pair-asset-trigger"
                        onClick={() => {
                          setQuoteAssetMenuOpen(false)
                          setBaseAssetListAll(true)
                          setBaseAssetMenuOpen(true)
                        }}
                      >
                        <span className="backtest-pair-asset-token">
                          <BacktestAssetIcon symbol={baseAsset} icons={assetIcons} />
                          <input
                            id="backtest-base"
                            type="text"
                            className={`backtest-amount-input backtest-pair-asset-input ${isBaseSelected ? 'is-selected' : ''} ${isBaseUnmatched ? 'is-unmatched' : ''}`}
                            value={baseAsset}
                            size={Math.max(baseAsset.length, 3)}
                            autoComplete="off"
                            spellCheck={false}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const v = e.target.value.toUpperCase()
                              setBaseAsset(v)
                              if (v === 'SOL' && quoteAsset === 'SOL') setQuoteAsset('USDC')
                              setQuoteAssetMenuOpen(false)
                              setBaseAssetListAll(false)
                              setBaseAssetMenuOpen(true)
                            }}
                            onFocus={(e) => {
                              e.stopPropagation()
                              setQuoteAssetMenuOpen(false)
                              setBaseAssetListAll(false)
                              setBaseAssetMenuOpen(true)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                setBaseAssetMenuOpen(false)
                                return
                              }
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                const query = normalizeAssetQuery(e.currentTarget.value)
                                const exact = visibleBaseAssets.find((a) => a === query)
                                const match =
                                  exact ?? (visibleBaseAssets.length === 1 ? visibleBaseAssets[0] : undefined)
                                if (match) {
                                  setBaseAsset(match)
                                  if (match === 'SOL' && quoteAsset === 'SOL') setQuoteAsset('USDC')
                                  setBaseAssetMenuOpen(false)
                                }
                              }
                            }}
                            aria-haspopup="listbox"
                            aria-expanded={baseAssetMenuOpen}
                            aria-invalid={isBaseUnmatched}
                            aria-label="Base asset"
                          />
                          <button
                            type="button"
                            className="backtest-pair-asset-caret-btn"
                            tabIndex={-1}
                            aria-hidden="true"
                            onClick={(e) => {
                              e.stopPropagation()
                              setQuoteAssetMenuOpen(false)
                              setBaseAssetListAll(true)
                              setBaseAssetMenuOpen((open) => !open)
                            }}
                          >
                            <GraiUiCaret className="backtest-pair-asset-caret" />
                          </button>
                        </span>
                      </div>
                      {baseAssetMenuOpen && (
                        <div className="backtest-pair-asset-list" role="listbox" aria-label="Base asset">
                          {visibleBaseAssets.length > 0 ? (
                            visibleBaseAssets.map((a) => (
                              <button
                                key={a}
                                type="button"
                                role="option"
                                aria-selected={normalizeAssetQuery(baseAsset) === a}
                                className={`backtest-pair-asset-list-item ${normalizeAssetQuery(baseAsset) === a ? 'is-active' : ''}`}
                                onClick={() => {
                                  setBaseAsset(a)
                                  if (a === 'SOL' && quoteAsset === 'SOL') setQuoteAsset('USDC')
                                  setBaseAssetMenuOpen(false)
                                }}
                              >
                                <BacktestAssetIcon symbol={a} size={20} icons={assetIcons} />
                                {a}
                              </button>
                            ))
                          ) : (
                            <p className="backtest-pair-asset-list-empty">No matches</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="backtest-pair-col">
                <div className={`backtest-pair-field${amountsMissing ? ' is-invalid' : ''}`}>
                  <label className="backtest-sublabel backtest-sublabel--with-icon is-quote" htmlFor="backtest-quote-amt">
                    <span className="backtest-sublabel-icon">{PAIR_FIELD_ICONS.quote}</span>
                    Quote
                  </label>
                  <div className={`backtest-pair-input-row${amountsMissing ? ' is-invalid' : ''}`}>
                    <input
                      id="backtest-quote-amt"
                      type="text"
                      inputMode="decimal"
                      className={`backtest-amount-input${amountsMissing ? ' is-invalid' : ''}`}
                      placeholder="0"
                      value={quoteAmount}
                      onChange={(e) => {
                        setQuoteAmount(sanitizeDecimal(e.target.value))
                        if (payError === 'Enter a base or quote starting amount.') setPayError('')
                      }}
                      aria-invalid={amountsMissing}
                      aria-label={`Amount, ${quoteAsset}`}
                    />
                    <div
                      className={`backtest-pair-asset-select-wrap ${quoteAssetMenuOpen ? 'is-open' : ''}`}
                      ref={quoteAssetMenuRef}
                    >
                      <div
                        className="backtest-pair-asset-trigger"
                        onClick={() => {
                          setBaseAssetMenuOpen(false)
                          setQuoteAssetListAll(true)
                          setQuoteAssetMenuOpen(true)
                        }}
                      >
                        <span className="backtest-pair-asset-token">
                          <BacktestAssetIcon symbol={quoteAsset} icons={assetIcons} />
                          <input
                            id="backtest-quote"
                            type="text"
                            className={`backtest-amount-input backtest-pair-asset-input ${isQuoteSelected ? 'is-selected' : ''} ${isQuoteUnmatched ? 'is-unmatched' : ''}`}
                            value={quoteAsset}
                            size={Math.max(quoteAsset.length, 3)}
                            autoComplete="off"
                            spellCheck={false}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              setQuoteAsset(e.target.value.toUpperCase())
                              setBaseAssetMenuOpen(false)
                              setQuoteAssetListAll(false)
                              setQuoteAssetMenuOpen(true)
                            }}
                            onFocus={(e) => {
                              e.stopPropagation()
                              setBaseAssetMenuOpen(false)
                              setQuoteAssetListAll(false)
                              setQuoteAssetMenuOpen(true)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                setQuoteAssetMenuOpen(false)
                                return
                              }
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                const query = normalizeAssetQuery(e.currentTarget.value)
                                const exact = visibleQuoteAssets.find((a) => a === query)
                                const match =
                                  exact ?? (visibleQuoteAssets.length === 1 ? visibleQuoteAssets[0] : undefined)
                                if (match) {
                                  setQuoteAsset(match)
                                  setQuoteAssetMenuOpen(false)
                                }
                              }
                            }}
                            aria-haspopup="listbox"
                            aria-expanded={quoteAssetMenuOpen}
                            aria-invalid={isQuoteUnmatched}
                            aria-label="Quote asset"
                          />
                          <button
                            type="button"
                            className="backtest-pair-asset-caret-btn"
                            tabIndex={-1}
                            aria-hidden="true"
                            onClick={(e) => {
                              e.stopPropagation()
                              setBaseAssetMenuOpen(false)
                              setQuoteAssetListAll(true)
                              setQuoteAssetMenuOpen((open) => !open)
                            }}
                          >
                            <GraiUiCaret className="backtest-pair-asset-caret" />
                          </button>
                        </span>
                      </div>
                      {quoteAssetMenuOpen && (
                        <div className="backtest-pair-asset-list" role="listbox" aria-label="Quote asset">
                          {visibleQuoteAssets.length > 0 ? (
                            visibleQuoteAssets.map((a) => (
                              <button
                                key={a}
                                type="button"
                                role="option"
                                aria-selected={normalizeAssetQuery(quoteAsset) === a}
                                className={`backtest-pair-asset-list-item ${normalizeAssetQuery(quoteAsset) === a ? 'is-active' : ''}`}
                                onClick={() => {
                                  setQuoteAsset(a)
                                  setQuoteAssetMenuOpen(false)
                                }}
                              >
                                <BacktestAssetIcon symbol={a} size={20} icons={assetIcons} />
                                {a}
                              </button>
                            ))
                          ) : (
                            <p className="backtest-pair-asset-list-empty">No matches</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="backtest-pay-block">
            <div className="backtest-pay-actions-wrap" ref={payMethodWrapRef}>
              <div className="backtest-pay-actions-row">
                <div className="backtest-pay-actions">
                  <div className="backtest-pay-method-wrap">
                    <span className="backtest-pay-method-caption backtest-pay-method-caption--with-icon">
                      <span className="backtest-pay-method-caption-icon">{PAY_METHOD_CAPTION_ICON}</span>
                      Payment method
                    </span>
                    <div className="backtest-pay-method-control">
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
                          <span className="backtest-pay-method-option-icon" aria-hidden="true">
                            {PAY_METHOD_ICON[payMethod]}
                          </span>
                          {PAY_METHOD_LABEL[payMethod]}
                        </span>
                        <GraiUiCaret className="backtest-pay-method-caret" />
                      </button>
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
                                setPayError('')
                                setPaySuccess('')
                                setShowX402NetworkSwitch(false)
                                setPayMenuOpen(false)
                              }}
                            >
                              <span className="backtest-pay-method-option-icon" aria-hidden="true">
                                {PAY_METHOD_ICON[m]}
                              </span>
                              {PAY_METHOD_LABEL[m]}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {payMethod === 'promocode' ? (
                    <div className="backtest-promocode-inline-wrap backtest-promocode-inline-wrap--in-actions">
                      <div className="backtest-promocode-inline">
                        <input
                          id="backtest-promocode-inline"
                          type="text"
                          className="backtest-promo-input"
                          value={promocode}
                          onChange={(e) => setPromocode(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              void handlePay()
                            }
                          }}
                          placeholder="Enter promocode"
                          autoComplete="off"
                          spellCheck={false}
                          aria-label="Promocode"
                        />
                      </div>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className={`backtest-pay-btn${
                      payBusy
                        ? ''
                        : payError
                          ? ' is-status is-error'
                          : paySuccess
                            ? ' is-status is-success'
                            : ''
                    }`}
                    onClick={() => {
                      if (needsWalletConnection) {
                        setPayError('')
                        openChainSelector()
                        return
                      }
                      if (walletPreparing) {
                        if (hasEvmSigner && !walletClient?.account?.address) {
                          setPayError('x402 needs Base (or Solana). Switch network, then try again.')
                          if (payMethod === 'x402') setShowX402NetworkSwitch(true)
                        }
                        return
                      }
                      void handlePay()
                    }}
                    disabled={
                      payBusy ||
                      (walletPreparing && !(hasEvmSigner && !walletClient?.account?.address))
                    }
                    aria-label={payButtonAriaLabel}
                    aria-live="polite"
                  >
                    {payBusy ? (
                      payBusyLabel
                    ) : payStatusMessage ? (
                      <span className="backtest-pay-btn-status">{payStatusMessage}</span>
                    ) : needsWalletConnection ? (
                      <>
                        <svg
                          className="backtest-pay-btn-icon"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden="true"
                        >
                          <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h13A2.5 2.5 0 0 1 21 8.5v7A2.5 2.5 0 0 1 18.5 18h-13A2.5 2.5 0 0 1 3 15.5v-7Z" />
                          <path d="M15 12h6" />
                          <circle cx="15.5" cy="12" r="1" fill="currentColor" stroke="none" />
                        </svg>
                        Connect wallet
                      </>
                    ) : (
                      payButtonLabel
                    )}
                  </button>
                  <p className="backtest-time-estimate-note">Est. backtest time ~ 5 min</p>
                </div>
              </div>
            </div>
            {showX402NetworkSwitch && payMethod === 'x402' && (
              <div className="backtest-network-switch" aria-live="polite">
                <span className="backtest-network-switch-label">Switch network to:</span>
                <button type="button" className="backtest-network-switch-btn" onClick={handleSwitchBase}>
                  Base
                </button>
                <button type="button" className="backtest-network-switch-btn" onClick={handleSwitchSolana}>
                  Solana
                </button>
              </div>
            )}
          </div>
          </aside>
        </div>
        <div className="backtest-panel-wrap">
          <section
            className="backtest-main"
            id={BACKTEST_SECTION_IDS.queue}
            aria-label="Backtest results"
          >
          <div
            ref={queueWrapRef}
            className={`backtest-queue-wrap ${queueView === 'history' ? 'is-history' : ''}`}
            role="region"
            aria-label={queueView === 'queue' ? 'Queue' : 'Stack'}
          >
            <div
              className="backtest-queue-head"
              style={{ ['--queue-cols' as string]: String(queueColumns) }}
            >
              <div className="backtest-queue-head-start">
                <div className="backtest-queue-view-block">
                  <div className="backtest-queue-view-switch" role="tablist" aria-label="Queue data view">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={queueView === 'queue'}
                      className={`backtest-queue-view-btn is-queue ${queueView === 'queue' ? 'is-active' : ''}`}
                      onClick={() => setQueueViewAnimated('queue')}
                    >
                      Queue
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={queueView === 'history'}
                      className={`backtest-queue-view-btn is-stack ${queueView === 'history' ? 'is-active' : ''}`}
                      onClick={() => setQueueViewAnimated('history')}
                    >
                      Stack
                    </button>
                  </div>
                  <div className="backtest-queue-view-stats" aria-hidden="true">
                    <span className="backtest-queue-view-stat is-queue">
                      <span className="backtest-payments-dot is-queue" />
                      {queuePriorityUsdc} USDC ({queuePriorityPct.toFixed(1)}%)
                    </span>
                    <span className="backtest-queue-view-stat is-stack">
                      <span className="backtest-payments-dot is-stack" />
                      {stackPriorityUsdc} USDC ({stackPriorityPct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
              <section
                className="backtest-payments-summary backtest-payments-summary--head"
                id={BACKTEST_SECTION_IDS.priority}
                aria-label="Payments summary"
              >
                <div className="backtest-payments-summary-head">
                  <span className="backtest-payments-summary-title">Total bid</span>
                  <span className="backtest-payments-summary-value">
                    {totalPaymentsUsdc} <BacktestUsdcTickerIcon />
                    USDC
                  </span>
                </div>
                <div className="backtest-payments-infographic">
                  <div className="backtest-payments-bar" aria-hidden="true">
                    <span
                      className="backtest-payments-bar-segment is-queue"
                      style={{ width: `${queuePriorityPct}%` }}
                    />
                    <span
                      className="backtest-payments-bar-segment is-stack"
                      style={{ width: `${stackPriorityPct}%` }}
                    />
                  </div>
                </div>
              </section>
              <div className="backtest-queue-sort" aria-label="Search">
                <div className="backtest-queue-search-wrap">
                  <input
                    ref={queueSearchInputRef}
                    type="search"
                    className="backtest-queue-search-input"
                    value={queueSearch}
                    onChange={(e) => setQueueSearch(e.target.value)}
                    placeholder="ID / Creator Address"
                    aria-label={queueView === 'queue' ? 'Search in queue' : 'Search in stack'}
                  />
                  <button
                    type="button"
                    className="backtest-queue-search-btn"
                    onClick={() => {
                      setQueueSearch((prev) => prev.trim())
                      queueSearchInputRef.current?.focus()
                    }}
                    aria-label={queueView === 'queue' ? 'Search queue' : 'Search stack'}
                  >
                    <svg
                      className="backtest-queue-search-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="11" cy="11" r="7" />
                      <path d="m20 20-3.5-3.5" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            {queueView === 'queue' ? (
              <div
                id="backtest-queue-scroller"
                className="backtest-queue-scroller is-extended"
                ref={queueScrollerRef}
                tabIndex={0}
                aria-label="Scroll horizontally to browse the backtest queue"
              >
                <div
                  className={`backtest-queue-grid-rows ${
                    isQueueSearchActive ? 'is-no-connectors' : ''
                  }`}
                  style={{ ['--queue-cols' as string]: String(queueColumns) }}
                  role="list"
                >
                  {queueRows.map((row, rowIdx) => {
                    const isReverse = rowIdx % 2 === 1
                    const visualRow = row
                    const showConnectors = !isQueueSearchActive
                    return (
                      <div
                        key={`queue-row-${rowIdx}`}
                        className={`backtest-queue-grid-row ${isReverse ? 'is-reverse' : ''} ${
                          rowIdx < queueRows.length - 1 ? 'has-next' : ''
                        }`}
                        role="listitem"
                      >
                        {visualRow.map((item, visualIdx) => {
                          const originalIdx = visibleQueue.findIndex((q) => q.id === item.id)
                          const isPriorityView = !isQueueSearchActive
                          return (
                            <div
                              key={item.id}
                              className={`backtest-queue-item ${
                              showConnectors && visualIdx > 0 ? 'has-connector' : ''
                              } ${
                              !showConnectors && isQueueSearchActive && visualIdx > 0 ? 'has-divider' : ''
                              } ${
                              showConnectors &&
                              visualIdx === visualRow.length - 1 &&
                              rowIdx < queueRows.length - 1
                                  ? 'has-next-link'
                                  : ''
                              }`}
                            >
                              <div
                                className={`backtest-queue-card ${
                                  isPriorityView && originalIdx === 0
                                    ? 'backtest-queue-card--leader'
                                    : isPriorityView && originalIdx === 1
                                      ? 'backtest-queue-card--second'
                                      : ''
                                }`}
                                title={`${item.base} / ${item.quote}, ${item.dateFrom} – ${item.dateTo}, ${item.baseAmount} ${item.base}, ${item.quoteAmount} ${item.quote}, ${item.creatorAddress}`}
                              >
                              <span
                                className={`backtest-queue-index ${
                                  isPriorityView && originalIdx === 1
                                    ? 'is-second-priority'
                                    : isPriorityView && originalIdx === 2
                                      ? 'is-third-priority'
                                      : ''
                                }`.trim()}
                              >
                                #{originalIdx + 1}
                              </span>
                              <span className="backtest-queue-pair">
                                ID: {shortenCreatorAddress(item.id, 6, 4)}
                              </span>
                              <div className="backtest-queue-grid">
                                <span className="backtest-queue-date-start">
                                  <span className="backtest-queue-date-label">from</span>
                                  {item.dateFrom}
                                </span>
                                <span className="backtest-queue-amt-base">
                                  {item.baseAmount} {item.base}
                                </span>
                                <span className="backtest-queue-date-end">
                                  <span className="backtest-queue-date-label">to</span>
                                  {item.dateTo}
                                </span>
                                <span className="backtest-queue-amt-quote">
                                  {item.quoteAmount} {item.quote}
                                </span>
                              </div>
                              <div className="backtest-queue-creator">
                                <div className="backtest-queue-creator-top">
                                  <span className="backtest-queue-creator-label">Creator</span>
                                  <span className="backtest-queue-priority-label">BID</span>
                                </div>
                                <div className="backtest-queue-creator-bottom">
                                  <span className="backtest-queue-creator-main">
                                    <span
                                      className="backtest-queue-creator-addr"
                                      title={item.creatorAddress}
                                    >
                                      {shortenCreatorAddress(item.creatorAddress)}
                                    </span>
                                    <button
                                      type="button"
                                      className="backtest-queue-creator-copy"
                                      onClick={() => {
                                        void navigator.clipboard.writeText(item.creatorAddress)
                                      }}
                                      aria-label={`Copy creator address ${item.creatorAddress}`}
                                      title="Copy creator address"
                                    >
                                      ⧉
                                    </button>
                                  </span>
                                  <span className="backtest-queue-priority-value">
                                    {item.usdcPaid} USDC
                                  </span>
                                </div>
                              </div>
                              {originalIdx === 0 ? (
                                <div className="backtest-queue-executing" role="status">
                                  <span className="backtest-queue-executing-dot" aria-hidden />
                                  <span className="backtest-queue-executing-label">Executing…</span>
                                </div>
                              ) : (
                              <div
                                className={`backtest-queue-bid-row ${
                                  queueBidCustomOpen[item.id] ? 'is-custom' : ''
                                }`}
                              >
                                {!queueBidCustomOpen[item.id] ? (
                                  <div className="backtest-queue-bid-default-stack">
                                    <button
                                      type="button"
                                      className="backtest-queue-bid-btn"
                                      onClick={() => handleQueueBidOneUsdc(item.id)}
                                    >
                                      BID {defaultBidPrice} USDC
                                    </button>
                                    <button
                                      type="button"
                                      className="backtest-queue-bid-btn backtest-queue-bid-btn--secondary"
                                      onClick={() =>
                                        setQueueBidCustomOpen((prev) => ({ ...prev, [item.id]: true }))
                                      }
                                    >
                                      BID CUSTOM
                                    </button>
                                  </div>
                                ) : (
                                  <div className="backtest-queue-bid-custom-inline">
                                    <button
                                      type="button"
                                      className="backtest-queue-bid-btn backtest-queue-bid-btn--secondary"
                                      onClick={() =>
                                        setQueueBidCustomOpen((prev) => ({ ...prev, [item.id]: false }))
                                      }
                                    >
                                      BACK
                                    </button>
                                    <div className="backtest-queue-bid-custom-submit-row">
                                      <div className="backtest-queue-bid-input-wrap">
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          className="backtest-queue-bid-input"
                                          placeholder={`min ${MIN_QUEUE_BID_USDC}`}
                                          value={queueBidValues[item.id] ?? ''}
                                          onChange={(e) => handleQueueBidChange(item.id, e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault()
                                              void handleQueueBidSubmit(item.id)
                                            }
                                          }}
                                          aria-label={`Bid amount for queue item #${originalIdx + 1} (minimum ${MIN_QUEUE_BID_USDC} USDC)`}
                                          aria-invalid={
                                            Boolean((queueBidValues[item.id] ?? '').trim()) &&
                                            !isValidQueueBidAmount(queueBidValues[item.id] ?? '')
                                          }
                                        />
                                        <span className="backtest-queue-bid-suffix">USDC</span>
                                      </div>
                                      <button
                                        type="button"
                                        className="backtest-queue-bid-btn"
                                        onClick={() => void handleQueueBidSubmit(item.id)}
                                        disabled={
                                          !isValidQueueBidAmount(queueBidValues[item.id] ?? '') ||
                                          !!queueBidBusy[item.id]
                                        }
                                      >
                                        {queueBidBusy[item.id] ? 'BIDDING…' : 'BID'}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                              )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <>
              <div
                className="backtest-history-list"
                style={{ ['--history-cols' as string]: String(historyCols) }}
                aria-label="Backtest history PnL list"
              >
                {pagedHistoryItems.map((item, index) => {
                  const col = index % historyCols
                  const isReverseRow = Math.floor(index / historyCols) % 2 === 1
                  const hasConnector = col > 0
                  const hasNextRow = index + historyCols < pagedHistoryItems.length
                  const hasNextLink = isReverseRow
                    ? col === 0 && hasNextRow
                    : col === historyCols - 1 && hasNextRow
                  return (
                  <div
                    key={item.id}
                    className={[
                      'backtest-history-item',
                      hasConnector ? 'has-connector' : '',
                      isReverseRow && hasConnector ? 'is-reverse' : '',
                      hasNextLink ? 'has-next-link' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                  <article className="backtest-history-card">
                    <div className="backtest-history-main">
                      <div className="backtest-history-headline">
                        <div className="backtest-history-id-row">
                          <button
                            type="button"
                            className="backtest-history-id"
                            title={copiedHistoryId === item.id ? 'Copied' : `Copy ${item.id}`}
                            aria-label={
                              copiedHistoryId === item.id
                                ? 'Copied history id'
                                : `Copy history id ${item.id}`
                            }
                            onClick={() => {
                              void navigator.clipboard.writeText(item.id).then(() => {
                                setCopiedHistoryId(item.id)
                                window.setTimeout(() => {
                                  setCopiedHistoryId((cur) => (cur === item.id ? '' : cur))
                                }, 1500)
                              })
                            }}
                          >
                            ID: {shortenCreatorAddress(item.id, 6, 4)}
                          </button>
                        </div>
                        <div className="backtest-history-period-meta">
                          <span className="backtest-history-index">
                            #{historyPage * QUEUE_VISIBLE_COUNT + index + 1}
                          </span>
                        </div>
                        <div className="backtest-history-period-range">
                          {(() => {
                            const [from, to] = item.period.split(' - ')
                            return (
                              <>
                                <span>
                                  <span className="backtest-history-period-label">FROM</span>
                                  <span>{from}</span>
                                </span>
                                <span>
                                  <span className="backtest-history-period-label">TO</span>
                                  <span>{to ?? from}</span>
                                </span>
                                <div className="backtest-history-period-duration">
                                  <span className="backtest-history-period-label">PERIOD</span>
                                  <span>{item.periodDuration}</span>
                                </div>
                              </>
                            )
                          })()}
                        </div>
                        <div className="backtest-history-pair">
                          <span>
                            <span className="backtest-history-pair-amount">{item.baseStart}</span>
                            <span className="backtest-history-pair-asset">{item.baseAsset}</span>
                          </span>
                          <span>
                            <span className="backtest-history-pair-amount">{item.quoteStart}</span>
                            <span className="backtest-history-pair-asset">{item.quoteAsset}</span>
                          </span>
                        </div>
                      </div>
                      <div className="backtest-history-meta">
                        <button
                          type="button"
                          className="backtest-history-creator"
                          title={
                            copiedCreatorKey === item.id
                              ? 'Copied'
                              : `Copy ${item.creatorAddress}`
                          }
                          aria-label={
                            copiedCreatorKey === item.id
                              ? 'Copied creator address'
                              : `Copy creator address ${item.creatorAddress}`
                          }
                          onClick={() => {
                            void navigator.clipboard.writeText(item.creatorAddress).then(() => {
                              setCopiedCreatorKey(item.id)
                              window.setTimeout(() => {
                                setCopiedCreatorKey((cur) => (cur === item.id ? '' : cur))
                              }, 1500)
                            })
                          }}
                        >
                          {copiedCreatorKey === item.id
                            ? 'Copied'
                            : shortenCreatorAddress(item.creatorAddress)}
                        </button>
                        <div className="backtest-history-priority" title="Priority paid">
                          <span className="backtest-history-priority-value">{item.priorityUsdc}</span>
                          <BacktestUsdcTickerIcon size={11} />
                          <span className="backtest-history-priority-unit">USDC</span>
                        </div>
                      </div>
                    </div>
                    <div className="backtest-history-stats">
                      <div className="backtest-history-balances" aria-label="Balances end and PnL">
                        <div className="backtest-history-balances-head" aria-hidden="true">
                          <span />
                          <span>End balance</span>
                          <span
                            className="backtest-history-pnl-head"
                            tabIndex={0}
                            aria-label="PnL percent equals PnL divided by absolute end balance times 100, per asset"
                          >
                            PnL
                            <span className="backtest-history-pnl-tip" role="tooltip">
                              <span className="backtest-history-pnl-tip-label">Share of end balance</span>
                              <span className="backtest-history-pnl-tip-formula" aria-hidden="true">
                                <span className="backtest-history-pnl-tip-lhs">PnL%</span>
                                <span className="backtest-history-pnl-tip-eq">=</span>
                                <span className="backtest-history-pnl-tip-frac">
                                  <span className="backtest-history-pnl-tip-num">PnL</span>
                                  <span className="backtest-history-pnl-tip-den">|end balance|</span>
                                </span>
                                <span className="backtest-history-pnl-tip-times">× 100</span>
                              </span>
                              <span className="backtest-history-pnl-tip-note">
                                Per asset · same row as the End balance column
                              </span>
                            </span>
                          </span>
                        </div>
                        <div className="backtest-history-balances-row">
                          <span className="backtest-history-balances-asset">{item.baseAsset}</span>
                          <span className="backtest-history-balances-num">{item.baseEnd}</span>
                          <span
                            className={`backtest-history-balances-num backtest-history-pnl-cell ${pnlToneClass(item.pnlBase)}`}
                            title={`${item.pnlBase} (${item.pnlBasePct})`}
                          >
                            <span className="backtest-history-pnl-amt">{item.pnlBase}</span>
                            <span className="backtest-history-pnl-pct">{item.pnlBasePct}</span>
                          </span>
                        </div>
                        <div className="backtest-history-balances-row">
                          <span className="backtest-history-balances-asset">{item.quoteAsset}</span>
                          <span className="backtest-history-balances-num">{item.quoteEnd}</span>
                          <span
                            className={`backtest-history-balances-num backtest-history-pnl-cell ${pnlToneClass(item.pnlQuote)}`}
                            title={`${item.pnlQuote} (${item.pnlQuotePct})`}
                          >
                            <span className="backtest-history-pnl-amt">{item.pnlQuote}</span>
                            <span className="backtest-history-pnl-pct">{item.pnlQuotePct}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                  </div>
                  )
                })}
              </div>
              {showHistoryPagination ? (
                <div
                  className="backtest-history-pagination"
                  role="navigation"
                  aria-label="History pagination"
                >
                  <button
                    type="button"
                    className="backtest-history-pagination-btn"
                    onClick={() => setHistoryPage((page) => Math.max(0, page - 1))}
                    disabled={historyPage === 0}
                    aria-label="Previous history page"
                  >
                    Prev
                  </button>
                  <span className="backtest-history-pagination-status" aria-live="polite">
                    {historyRangeStart}–{historyRangeEnd} of {visibleHistory.length}
                  </span>
                  <button
                    type="button"
                    className="backtest-history-pagination-btn"
                    onClick={() =>
                      setHistoryPage((page) => Math.min(historyPageCount - 1, page + 1))
                    }
                    disabled={historyPage >= historyPageCount - 1}
                    aria-label="Next history page"
                  >
                    Next
                  </button>
                </div>
              ) : null}
              </>
            )}
            {queueView === 'queue' && queueLoading && visibleQueue.length === 0 && (
              <div className="backtest-queue-end-hint">Loading queue…</div>
            )}
            {queueView === 'queue' && !queueLoading && queueError && <div className="backtest-queue-end-hint">{queueError}</div>}
            {queueView === 'queue' && !queueLoading && !queueError && visibleQueue.length === 0 && (
              isQueueSearchActive ? (
                <div className="backtest-queue-end-hint">No matches in queue.</div>
              ) : (
                <div className="backtest-queue-empty" aria-label="Queue is empty">
                  <svg
                    className="backtest-queue-empty-art"
                    viewBox="0 0 420 120"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      className="backtest-queue-empty-path"
                      d="M48 42 H168 M168 42 H288 M288 42 H372 V84 H288 M288 84 H168 M168 84 H48"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <g className="backtest-queue-empty-card is-a">
                      <rect x="28" y="22" width="88" height="40" rx="8" />
                      <path d="M42 36 H86 M42 48 H74" />
                    </g>
                    <g className="backtest-queue-empty-card is-b">
                      <rect x="148" y="22" width="88" height="40" rx="8" />
                      <path d="M162 36 H206 M162 48 H194" />
                    </g>
                    <g className="backtest-queue-empty-card is-c">
                      <rect x="268" y="22" width="88" height="40" rx="8" />
                      <path d="M282 36 H326 M282 48 H314" />
                    </g>
                    <g className="backtest-queue-empty-card is-d">
                      <rect x="268" y="64" width="88" height="40" rx="8" />
                      <path d="M282 78 H326 M282 90 H314" />
                    </g>
                    <g className="backtest-queue-empty-card is-e">
                      <rect x="148" y="64" width="88" height="40" rx="8" />
                      <path d="M162 78 H206 M162 90 H194" />
                    </g>
                    <g className="backtest-queue-empty-card is-f">
                      <rect x="28" y="64" width="88" height="40" rx="8" />
                      <path d="M42 78 H86 M42 90 H74" />
                    </g>
                  </svg>
                  <div className="backtest-queue-empty-dots" aria-hidden="true">
                    <span className="backtest-queue-empty-dot" />
                    <span className="backtest-queue-empty-dot is-mid" />
                    <span className="backtest-queue-empty-dot is-late" />
                  </div>
                  <p className="backtest-queue-empty-title">Queue is clear</p>
                  <p className="backtest-queue-empty-copy">
                    Create a backtest above — it lands here in bid order.
                  </p>
                </div>
              )
            )}
            {queueView === 'history' && historyLoading && <div className="backtest-queue-end-hint">Loading history…</div>}
            {queueView === 'history' && !historyLoading && historyError && (
              <div className="backtest-queue-end-hint">{historyError}</div>
            )}
            {queueView === 'history' && !historyLoading && !historyError && historyItems.length === 0 && (
              <div className="backtest-queue-end-hint">History is empty.</div>
            )}
            {queueView === 'history' &&
              !historyLoading &&
              !historyError &&
              historyItems.length > 0 &&
              visibleHistory.length === 0 && (
              <div className="backtest-queue-end-hint">No matches in stack.</div>
            )}
          </div>
          </section>
        </div>
        <section
          className="backtest-results-card"
          id={BACKTEST_SECTION_IDS.results}
          aria-label="Backtest output"
        >
          <h1 className="backtest-main-title">Backtest</h1>
          {runningBacktest ? (
            <div className="backtest-main-running-row">
              <p className="backtest-main-running-id">
                <button
                  type="button"
                  className="backtest-main-running-id-btn"
                  title={copiedHistoryId === runningBacktest.id ? 'Copied' : `Copy ${runningBacktest.id}`}
                  aria-label={
                    copiedHistoryId === runningBacktest.id
                      ? 'Copied running backtest id'
                      : `Copy running backtest id ${runningBacktest.id}`
                  }
                  onClick={() => {
                    void navigator.clipboard.writeText(runningBacktest.id).then(() => {
                      setCopiedHistoryId(runningBacktest.id)
                      window.setTimeout(() => {
                        setCopiedHistoryId((cur) => (cur === runningBacktest.id ? '' : cur))
                      }, 1500)
                    })
                  }}
                >
                  ID: {shortenCreatorAddress(runningBacktest.id, 8, 6)}
                </button>
              </p>
            </div>
          ) : null}
          <p className="backtest-main-subtitle">
            {runningBacktest ? (
              <>
                Pair <strong>{featuredBacktest.base}</strong> / <strong>{featuredBacktest.quote}</strong>,{' '}
                <strong>
                  {featuredBacktest.dateFrom} – {featuredBacktest.dateTo}
                </strong>{' '}
                ({featuredRangeDays} days).
              </>
            ) : (
              'Live inventory & yield while a backtest is grinding.'
            )}
          </p>
          <div className="grinder-adapter-tab-main-grid" aria-label="Backtest charts">
            <div className="adapter-tab-content adapter-tab-content--inventory grinder-adapter-tab-main__inventory backtest-chart-panel">
              <div className="grinder-adapter-tab-main-panel-head">
                <span className="grinder-adapter-tab-main-panel-head-icon" aria-hidden>
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="7" height="7" rx="1" fill="none" />
                    <rect x="14" y="3" width="7" height="7" rx="1" fill="none" />
                    <rect x="14" y="14" width="7" height="7" rx="1" fill="none" />
                    <rect x="3" y="14" width="7" height="7" rx="1" fill="none" />
                  </svg>
                </span>
                <span className="grinder-adapter-tab-main-panel-head-title">Inventory</span>
              </div>
              <InventoryHistoryChart
                history={runningBacktest ? backtestChartHistory.inventoryHistory : []}
                baseAsset={featuredBacktest.base}
                quoteAsset={featuredBacktest.quote}
                emptyMessage={runningBacktest ? undefined : 'no intime grinding'}
              />
            </div>
            <div className="adapter-tab-content grinder-adapter-tab-main__yield backtest-chart-panel">
              <div className="grinder-adapter-tab-main-panel-head">
                <span className="grinder-adapter-tab-main-panel-head-icon" aria-hidden>
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 3v18h18" />
                    <path d="M7 16l4-4 4 4 6-7" />
                  </svg>
                </span>
                <span className="grinder-adapter-tab-main-panel-head-title">Yield</span>
              </div>
              <YieldChart
                history={runningBacktest ? backtestChartHistory.yieldHistory : []}
                baseAsset={featuredBacktest.base}
                quoteAsset={featuredBacktest.quote}
                emptyMessage={runningBacktest ? undefined : 'no intime grinding'}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default BacktestPage

function solanaWalletWalletSignerReady(
  signTransaction: unknown
): signTransaction is (tx: unknown) => Promise<{ serialize: () => Uint8Array }> {
  return typeof signTransaction === 'function'
}
