import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { GraiAmountInput } from '../grai/GraiAmountInput'
import { GraiFieldInfoButton } from '../grai/GraiFieldInfo'
import { GraiUiCaret } from '../grai/GraiUiCaret'
import { useEvmWallet } from '../../hooks/useEvmWallet'
import { useSolanaWallet } from '../../hooks/useSolanaWallet'
import { useActiveWallet } from '../../hooks/useActiveWallet'
import { useGrsEvmTransaction } from '../../hooks/useGrsEvmTransaction'
import { useGrsSolanaTransaction } from '../../hooks/useGrsSolanaTransaction'
import { useWalletContext } from '../../providers/AppWalletProvider'
import { formatTokenBalance, normalizeDecimalInput, parseTokenAmount } from '../../grai/onchain'
import { assetUrl } from '../../utils/appPaths'
import { GRS_DECIMALS } from '../../grs/constants'
import {
  MOCK_GRS_SALES,
  mockQuoteSaleCost,
} from '../../grs/preview'
import { executeGrsBuy } from '../../grs/evm/executeTransactions'
import { previewGrsBuy } from '../../grs/evm/readProtocol'
import { executeSolanaGrsBuy } from '../../grs/solana/executeTransactions'
import { previewSolanaGrsBuy } from '../../grs/solana/readProtocol'
import {
  fetchAllOpenGrsSaleBooks,
  resolveGrsSolanaConfigPreferringDevnet,
  type GrsSaleBookRow,
} from '../../grs/fetchSalesBooks'
import { grsExplorerTxUrl, isGrsConfiguredAnywhere, createGrsSolanaConnection, type GrsConfig } from '../../grs/deployments'
import type { GrsSale, GrsSnapshot } from '../../grs/evm/readProtocol'
import { ActionDepositNote, usePersistedActionTx } from '../ActionTxFeedback'
import { GrsChainGlyph } from './GrsChainGlyph'
import { GrsSubmit, isGrsRecipient, toastGrsSuccess } from './GrsActionBits'

type Props = {
  config: GrsConfig | null
  snapshot: GrsSnapshot | null
  isLoading: boolean
  refresh: () => void
  note: ReactNode
}

function saleUnitPriceLabel(sale: GrsSale, grsDecimals: number): string {
  if (sale.grsAmount <= 0n || sale.assetAmount <= 0n) return `— ${sale.quoteSymbol} / GRS`
  const perGrs = (sale.assetAmount * 10n ** BigInt(grsDecimals)) / sale.grsAmount
  return `${formatTokenBalance(perGrs, sale.quoteDecimals, 8)} ${sale.quoteSymbol} / GRS`
}

/** TGE reference / fallbacks when CoinGecko is unavailable (matches DeployGRS ~$0.02 lots). */
const FALLBACK_QUOTE_USD: Record<string, number> = {
  USDC: 1,
  USDT: 1,
  ETH: 2500,
  WETH: 2500,
  SOL: 110,
}

function quoteUsdRate(symbol: string, rates: Record<string, number>): number | null {
  const sym = symbol.trim().toUpperCase()
  if (rates[sym] != null) return rates[sym]!
  if (sym.includes('USDC') || sym.includes('USDT')) return rates.USDC ?? 1
  if (sym === 'ETH' || sym === 'WETH') return rates.ETH ?? FALLBACK_QUOTE_USD.ETH!
  if (sym === 'SOL') return rates.SOL ?? FALLBACK_QUOTE_USD.SOL!
  return null
}

function formatUsdPerGrs(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return '—'
  if (usd >= 1) return `$${usd.toFixed(2)}`
  if (usd >= 0.01) return `$${usd.toFixed(2)}`
  if (usd >= 0.0001) return `$${usd.toFixed(4)}`
  return `$${usd.toExponential(1)}`
}

