import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { x402Client, wrapFetchWithPayment } from '@x402/fetch'
import { registerExactEvmScheme } from '@x402/evm/exact/client'
import { ExactSvmScheme } from '@x402/svm/exact/client'
import { getBase64EncodedWireTransaction, getTransactionDecoder } from '@solana/kit'
import { VersionedTransaction } from '@solana/web3.js'
import { Buffer } from 'buffer'
import { useAccount, useChainId, useSwitchChain, useWalletClient } from 'wagmi'
import { useSolanaWallet } from '../hooks/useSolanaWallet'
import { ChainSelectorModal } from '../components/ChainSelectorModal'
import './BacktestPage.css'

const BASE_ASSETS = ['ETH', 'BTC', 'SOL', 'ARB', 'MATIC'] as const
const QUOTE_ASSETS = ['USDC', 'USDT', 'USD', 'SOL'] as const

const PAY_METHODS = ['x402', 'kirapay', 'promocode'] as const
type PayMethod = (typeof PAY_METHODS)[number]
const PAY_METHOD_LABEL: Record<PayMethod, string> = {
  x402: 'x402',
  kirapay: 'kirapay',
  promocode: 'promocode',
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

type ApiHistoryItem = {
  id: string
  base_asset: string
  quote_asset: string
  period_start: string
  period_end: string
  pnl_base: string | number
  pnl_quote: string | number
  creator_address: string
}

type BacktestHistoryItem = {
  id: string
  pair: string
  period: string
  pnlBase: string
  pnlQuote: string
  creatorAddress: string
}

type ApiHealth = {
  status: string
  backtest_price?: string
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
    const code = typeof o.code === 'string' ? o.code : ''
    if (code === 'promocode_missing') return 'Promocode is required. Enter code and click Apply.'
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
  const [promocode, setPromocode] = useState('')
  const [appliedPromocode, setAppliedPromocode] = useState('')
  const [queueColumns, setQueueColumns] = useState(4)
  const [queueBidValues, setQueueBidValues] = useState<Record<string, string>>({})
  const [queueBidCustomOpen, setQueueBidCustomOpen] = useState<Record<string, boolean>>({})
  const [queueBidBusy, setQueueBidBusy] = useState<Record<string, boolean>>({})
  const [defaultBidPrice, setDefaultBidPrice] = useState('1')
  const [queueItems, setQueueItems] = useState<BacktestQueueItem[]>([])
  const [queueSortBy, setQueueSortBy] = useState<'priority' | 'created_at'>('priority')
  const [queueView, setQueueView] = useState<'queue' | 'history'>('queue')
  const [queueLoading, setQueueLoading] = useState(false)
  const [queueError, setQueueError] = useState('')
  const [historyItems, setHistoryItems] = useState<BacktestHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [showX402NetworkSwitch, setShowX402NetworkSwitch] = useState(false)
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)
  const payMethodWrapRef = useRef<HTMLDivElement>(null)
  const queueScrollerRef = useRef<HTMLDivElement>(null)
  const { isConnected: isEvmConnected } = useAccount()
  const solanaWallet = useSolanaWallet()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { data: walletClient } = useWalletClient()
  const solanaWalletNetwork = useMemo(() => {
    if (!solanaWallet.cluster) return null
    if (solanaWallet.cluster === 'mainnet-beta') return 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
    if (solanaWallet.cluster === 'testnet') return 'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z'
    return 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'
  }, [solanaWallet.cluster])
  const evmWalletNetwork = useMemo(() => (chainId ? `eip155:${chainId}` : null), [chainId])
  const walletNetwork = useMemo(() => {
    if (payMethod !== 'x402') return evmWalletNetwork
    if (solanaWallet.isConnected && solanaWalletWalletSignerReady(solanaWallet.signTransaction)) {
      return solanaWalletNetwork
    }
    return evmWalletNetwork
  }, [evmWalletNetwork, payMethod, solanaWallet.isConnected, solanaWallet.signTransaction, solanaWalletNetwork])

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
    setAppliedPromocode('')
    setShowX402NetworkSwitch(false)
    if (payMethod === 'x402' && !isEvmConnected && !solanaWallet.isConnected) {
      setPayError('Connect an EVM or Solana wallet to pay with x402.')
      return
    }
    if (payMethod === 'x402' && !paidFetch) {
      setPayError('Unable to initialize x402 payment client.')
      return
    }
    if (payMethod === 'promocode' && !appliedPromocode) {
      setPayError('Apply promocode first.')
      return
    }
    setPayBusy(true)
    try {
      const endpoint = `${backtestApiOrigin}/backtest`
      const body = JSON.stringify({
        owner_address: solanaWallet.address || walletClient?.account?.address || '0x0000000000000000000000000000000000000001',
        params: {
          payment_method: payMethod,
          wallet_network: walletNetwork,
          base_asset: baseAsset,
          quote_asset: quoteValue,
          base_amount: baseAmount.trim() || '0',
          quote_amount: quoteAmount.trim() || '0',
          date_from: `${dateFrom}T00:00:00`,
          date_to: `${dateTo}T23:59:59.999`,
          priority_usdc: '1',
        },
      })
      const requestWithPayment = payMethod === 'x402' ? paidFetch : fetch
      if (!requestWithPayment) {
        throw new Error('Unable to initialize payment transport.')
      }
      const response = await requestWithPayment(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Method': payMethod,
          ...(payMethod === 'promocode' && appliedPromocode
            ? { 'X-Promocode': appliedPromocode }
            : {}),
          ...(walletNetwork ? { 'X-Wallet-Network': walletNetwork } : {}),
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

  const handlePromoApply = () => {
    const code = promocode.trim()
    if (!code) return
    setAppliedPromocode(code)
    setPayError('')
  }

  const handleQueueBidChange = (id: string, raw: string) => {
    setQueueBidValues((prev) => ({ ...prev, [id]: sanitizeDecimal(raw) }))
  }

  const handleQueueBidSubmit = async (id: string, explicitAmount?: string) => {
    const value = (explicitAmount ?? queueBidValues[id] ?? '').trim()
    if (!value) return
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
      await loadQueue()
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
    switchChain({ chainId: 8453 })
  }

  const handleSwitchSolana = () => {
    setPayError('')
    setPaySuccess('')
    setShowX402NetworkSwitch(false)
    setPayMethod('kirapay')
  }

  const quoteValue = quoteOptions.includes(quoteAsset) ? quoteAsset : quoteOptions[0]
  const hasEvmSigner = isEvmConnected && !!walletClient?.account?.address
  const hasSvmSigner =
    !!solanaWallet.address &&
    solanaWallet.isConnected &&
    solanaWalletWalletSignerReady(solanaWallet.signTransaction)
  const x402NeedsWalletConnection =
    payMethod === 'x402' && !hasEvmSigner && !hasSvmSigner
  const payButtonLabel =
    x402NeedsWalletConnection
      ? 'Connect wallet'
      : payMethod === 'promocode'
      ? 'Queue backtest'
      : `Pay 1 ${quoteValue}`
  const payButtonAriaLabel = payBusy
    ? 'Processing payment'
    : x402NeedsWalletConnection
      ? 'Connect wallet to pay with x402'
      : payMethod === 'promocode'
      ? 'Run backtest with promocode'
      : `Pay 1 ${quoteValue} and run backtest`

  const backtestApiOrigin = useMemo(
    () => (import.meta.env.VITE_BACKTEST_API_URL ?? 'http://localhost:8001').replace(/\/$/, ''),
    []
  )
  const paidFetch = useMemo(() => {
    if (!hasEvmSigner && !hasSvmSigner) return null

    // For x402, if Solana wallet is connected, force Solana scheme selection.
    const preferSolanaForX402 = payMethod === 'x402' && hasSvmSigner
    const client = new (x402Client as any)((_: number, accepts: Array<{ network?: string }>) => {
      const byNetwork = (prefix: string) =>
        accepts.filter((item) => typeof item.network === 'string' && item.network.startsWith(prefix))

      if (preferSolanaForX402) {
        if (walletNetwork?.startsWith('solana:')) {
          const exactSolana = accepts.find((item) => item.network === walletNetwork)
          if (exactSolana) return exactSolana
        }
        const solanaAccepts = byNetwork('solana:')
        if (solanaAccepts.length > 0) return solanaAccepts[0]
      }

      if (walletNetwork?.startsWith('eip155:')) {
        const exactEvm = accepts.find((item) => item.network === walletNetwork)
        if (exactEvm) return exactEvm
        const evmAccepts = byNetwork('eip155:')
        if (evmAccepts.length > 0) return evmAccepts[0]
      }

      return accepts[0]
    })
    if (!preferSolanaForX402 && hasEvmSigner && walletClient) {
      registerExactEvmScheme(client, {
        signer: {
          address: walletClient.account.address,
          signTypedData: (typedData: Parameters<typeof walletClient.signTypedData>[0]) =>
            walletClient.signTypedData({
              ...typedData,
              account: walletClient.account,
            }),
        } as any,
      })
    }
    if (hasSvmSigner && solanaWallet.address) {
      const solanaSignTransaction = solanaWallet.signTransaction
      const svmSigner = {
        address: solanaWallet.address,
        signTransactions: async (transactions: any[]) => {
          const signatures = await Promise.all(
            transactions.map(async (tx) => {
              const base64Wire = getBase64EncodedWireTransaction(tx)
              const web3Tx = VersionedTransaction.deserialize(Buffer.from(base64Wire, 'base64'))
              const signedWeb3Tx = await solanaSignTransaction!(web3Tx as any)
              const decodedSignedTx = getTransactionDecoder().decode(signedWeb3Tx.serialize())
              return decodedSignedTx.signatures ?? {}
            })
          )
          return signatures
        },
      }
      // Prefer app-configured RPC endpoint to avoid wallet-internal endpoints
      // that may not expose CORS for browser fetch.
      const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || solanaWallet.rpcEndpoint
      if (solanaWalletNetwork) {
        ;(client as any).register(
          solanaWalletNetwork,
          new ExactSvmScheme(svmSigner as any, rpcUrl ? { rpcUrl } : undefined)
        )
      } else {
        ;(client as any).register(
          'solana:*',
          new ExactSvmScheme(svmSigner as any, rpcUrl ? { rpcUrl } : undefined)
        )
      }
    }
    return wrapFetchWithPayment(fetch, client)
  }, [payMethod, solanaWallet.address, solanaWallet.isConnected, solanaWallet.rpcEndpoint, solanaWallet.signTransaction, solanaWalletNetwork, walletClient])

  const loadQueue = useCallback(
    async (signal?: AbortSignal) => {
      setQueueLoading(true)
      setQueueError('')
      try {
        const params = new URLSearchParams({
          limit: '1000',
          sort_by: queueSortBy,
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
    [backtestApiOrigin, queueSortBy]
  )

  const loadHistory = useCallback(
    async (signal?: AbortSignal) => {
      setHistoryLoading(true)
      setHistoryError('')
      try {
        const response = await fetch(`${backtestApiOrigin}/history?limit=200`, { signal })
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
          return {
            id: String(h.id),
            pair: `${h.base_asset} / ${h.quote_asset}`,
            period: `${toDateOnly(h.period_start)} - ${toDateOnly(h.period_end)}`,
            pnlBase: toAmountString(h.pnl_base),
            pnlQuote: toAmountString(h.pnl_quote),
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

  useEffect(() => {
    const ac = new AbortController()
    void loadQueue(ac.signal)
    return () => ac.abort()
  }, [loadQueue])

  useEffect(() => {
    if (queueView !== 'history') return
    const ac = new AbortController()
    void loadHistory(ac.signal)
    return () => ac.abort()
  }, [loadHistory, queueView])

  useEffect(() => {
    const ac = new AbortController()
    const loadHealth = async () => {
      try {
        const response = await fetch(`${backtestApiOrigin}/health`, { signal: ac.signal })
        if (!response.ok) return
        const payload = (await response.json()) as ApiHealth
        setDefaultBidPrice(normalizeUsdcAmount(payload.backtest_price, '1'))
      } catch {
        // Keep default "1" if health endpoint unavailable.
      }
    }
    void loadHealth()
    return () => ac.abort()
  }, [backtestApiOrigin])

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
      const cardMin = 190
      const gap = 10
      const cols = Math.max(1, Math.floor((el.clientWidth + gap) / (cardMin + gap)))
      setQueueColumns(cols)
    }

    updateColumns()
    window.addEventListener('resize', updateColumns)
    return () => window.removeEventListener('resize', updateColumns)
  }, [])

  const visibleQueue = queueItems
  const queuePriorityRaw = useMemo(
    () => visibleQueue.reduce((acc, item) => acc + Number(item.usdcPaid || 0), 0),
    [visibleQueue]
  )
  const stackPriorityRaw = useMemo(
    () => historyItems.reduce((acc, item) => acc + Number(item.pnlQuote || 0), 0),
    [historyItems]
  )
  const totalPriorityRaw = useMemo(() => queuePriorityRaw + stackPriorityRaw, [queuePriorityRaw, stackPriorityRaw])
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
  const queueRows = useMemo(() => chunkArray(visibleQueue, queueColumns), [visibleQueue, queueColumns])
  const featuredBacktest = visibleQueue[0] ?? DEMO_BACKTEST_QUEUE[0]
  const featuredRangeDays = useMemo(
    () => daysInclusive(featuredBacktest.dateFrom, featuredBacktest.dateTo),
    [featuredBacktest.dateFrom, featuredBacktest.dateTo]
  )

  return (
    <div className="backtest-page">
      <div className="backtest-layout">
        <div className="backtest-panel-wrap">
          <aside className="backtest-panel">
          <p className="backtest-panel-heading">Create backtest</p>

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
          </div>

          <div className="backtest-pay-block">
            <div className="backtest-pay-actions-wrap" ref={payMethodWrapRef}>
              <div className="backtest-pay-actions-row">
                <div className="backtest-pay-actions">
                  <button
                    type="button"
                    className="backtest-pay-btn"
                    onClick={() => {
                      if (x402NeedsWalletConnection) {
                        setPayError('')
                        setIsWalletModalOpen(true)
                        return
                      }
                      void handlePay()
                    }}
                    disabled={payBusy}
                    aria-label={payButtonAriaLabel}
                  >
                    {payBusy ? (
                      'Processing…'
                    ) : x402NeedsWalletConnection ? (
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
                  <div className="backtest-pay-method-wrap">
                    <span className="backtest-pay-method-caption">Payment method</span>
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
                    {payMethod === 'promocode' && (
                      <div className="backtest-promocode-inline-wrap backtest-promocode-inline-wrap--in-actions">
                        <div className="backtest-promocode-inline">
                          <input
                            id="backtest-promocode-inline"
                            type="text"
                            className="backtest-promo-input"
                            value={promocode}
                            onChange={(e) => {
                              setPromocode(e.target.value)
                              setAppliedPromocode('')
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && promocode.trim()) {
                                e.preventDefault()
                                handlePromoApply()
                              }
                            }}
                            placeholder="Enter promocode"
                            autoComplete="off"
                            spellCheck={false}
                            aria-label="Promocode"
                          />
                          <button
                            type="button"
                            className="backtest-promo-apply"
                            onClick={handlePromoApply}
                            disabled={!promocode.trim()}
                          >
                            Apply
                          </button>
                        </div>
                        {appliedPromocode && (
                          <p className="backtest-promocode-inline-status" aria-live="polite">
                            Promocode applied. Now click Pay 1 {quoteValue}.
                          </p>
                        )}
                      </div>
                    )}
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
              </div>
            </div>
            {(payError || paySuccess) && (
              <p className={`backtest-pay-status ${payError ? 'is-error' : 'is-success'}`} aria-live="polite">
                {payError || paySuccess}
              </p>
            )}
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
          <section className="backtest-payments-summary" aria-label="Payments summary">
            <div className="backtest-payments-summary-head">
              <span className="backtest-payments-summary-title">Total priority</span>
              <span className="backtest-payments-summary-value">{totalPaymentsUsdc} USDC</span>
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
              <div className="backtest-payments-priority-lines">
                <span className="backtest-payments-priority-line">
                  <span className="backtest-payments-priority-label">
                    <span className="backtest-payments-dot is-queue" aria-hidden="true" />
                    queue priority
                  </span>
                  <span className="backtest-payments-priority-amount">
                    {queuePriorityUsdc} USDC ({queuePriorityPct.toFixed(1)}%)
                  </span>
                </span>
                <span className="backtest-payments-priority-line">
                  <span className="backtest-payments-priority-label">
                    <span className="backtest-payments-dot is-stack" aria-hidden="true" />
                    stack priority
                  </span>
                  <span className="backtest-payments-priority-amount">
                    {stackPriorityUsdc} USDC ({stackPriorityPct.toFixed(1)}%)
                  </span>
                </span>
              </div>
            </div>
          </section>
          <section className="backtest-main" aria-label="Backtest results">
          <div
            className="backtest-queue-wrap"
            role="region"
            aria-labelledby="backtest-queue-label"
          >
            <div className="backtest-queue-view-switch" role="tablist" aria-label="Queue data view">
              <button
                type="button"
                role="tab"
                aria-selected={queueView === 'queue'}
                className={`backtest-queue-view-btn is-queue ${queueView === 'queue' ? 'is-active' : ''}`}
                onClick={() => setQueueView('queue')}
              >
                queue
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={queueView === 'history'}
                className={`backtest-queue-view-btn is-stack ${queueView === 'history' ? 'is-active' : ''}`}
                onClick={() => setQueueView('history')}
              >
                stack
              </button>
            </div>
            <div className="backtest-queue-head">
              <p
                id="backtest-queue-label"
                className={`backtest-queue-label ${queueView === 'queue' ? '' : 'is-stack'}`.trim()}
              >
                {queueView === 'queue' ? 'Backtests Queue' : 'Backtests Stack'}
              </p>
              <div
                className={`backtest-queue-sort ${queueView === 'queue' ? '' : 'is-hidden'}`}
                aria-label="Queue sorting"
                aria-hidden={queueView !== 'queue'}
              >
                <span className="backtest-queue-sort-label">Sort by:</span>
                <div className="backtest-queue-sort-switch" role="group" aria-label="Sort queue by">
                  <button
                    type="button"
                    className={`backtest-queue-sort-btn ${queueSortBy === 'priority' ? 'is-active' : ''}`}
                    onClick={() => setQueueSortBy('priority')}
                    aria-pressed={queueSortBy === 'priority'}
                    tabIndex={queueView === 'queue' ? 0 : -1}
                  >
                    Priority
                  </button>
                  <button
                    type="button"
                    className={`backtest-queue-sort-btn ${queueSortBy === 'created_at' ? 'is-active' : ''}`}
                    onClick={() => setQueueSortBy('created_at')}
                    aria-pressed={queueSortBy === 'created_at'}
                    tabIndex={queueView === 'queue' ? 0 : -1}
                  >
                    Date
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
                    queueSortBy === 'created_at' ? 'is-no-connectors' : ''
                  }`}
                  role="list"
                >
                  {queueRows.map((row, rowIdx) => {
                    const isReverse = rowIdx % 2 === 1
                    const visualRow = row
                    const showConnectors = queueSortBy !== 'created_at'
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
                          return (
                            <div
                              key={item.id}
                              className={`backtest-queue-item ${
                              showConnectors && visualIdx > 0 ? 'has-connector' : ''
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
                                  originalIdx === 0 ? 'backtest-queue-card--leader' : ''
                                }`}
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
                                  <>
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
                                            placeholder={`#${originalIdx + 1} bid`}
                                            value={queueBidValues[item.id] ?? ''}
                                            onChange={(e) => handleQueueBidChange(item.id, e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                e.preventDefault()
                                                void handleQueueBidSubmit(item.id)
                                              }
                                            }}
                                            aria-label={`Bid amount for queue item #${originalIdx + 1}`}
                                          />
                                          <span className="backtest-queue-bid-suffix">USDC</span>
                                        </div>
                                        <button
                                          type="button"
                                          className="backtest-queue-bid-btn"
                                          onClick={() => void handleQueueBidSubmit(item.id)}
                                          disabled={
                                            !(queueBidValues[item.id] ?? '').trim() ||
                                            !!queueBidBusy[item.id]
                                          }
                                        >
                                          {queueBidBusy[item.id] ? 'BIDDING…' : 'BID'}
                                        </button>
                                      </div>
                                    </div>
                                  </>
                                )}
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
            ) : (
              <div className="backtest-history-list" aria-label="Backtest history PnL list">
                {historyItems.map((item) => (
                  <article key={item.id} className="backtest-history-card">
                    <div className="backtest-history-main">
                      <div className="backtest-history-pair">{item.pair}</div>
                      <div className="backtest-history-period">{item.period}</div>
                      <div className="backtest-history-creator" title={item.creatorAddress}>
                        {shortenCreatorAddress(item.creatorAddress)}
                      </div>
                    </div>
                    <div className="backtest-history-pnl">
                      <div className="backtest-history-pnl-row">
                        <span className="backtest-history-pnl-label">PnL base</span>
                        <span className="backtest-history-pnl-value">{item.pnlBase}</span>
                      </div>
                      <div className="backtest-history-pnl-row">
                        <span className="backtest-history-pnl-label">PnL quote</span>
                        <span className="backtest-history-pnl-value">{item.pnlQuote}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {queueView === 'queue' && queueLoading && <div className="backtest-queue-end-hint">Loading queue…</div>}
            {queueView === 'queue' && !queueLoading && queueError && <div className="backtest-queue-end-hint">{queueError}</div>}
            {queueView === 'queue' && !queueLoading && !queueError && visibleQueue.length === 0 && (
              <div className="backtest-queue-end-hint">Queue is empty.</div>
            )}
            {queueView === 'history' && historyLoading && <div className="backtest-queue-end-hint">Loading history…</div>}
            {queueView === 'history' && !historyLoading && historyError && (
              <div className="backtest-queue-end-hint">{historyError}</div>
            )}
            {queueView === 'history' && !historyLoading && !historyError && historyItems.length === 0 && (
              <div className="backtest-queue-end-hint">History is empty.</div>
            )}
          </div>
          </section>
        </div>
        <section className="backtest-results-card" aria-label="Backtest output">
          <h1 className="backtest-main-title">Backtest</h1>
          <p className="backtest-main-subtitle">
            Pair <strong>{featuredBacktest.base}</strong> / <strong>{featuredBacktest.quote}</strong>,{' '}
            <strong>
              {featuredBacktest.dateFrom} – {featuredBacktest.dateTo}
            </strong>{' '}
            ({featuredRangeDays} days).
          </p>
          <div className="backtest-placeholder" aria-label="Backtest chart preview">
            <svg
              className="backtest-placeholder-chart"
              viewBox="0 0 100 42"
              role="img"
              aria-label="Candlestick chart preview"
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
              <g className="backtest-placeholder-candles">
                <line x1="8" y1="31" x2="8" y2="20" className="backtest-candle-wick is-up" />
                <rect x="6.8" y="24" width="2.4" height="7" className="backtest-candle-body is-up" />

                <line x1="15" y1="30" x2="15" y2="18" className="backtest-candle-wick is-up" />
                <rect x="13.8" y="22" width="2.4" height="8" className="backtest-candle-body is-up" />

                <line x1="22" y1="27" x2="22" y2="16" className="backtest-candle-wick is-up" />
                <rect x="20.8" y="19" width="2.4" height="8" className="backtest-candle-body is-up" />

                <line x1="29" y1="26" x2="29" y2="15" className="backtest-candle-wick is-down" />
                <rect x="27.8" y="19" width="2.4" height="5" className="backtest-candle-body is-down" />

                <line x1="36" y1="24" x2="36" y2="12" className="backtest-candle-wick is-up" />
                <rect x="34.8" y="16" width="2.4" height="7" className="backtest-candle-body is-up" />

                <line x1="43" y1="23" x2="43" y2="11" className="backtest-candle-wick is-up" />
                <rect x="41.8" y="14" width="2.4" height="8" className="backtest-candle-body is-up" />

                <line x1="50" y1="21" x2="50" y2="9" className="backtest-candle-wick is-up" />
                <rect x="48.8" y="12.5" width="2.4" height="8.5" className="backtest-candle-body is-up" />

                <line x1="57" y1="20" x2="57" y2="8.5" className="backtest-candle-wick is-down" />
                <rect x="55.8" y="12" width="2.4" height="6" className="backtest-candle-body is-down" />

                <line x1="64" y1="18" x2="64" y2="7.5" className="backtest-candle-wick is-up" />
                <rect x="62.8" y="10.5" width="2.4" height="6.5" className="backtest-candle-body is-up" />

                <line x1="71" y1="16.5" x2="71" y2="6.2" className="backtest-candle-wick is-up" />
                <rect x="69.8" y="9.5" width="2.4" height="6.2" className="backtest-candle-body is-up" />

                <line x1="78" y1="15.2" x2="78" y2="5.8" className="backtest-candle-wick is-up" />
                <rect x="76.8" y="8.3" width="2.4" height="5.8" className="backtest-candle-body is-up" />

                <line x1="85" y1="14.4" x2="85" y2="5.2" className="backtest-candle-wick is-down" />
                <rect x="83.8" y="8.2" width="2.4" height="4.7" className="backtest-candle-body is-down" />

                <line x1="92" y1="13.2" x2="92" y2="4.8" className="backtest-candle-wick is-up" />
                <rect x="90.8" y="7.2" width="2.4" height="5.2" className="backtest-candle-body is-up" />
              </g>
            </svg>
          </div>
        </section>
      </div>
      <ChainSelectorModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
      />
    </div>
  )
}

export default BacktestPage

function solanaWalletWalletSignerReady(
  signTransaction: unknown
): signTransaction is (tx: unknown) => Promise<{ serialize: () => Uint8Array }> {
  return typeof signTransaction === 'function'
}