function formatUsdTotal(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return '$0.00'
  if (usd >= 1000) {
    return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  if (usd >= 1) return `$${usd.toFixed(2)}`
  if (usd >= 0.01) return `$${usd.toFixed(2)}`
  return `$${usd.toFixed(4)}`
}

function saleUnitUsdLabel(sale: GrsSale, grsDecimals: number, rates: Record<string, number>): string {
  if (sale.grsAmount <= 0n || sale.assetAmount <= 0n) return '—'
  const rate = quoteUsdRate(sale.quoteSymbol, rates)
  if (rate == null || rate <= 0) return '—'
  const perGrs = (sale.assetAmount * 10n ** BigInt(grsDecimals)) / sale.grsAmount
  const quoteHuman = Number(perGrs) / 10 ** sale.quoteDecimals
  return formatUsdPerGrs(quoteHuman * rate)
}

function saleCostUsdLabel(
  cost: bigint | null,
  quoteSymbol: string,
  quoteDecimals: number,
  rates: Record<string, number>,
): string {
  if (cost == null || cost <= 0n) return '$0.00'
  const rate = quoteUsdRate(quoteSymbol, rates)
  if (rate == null || rate <= 0) return '—'
  return formatUsdTotal((Number(cost) / 10 ** quoteDecimals) * rate)
}

function saleInputUsdLabel(
  amount: string,
  decimals: number,
  sale: Pick<GrsSale, 'grsAmount' | 'assetAmount' | 'quoteSymbol' | 'quoteDecimals'> | null,
  quotedCost: bigint | null,
  rates: Record<string, number>,
): string {
  if (!sale) return '$0.00'
  let cost = quotedCost
  if ((cost == null || cost <= 0n) && amount.trim() && amount !== '0' && amount !== '0.') {
    try {
      const raw = parseTokenAmount(amount, decimals)
      if (raw > 0n && sale.grsAmount > 0n) {
        cost = mockQuoteSaleCost(raw, sale.grsAmount, sale.assetAmount)
      }
    } catch {
      cost = null
    }
  }
  return saleCostUsdLabel(cost, sale.quoteSymbol, sale.quoteDecimals, rates)
}

const DEMO_EVM_CONFIG = {
  kind: 'evm' as const,
  chainId: 1,
  chainName: 'Ethereum',
  address: '0x0000000000000000000000000000000000000001' as `0x${string}`,
}

/** TGE four-window plan: EVM (USDC · ETH) on top, Solana (USDC · SOL) at the bottom. */
const QUOTE_ICONS = {
  USDC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
} as const

const TGE_SLOT_META = [
  { family: 'evm' as const, networkLabel: 'Ethereum', quoteLabel: 'USDC', quoteIcon: QUOTE_ICONS.USDC },
  { family: 'evm' as const, networkLabel: 'Ethereum', quoteLabel: 'ETH', quoteIcon: QUOTE_ICONS.ETH },
  { family: 'solana' as const, networkLabel: 'Solana', quoteLabel: 'USDC', quoteIcon: QUOTE_ICONS.USDC },
  { family: 'solana' as const, networkLabel: 'Solana', quoteLabel: 'SOL', quoteIcon: QUOTE_ICONS.SOL },
] as const

function mockBookRows(): GrsSaleBookRow[] {
  // Align with TGE slots: EVM USDC · EVM ETH · Solana USDC · Solana SOL.
  const slots: { sale: (typeof MOCK_GRS_SALES)[number]; networkLabel: string; kind: 'evm' | 'solana' }[] = [
    { sale: MOCK_GRS_SALES[0]!, networkLabel: 'Ethereum', kind: 'evm' },
    { sale: MOCK_GRS_SALES[2]!, networkLabel: 'Ethereum', kind: 'evm' },
    { sale: MOCK_GRS_SALES[1]!, networkLabel: 'Solana', kind: 'solana' },
    { sale: MOCK_GRS_SALES[3]!, networkLabel: 'Solana', kind: 'solana' },
  ]
  return slots.map(({ sale, networkLabel, kind }, index) => ({
    ...sale,
    key: `demo:${networkLabel}:${sale.id.toString()}:${index}`,
    networkLabel,
    decimals: kind === 'solana' ? 9 : GRS_DECIMALS,
    config:
      kind === 'solana'
        ? ({
            kind: 'solana',
            cluster: 'devnet',
            chainName: 'Solana',
            programId: '11111111111111111111111111111111',
            mint: '11111111111111111111111111111111',
            oftStore: '11111111111111111111111111111111',
          } as GrsConfig)
        : { ...DEMO_EVM_CONFIG, chainName: networkLabel },
  }))
}

type CatalogSlot =
  | { kind: 'sale'; sale: GrsSaleBookRow }
  | {
      kind: 'placeholder'
      key: string
      networkLabel: string
      quoteLabel: string
      quoteIcon: string
    }

function saleMatchesSlot(
  sale: GrsSaleBookRow,
  slot: (typeof TGE_SLOT_META)[number],
): boolean {
  const isSolana = sale.config.kind === 'solana'
  if ((slot.family === 'solana') !== isSolana) return false
  const sym = sale.quoteSymbol.toUpperCase()
  if (slot.quoteLabel === 'USDC') return sym.includes('USDC')
  if (slot.quoteLabel === 'ETH') return sale.native || sym === 'ETH'
  if (slot.quoteLabel === 'SOL') return sale.native || sym === 'SOL'
  return false
}

function chainSortKey(sale: GrsSaleBookRow): number {
  return sale.config.kind === 'solana' ? 1 : 0
}

type CatalogFamily = 'evm' | 'solana'

function buildCatalogSlots(
  rows: GrsSaleBookRow[],
  family: CatalogFamily | 'all' = 'all',
): CatalogSlot[] {
  const metas =
    family === 'all' ? TGE_SLOT_META : TGE_SLOT_META.filter((meta) => meta.family === family)
  const used = new Set<string>()
  const filled = metas.map((meta) => {
    const sale = rows.find((row) => !used.has(row.key) && saleMatchesSlot(row, meta))
    if (sale) {
      used.add(sale.key)
      return { kind: 'sale' as const, sale }
    }
    return {
      kind: 'placeholder' as const,
      key: `placeholder:${meta.family}:${meta.quoteLabel}`,
      networkLabel: meta.networkLabel,
      quoteLabel: meta.quoteLabel,
      quoteIcon: meta.quoteIcon,
    }
  })

  const overflow = rows
    .filter((row) => !used.has(row.key))
    .filter((row) => {
      if (family === 'all') return true
      return family === 'solana' ? row.config.kind === 'solana' : row.config.kind !== 'solana'
    })
    .sort((a, b) => {
      const byChain = chainSortKey(a) - chainSortKey(b)
      if (byChain !== 0) return byChain
      return Number(a.id - b.id)
    })
    .map((sale) => ({ kind: 'sale' as const, sale }))

  if (family === 'evm') {
    return [...filled, ...overflow]
  }
  if (family === 'solana') {
    return [...filled, ...overflow]
  }

  const evmOverflow = overflow.filter((slot) => slot.sale.config.kind !== 'solana')
  const solOverflow = overflow.filter((slot) => slot.sale.config.kind === 'solana')
  // EVM windows (+ extra EVM lots), then Solana windows (+ extra Solana lots).
  return [...filled.slice(0, 2), ...evmOverflow, ...filled.slice(2), ...solOverflow]
}

function PriceUnit({
  quoteIcon,
  quoteSymbol,
}: {
  quoteIcon: string
  quoteSymbol: string
}) {
  return (
    <span className="grs-book-price-unit">
      <img className="grs-book-price-unit-icon" src={quoteIcon} alt="" width={14} height={14} />
      <span className="grs-book-price-unit-sym">{quoteSymbol}</span>
      <span className="grs-book-price-unit-sep" aria-hidden="true">
        /
      </span>
      <img
        className="grs-book-price-unit-icon"
        src={assetUrl('grs.png')}
        alt=""
        width={14}
        height={14}
      />
      <span className="grs-book-price-unit-sym">GRS</span>
    </span>
  )
}

export function GrsSalesPanel({ config, snapshot: _snapshot, isLoading: _isLoading, refresh, note }: Props) {
  const evmWallet = useEvmWallet()
  const solanaWallet = useSolanaWallet()
  const activeWallet = useActiveWallet()
  const { setSelectedChainType, setSolanaCluster, solanaCluster } = useWalletContext()
  const evmTx = useGrsEvmTransaction()
  const solTx = useGrsSolanaTransaction()
  const { lastTx, lastError, begin, succeed, fail } = usePersistedActionTx()
  const [saleKey, setSaleKey] = useState('')
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [deliverOpen, setDeliverOpen] = useState(false)
  const [cost, setCost] = useState<bigint | null>(null)
  const [bookRows, setBookRows] = useState<GrsSaleBookRow[]>([])
  const [bookLoading, setBookLoading] = useState(false)
  const [bookError, setBookError] = useState<string | null>(null)
  const [bookTick, setBookTick] = useState(0)
  const [quoteUsd, setQuoteUsd] = useState<Record<string, number>>(FALLBACK_QUOTE_USD)
  /** When a wallet is connected, catalog is split into EVM / Solana tabs. */
  const [catalogTab, setCatalogTab] = useState<CatalogFamily>('evm')
  /** Last auto-driven connect pair — avoids fighting manual tab clicks. */
  const catalogAutoKeyRef = useRef('')

  const configured = isGrsConfiguredAnywhere()
  const isDemo = !configured
  // Always merge EVM home + Solana spoke for the four-window TGE catalog.
  const bookMode = 'all' as const
  const anyWalletConnected = solanaWallet.isConnected || evmWallet.isConnected
  const catalogFamily: CatalogFamily | 'all' = anyWalletConnected ? catalogTab : 'all'
  const refreshBook = useCallback(() => {
    setBookTick((value) => value + 1)
    refresh()
  }, [refresh])

  useEffect(() => {
    let cancelled = false
    void fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,solana&vs_currencies=usd',
    )
      .then(async (response) => {
        if (!response.ok) throw new Error(`price http ${response.status}`)
        return response.json() as Promise<{
          ethereum?: { usd?: number }
          solana?: { usd?: number }
        }>
      })
      .then((data) => {
        if (cancelled) return
        const eth = data.ethereum?.usd
        const sol = data.solana?.usd
        setQuoteUsd({
          ...FALLBACK_QUOTE_USD,
          ...(typeof eth === 'number' && eth > 0 ? { ETH: eth, WETH: eth } : {}),
          ...(typeof sol === 'number' && sol > 0 ? { SOL: sol } : {}),
        })
      })
      .catch(() => {
        /* keep TGE fallbacks */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Prefer Solana catalog whenever a Solana wallet is (already) connected.
  // Re-runs only when the connect pair changes so manual tab clicks still stick.
  useEffect(() => {
    const key = `${solanaWallet.isConnected ? 1 : 0}:${evmWallet.isConnected ? 1 : 0}`
    if (key === catalogAutoKeyRef.current) return
    catalogAutoKeyRef.current = key
    if (solanaWallet.isConnected) {
      setCatalogTab('solana')
      setSelectedChainType('solana')
      return
    }
    if (evmWallet.isConnected) {
      setCatalogTab('evm')
      setSelectedChainType('evm')
    }
  }, [evmWallet.isConnected, setSelectedChainType, solanaWallet.isConnected])

  useEffect(() => {
    if (isDemo) {
      setBookRows(mockBookRows())
      setBookError(null)
      setBookLoading(false)
      return
    }

    let cancelled = false
    setBookLoading(true)
    setBookError(null)
    void fetchAllOpenGrsSaleBooks({
      pageConfig: config,
      solanaCluster: 'devnet',
      mode: bookMode,
      solanaConnection:
        solanaWallet.cluster === 'devnet' ? solanaWallet.connection ?? null : null,
    })
      .then((pack) => {
        if (cancelled) return
        const rows = [...pack.rows].sort((a, b) => {
          const byChain = (a.config.kind === 'solana' ? 1 : 0) - (b.config.kind === 'solana' ? 1 : 0)
          if (byChain !== 0) return byChain
          return Number(a.id - b.id)
        })
        setBookRows(rows)
        setBookError(pack.solanaError)
        setSaleKey((current) => {
          if (!current) return current
          const stillThere = rows.some((row) => row.key === current)
          if (stillThere) return current
          return ''
        })
      })
      .catch((error) => {
        if (cancelled) return
        setBookRows([])
        setBookError(error instanceof Error ? error.message : 'Failed to load sales')
      })
      .finally(() => {
        if (!cancelled) setBookLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    bookMode,
    bookTick,
    config,
    isDemo,
    solanaWallet.cluster,
    solanaWallet.connection,
  ])

  const catalogSlots = useMemo(
    () => buildCatalogSlots(bookRows, catalogFamily),
    [bookRows, catalogFamily],
  )

  const visibleSales = useMemo(
    () =>
      catalogSlots
        .filter((slot): slot is { kind: 'sale'; sale: GrsSaleBookRow } => slot.kind === 'sale')
        .map((slot) => slot.sale),
    [catalogSlots],
  )

  // Prefer a sale visible in the current catalog filter / matching connected wallet.
  const selected =
    visibleSales.find((sale) => sale.key === saleKey) ??
    bookRows.find((sale) => sale.key === saleKey && catalogFamily === 'all') ??
    visibleSales[0] ??
    bookRows.find((sale) => {
      if (catalogFamily === 'solana') return sale.config.kind === 'solana'
      if (catalogFamily === 'evm') return sale.config.kind !== 'solana'
      if (solanaWallet.isConnected && !evmWallet.isConnected) return sale.config.kind === 'solana'
      if (evmWallet.isConnected && !solanaWallet.isConnected) return sale.config.kind === 'evm'
      return false
    }) ??
    bookRows[0] ??
    null

  const saleConfig = selected?.config ?? config
  const chainKind = saleConfig?.kind ?? null
  const saleWalletConnected =
    chainKind === 'solana' ? solanaWallet.isConnected : chainKind === 'evm' ? evmWallet.isConnected : false
  const connectLabel =
    chainKind === 'solana'
      ? evmWallet.isConnected && !solanaWallet.isConnected
        ? 'Connect Solana wallet'
        : 'Connect Wallet'
      : chainKind === 'evm'
        ? solanaWallet.isConnected && !evmWallet.isConnected
          ? 'Connect Ethereum wallet'
          : 'Connect Wallet'
        : 'Connect Wallet'
  const decimals = selected?.decimals ?? (chainKind === 'solana' ? 9 : GRS_DECIMALS)
  const isPending = chainKind === 'solana' ? solTx.isPending : evmTx.isPending
  const liveError = chainKind === 'solana' ? solTx.error : evmTx.error
  const error = liveError ?? lastError
  const feedbackHash = lastTx?.hash ?? (chainKind === 'solana' ? solTx.lastSignature : evmTx.lastHash)
  const feedbackHref =
    lastTx?.href ??
    (feedbackHash && saleConfig ? grsExplorerTxUrl(saleConfig, feedbackHash) : null)
  const explorerLinkLabel =
    lastTx?.linkLabel ??
    (saleConfig?.kind === 'solana'
      ? 'Solscan'
      : saleConfig?.kind === 'evm' && saleConfig.chainId === 11155111
        ? 'Etherscan'
        : saleConfig?.kind === 'evm' && saleConfig.chainId === 8453
          ? 'Basescan'
          : saleConfig?.kind === 'evm' && saleConfig.chainId === 42161
            ? 'Arbiscan'
            : 'Explorer')
  const clearLiveTx = () => {
    evmTx.reset()
    solTx.reset()
  }

  const selectCatalogTab = (tab: CatalogFamily) => {
    setCatalogTab(tab)
    setSelectedChainType(tab === 'solana' ? 'solana' : 'evm')
    if (tab === 'solana') setSolanaCluster('devnet')
    const next = bookRows.find((sale) =>
      tab === 'solana' ? sale.config.kind === 'solana' : sale.config.kind !== 'solana',
    )
    if (next) {
      setSaleKey(next.key)
      setAmount('')
      clearLiveTx()
    }
  }

  const headerAddress = useMemo(() => {
    if (chainKind === 'solana') {
      return solanaWallet.address || activeWallet.address || ''
    }
    const candidates = [evmWallet.address, activeWallet.address]
    for (const value of candidates) {
      if (value && isGrsRecipient(value, 'evm')) return value
    }
    return ''
  }, [activeWallet.address, chainKind, evmWallet.address, solanaWallet.address])

  const recipientValue = recipient.trim() ? recipient : headerAddress

  useEffect(() => {
    if (selected && saleKey !== selected.key) setSaleKey(selected.key)
  }, [saleKey, selected])

  useEffect(() => {
    setRecipient('')
  }, [selected?.key])

  useEffect(() => {
    if (!headerAddress) return
    setRecipient((current) => (current.trim() ? current : headerAddress))
  }, [headerAddress])

  useEffect(() => {
    if (!selected || !saleConfig) {
      setCost(null)
      return
    }
    let cancelled = false
    const handle = window.setTimeout(() => {
      try {
        if (!amount.trim() || amount === '0' || amount === '0.') {
          setCost(null)
          return
        }
        const raw = parseTokenAmount(amount, decimals)
        if (selected.grsAmount > 0n && raw > selected.grsAmount) {
          if (!cancelled) setCost(null)
          return
        }
        if (isDemo) {
          if (!cancelled) setCost(mockQuoteSaleCost(raw, selected.grsAmount, selected.assetAmount))
          return
        }
        if (saleConfig.kind === 'solana') {
          if (!cancelled) setCost(previewSolanaGrsBuy(selected, raw))
          return
        }
        void previewGrsBuy(saleConfig, selected.id, raw)
          .then((quoted) => {
            if (!cancelled) setCost(quoted)
          })
          .catch(() => {
            if (!cancelled) setCost(null)
          })
      } catch {
        if (!cancelled) setCost(null)
      }
    }, 220)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [amount, decimals, isDemo, saleConfig, selected])

  const tokenAddress =
    saleConfig?.kind === 'solana'
      ? saleConfig.mint.toBase58()
      : (saleConfig?.address ?? 'grs')
  const assets = useMemo(
    () => [{ icon: assetUrl('grs.png'), symbol: 'GRS', address: tokenAddress }],
    [tokenAddress],
  )
  const listed = selected?.grsAmount ?? 0n
  const maxAmount = listed > 0n ? formatTokenBalance(listed, decimals) : ''
  const buyableLabel = listed > 0n ? formatTokenBalance(listed, decimals, 2) : null
  const costLabel =
    selected && cost != null
      ? formatTokenBalance(cost, selected.quoteDecimals, 8)
      : null
  const amountUsdLabel = saleInputUsdLabel(amount, decimals, selected, cost, quoteUsd)

  const selectSale = (sale: GrsSaleBookRow) => {
    setSaleKey(sale.key)
    setAmount('')
    clearLiveTx()
    if (sale.config.kind === 'solana') {
      setSelectedChainType('solana')
      setSolanaCluster(sale.config.cluster)
      const preferred = resolveGrsSolanaConfigPreferringDevnet(sale.config.cluster)
      if (preferred && preferred.cluster !== solanaCluster) {
        setSolanaCluster(preferred.cluster)
      }
    } else {
      setSelectedChainType('evm')
    }
  }

  const handleBuy = async () => {
    if (!selected || !saleConfig || isDemo) return
    if (selected.unpayableEvmAsset) return
    const to = recipientValue.trim() || headerAddress
    if (!isGrsRecipient(to, saleConfig.kind)) return
    begin()
    clearLiveTx()
    try {
      if (saleConfig.kind === 'solana') {
        setSelectedChainType('solana')
        setSolanaCluster(saleConfig.cluster)
        const result = await solTx.run({
          connectMessage: 'Connect a Solana wallet to buy GRS',
          clusterAction: 'buy GRS',
          failureMessage: 'Purchase failed',
          amountInput: amount,
          execute: ({ sendTransaction, signTransaction, publicKey }) =>
            executeSolanaGrsBuy({
              connection: createGrsSolanaConnection(saleConfig),
              config: saleConfig,
              publicKey,
              signTransaction,
              sendTransaction,
              saleId: selected.id,
              amountInput: amount,
              recipient: to,
              decimals,
            }),
        })
        const href = grsExplorerTxUrl(saleConfig, result.signature)
        succeed({
          hash: result.signature,
          href,
          linkLabel: 'Solscan',
          successLabel: 'Purchase confirmed.',
        })
        toastGrsSuccess(`Bought ${result.amountLabel} GRS`, saleConfig, result.signature, {
          href,
          linkLabel: 'Solscan',
        })
      } else {
        setSelectedChainType('evm')
        const result = await evmTx.run({
          config: saleConfig,
          connectMessage: 'Connect an EVM wallet to buy GRS',
          chainAction: 'buy GRS',
          failureMessage: 'Purchase failed',
          amountInput: amount,
          execute: () =>
            executeGrsBuy({
              config: saleConfig,
              saleId: selected.id,
              amountInput: amount,
              recipient: to,
              nativeQuote: selected.native,
              quoteAddress: selected.asset,
              decimals,
            }),
        })
        const href = grsExplorerTxUrl(saleConfig, result.hash)
        const linkLabel = saleConfig.chainId === 11155111 ? 'Etherscan' : 'Explorer'
        succeed({
          hash: result.hash,
          href,
          linkLabel,
          successLabel: 'Purchase confirmed.',
        })
        toastGrsSuccess(`Bought ${result.amountLabel} GRS`, saleConfig, result.hash, {
          href,
          linkLabel,
        })
      }
      setAmount('')
      refreshBook()
    } catch (buyError) {
      fail(buyError, 'Purchase failed')
    }
  }

  const catalog = (
    <div className="grs-sales-catalog-panel">
      <div
        className={`grs-sales-catalog-tabs-shell${anyWalletConnected ? ' is-visible' : ''}`}
        aria-hidden={!anyWalletConnected}
      >
        <div className="grs-sales-catalog-tabs-shell-inner">
          <div
            className={`grs-sales-catalog-tabs grai-action-switch${catalogTab === 'solana' ? ' is-solana-active' : ''}`}
            role="tablist"
            aria-label="Sale network"
          >
            <button
              type="button"
              role="tab"
              aria-selected={catalogTab === 'evm'}
              tabIndex={anyWalletConnected ? undefined : -1}
              className={`grai-action-switch-btn${catalogTab === 'evm' ? ' is-active' : ''}`}
              onClick={() => selectCatalogTab('evm')}
              disabled={!anyWalletConnected}
            >
              <span className="grai-action-switch-icon" aria-hidden="true">
                <GrsChainGlyph name="Ethereum" size={16} />
              </span>
              <span className="grai-action-switch-label">Ethereum</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={catalogTab === 'solana'}
              tabIndex={anyWalletConnected ? undefined : -1}
              className={`grai-action-switch-btn${catalogTab === 'solana' ? ' is-active' : ''}`}
              onClick={() => selectCatalogTab('solana')}
              disabled={!anyWalletConnected}
            >
              <span className="grai-action-switch-icon" aria-hidden="true">
                <GrsChainGlyph name="Solana" solana size={16} />
              </span>
              <span className="grai-action-switch-label">Solana</span>
            </button>
        </div>
        </div>
      </div>
      <div
        className={`grs-book${catalogFamily !== 'all' ? ' is-filtered' : ''}`}
        role="list"
        aria-label={
          catalogFamily === 'evm'
            ? 'Token sales on Ethereum'
            : catalogFamily === 'solana'
              ? 'Token sales on Solana'
              : 'Token sales on Ethereum and Solana'
        }
      >
        {bookError ? (
          <p className="grai-manage-feedback is-error" role="alert">
            {bookError}
          </p>
        ) : null}
        {bookLoading && bookRows.length === 0 ? (
          <p className="grs-empty">Loading sales…</p>
        ) : (
          catalogSlots.map((slot) => {
            if (slot.kind === 'placeholder') {
              return (
                <div
                  key={slot.key}
                  role="listitem"
                  className="grs-book-row is-placeholder"
                  aria-label={`${slot.networkLabel} ${slot.quoteLabel} sale — listed soon`}
                >
                  <span className="grs-book-row-top">
                    <span className="grs-book-price-block">
                      <span className="grs-book-price-head">
                        <span className="grs-book-price-label">Price</span>
                        <span className="grs-book-heading">
                          <span className="grs-book-sale-id">—</span>
                          <span className="grs-book-network">
                            <span className="grs-book-network-icon" aria-hidden="true">
                              <GrsChainGlyph name={slot.networkLabel} size={14} />
                            </span>
                            {slot.networkLabel}
                          </span>
                        </span>
                      </span>
                      <span className="grs-book-price-line">
                        <span className="grs-book-price-main">
                          <span className="grs-book-price-value">0.02</span>
                          <span className="grs-book-price-usd">$0.02</span>
                        </span>
                        <PriceUnit quoteIcon={slot.quoteIcon} quoteSymbol={slot.quoteLabel} />
                      </span>
                    </span>
                  </span>
                  <span className="grs-book-foot">
                    <span className="grs-book-foot-cell">
                      <span className="grs-book-meta-label">Status</span>
                      <span className="grs-book-meta-value">Listed soon</span>
                    </span>
                  </span>
                </div>
              )
            }

            const sale = slot.sale
            const active = selected?.key === sale.key
            const unitPrice = saleUnitPriceLabel(sale, sale.decimals)
            const [unitValue] = unitPrice.split(' ')
            const usdLabel = saleUnitUsdLabel(sale, sale.decimals, quoteUsd)
            return (
              <button
                key={sale.key}
                type="button"
                role="listitem"
                className={`grs-book-row${active ? ' is-active' : ''}${sale.unpayableEvmAsset ? ' is-blocked' : ''}`}
                onClick={() => selectSale(sale)}
              >
                <span className="grs-book-row-top">
                  <span className="grs-book-price-block">
                    <span className="grs-book-price-head">
                      <span className="grs-book-price-label">Price</span>
                      <span className="grs-book-heading">
                        <span className="grs-book-sale-id">#{sale.id.toString()}</span>
                        <span className="grs-book-network">
                          <span className="grs-book-network-icon" aria-hidden="true">
                            <GrsChainGlyph name={sale.networkLabel} size={14} />
                          </span>
                          {sale.networkLabel}
                        </span>
                      </span>
                    </span>
                    <span className="grs-book-price-line">
                      <span className="grs-book-price-main">
                        <span className="grs-book-price-value">{unitValue}</span>
                        <span className="grs-book-price-usd">{usdLabel}</span>
                      </span>
                      <PriceUnit quoteIcon={sale.quoteIcon} quoteSymbol={sale.quoteSymbol} />
                    </span>
                  </span>
                </span>

                <span className="grs-book-foot" aria-label="Sale size">
                  <span className="grs-book-foot-cell">
                    <span className="grs-book-meta-label">Available</span>
                    <span className="grs-book-meta-value">
                      {formatTokenBalance(sale.grsAmount, sale.decimals, 2)}
                      <span className="grs-book-ticker">
                        <img
                          className="grs-book-ticker-icon"
                          src={assetUrl('grs.png')}
                          alt=""
                          width={14}
                          height={14}
                        />
                        <span className="grs-book-ticker-sym">GRS</span>
                      </span>
                    </span>
                  </span>
                  <span className="grs-book-foot-cell">
                    <span className="grs-book-meta-label">Total ask</span>
                    <span className="grs-book-meta-value">
                      {formatTokenBalance(sale.assetAmount, sale.quoteDecimals, 4)}
                      <span className="grs-book-ticker">
                        <img
                          className="grs-book-ticker-icon"
                          src={sale.quoteIcon}
                          alt=""
                          width={14}
                          height={14}
                        />
                        <span className="grs-book-ticker-sym">{sale.quoteSymbol}</span>
                      </span>
                    </span>
                  </span>
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )

  if (configured && bookLoading && bookRows.length === 0) {
    return (
      <div className="grs-sales-split">
        <h3 className="grai-liquidation-distribute-title">Token sale</h3>
        <div className="grs-sales-form">
          <div className="grai-action-card grai-mint">
            <div className="grai-action-content">
              <p className="grs-empty">Loading sales…</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grs-sales-split">
      <h3 className="grai-liquidation-distribute-title">Token sale</h3>
      {catalog}
      <div className="grs-sales-form">
        <div className="grai-action-card grai-mint">
          <div className="grai-action-content">
            <GraiAmountInput
              label="Buy"
              assets={assets}
              value={amount}
              onValueChange={(value) => {
                setAmount(normalizeDecimalInput(value, decimals))
              }}
              balanceLabel={buyableLabel ? `${buyableLabel} GRS` : '—'}
              balancePrefix="This sale:"
              usdLabel={amountUsdLabel}
              usdTrailingLabel="available"
              maxAmount={maxAmount}
              decimals={decimals}
              disabled={!selected}
            />

            <div className="grai-action-metrics grai-action-metrics--under-amount" aria-live="polite">
              <div className="grai-action-metric-row">
                <span className="grai-action-metric-label-wrap">
                  <GraiFieldInfoButton
                    className="grai-action-metric-label-info"
                    ariaLabel="How You pay is calculated"
                    structured
                    hint={
                      <>
                        <span className="grai-field-info-tooltip-title">You pay</span>
                        <span className="grai-field-info-tooltip-section">
                          <span className="grai-field-info-tooltip-section-label">Full lot</span>
                          Buy all remaining GRS → pay the full ask.
                        </span>
                        <span className="grai-field-info-tooltip-section">
                          <span className="grai-field-info-tooltip-section-label">Partial</span>
                          Cost scales with size: GRS × ask ÷ remaining.
                        </span>
                      </>
                    }
                  />
                  <span className="grai-action-metric-label">You pay</span>
                </span>
                <span className="grai-action-metric-value grai-action-metric-value--token">
                  {costLabel ?? '—'}
                  {selected ? (
                    <>
                      <img
                        src={selected.quoteIcon}
                        alt=""
                        width={16}
                        height={16}
                        loading="lazy"
                        decoding="async"
                      />
                      {selected.quoteSymbol}
                    </>
                  ) : null}
                </span>
              </div>
              <div className="grai-action-metric-row">
                <span className="grai-action-metric-label-wrap">
                  <button
                    type="button"
                    className="grai-mint-referrer-chevron-btn"
                    aria-expanded={deliverOpen}
                    aria-controls="grs-sales-deliver-field"
                    aria-label={deliverOpen ? 'Hide deliver address' : 'Show deliver address'}
                    onClick={() => setDeliverOpen((open) => !open)}
                  >
                    <GraiUiCaret
                      className={`grai-mint-referrer-chevron${deliverOpen ? ' is-open' : ''}`}
                    />
                  </button>
                  <span className="grai-action-metric-label">You receive</span>
                </span>
                <span className="grai-action-metric-value grai-action-metric-value--token">
                  {amount.trim() || '—'}
                  <img
                    src={assetUrl('grs.png')}
                    alt=""
                    width={16}
                    height={16}
                    loading="lazy"
                    decoding="async"
                  />
                  GRS
                </span>
              </div>
            </div>

            {deliverOpen ? (
              <label className="grai-mint-referrer-field" id="grs-sales-deliver-field">
                <span className="grai-mint-referrer-label-row">
                  <span className="grai-mint-referrer-label">Deliver to</span>
                  <GraiFieldInfoButton hint="Buyer of this GRS. Instant transfer — no vesting lock." />
                </span>
                <div className="grai-mint-referrer-input-row">
                  <input
                    id="grs-sales-deliver-input"
                    className="grai-mint-referrer-input"
                    value={recipientValue}
                    spellCheck={false}
                    placeholder={chainKind === 'solana' ? 'Solana address' : '0x…'}
                    onChange={(event) => {
                      setRecipient(event.target.value)
                    }}
                  />
                  <button
                    type="button"
                    className="grai-mint-referrer-me-btn"
                    disabled={!headerAddress}
                    title="Use connected wallet from the header"
                    aria-label="Fill connected wallet address"
                    onClick={() => {
                      if (!headerAddress) return
                      setSelectedChainType(chainKind === 'solana' ? 'solana' : 'evm')
                      setRecipient(headerAddress)
                    }}
                  >
                    ME
                  </button>
                </div>
              </label>
            ) : null}

            {selected?.unpayableEvmAsset ? (
              <p className="grai-manage-feedback is-error">
                This spoke sale is priced in an EVM quote asset and cannot be bought on Solana.
                Re-list with destination Solana and quote USDC/SOL so the mint is encoded as an SPL
                asset.
              </p>
            ) : null}

            <GrsSubmit
              connected={saleWalletConnected}
              connectLabel={connectLabel}
              onBeforeConnect={() => {
                if (chainKind === 'solana') {
                  setSelectedChainType('solana')
                  setSolanaCluster(
                    saleConfig?.kind === 'solana' ? saleConfig.cluster : 'devnet',
                  )
                } else if (chainKind === 'evm') {
                  setSelectedChainType('evm')
                }
              }}
              disabled={
                isDemo ||
                !selected ||
                Boolean(selected.unpayableEvmAsset) ||
                !amount.trim() ||
                amount === '0' ||
                amount === '0.' ||
                !isGrsRecipient(recipientValue, chainKind)
              }
              pending={isPending}
              label="Buy"
              blockedLabel={
                !amount.trim() || amount === '0' || amount === '0.'
                  ? 'Enter GRS amount'
                  : null
              }
              onClick={() => {
                void handleBuy()
              }}
            />

            <ActionDepositNote
              isPending={isPending}
              pendingLabel="Buying GRS…"
              error={error}
              hash={feedbackHash}
              config={saleConfig}
              chainId={saleConfig?.kind === 'evm' ? saleConfig.chainId : undefined}
              txHref={feedbackHref}
              successLabel={lastTx?.successLabel ?? 'Purchase confirmed.'}
              linkLabel={explorerLinkLabel}
            >
              {note}
            </ActionDepositNote>
            {isDemo ? (
              <div className="grai-action-deposit-notes">
                <p className="grai-action-deposit-note">
                  Demo catalog — set <code>VITE_GRS_SEPOLIA_TOKEN</code> and/or Solana GRS mint env to
                  go live.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
