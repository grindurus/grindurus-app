import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
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

const DEMO_EVM_CONFIG = {
  kind: 'evm' as const,
  chainId: 1,
  chainName: 'Ethereum',
  address: '0x0000000000000000000000000000000000000001' as `0x${string}`,
}

/** TGE four-window plan: ETH USDC · SOL USDC · ETH · SOL. */
const QUOTE_ICONS = {
  USDC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
} as const

const TGE_SLOT_META = [
  { networkLabel: 'Ethereum', quoteLabel: 'USDC', quoteIcon: QUOTE_ICONS.USDC },
  { networkLabel: 'Solana', quoteLabel: 'USDC', quoteIcon: QUOTE_ICONS.USDC },
  { networkLabel: 'Ethereum', quoteLabel: 'ETH', quoteIcon: QUOTE_ICONS.ETH },
  { networkLabel: 'Solana', quoteLabel: 'SOL', quoteIcon: QUOTE_ICONS.SOL },
] as const

const CATALOG_WINDOW_COUNT = 4

function mockBookRows(): GrsSaleBookRow[] {
  const networks = ['Ethereum', 'Solana', 'Ethereum', 'Solana'] as const
  return MOCK_GRS_SALES.map((sale, index) => ({
    ...sale,
    key: `demo:${networks[index]}:${sale.id.toString()}`,
    networkLabel: networks[index] ?? 'Demo',
    decimals: GRS_DECIMALS,
    // Demo cannot buy — EVM stub config is enough for selection / pricing preview.
    config: { ...DEMO_EVM_CONFIG, chainName: networks[index] ?? 'Demo' },
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

function buildCatalogSlots(rows: GrsSaleBookRow[]): CatalogSlot[] {
  const sales: CatalogSlot[] = rows.map((sale) => ({ kind: 'sale', sale }))
  if (sales.length >= CATALOG_WINDOW_COUNT) return sales
  const placeholders = TGE_SLOT_META.slice(sales.length).map((meta, index) => ({
    kind: 'placeholder' as const,
    key: `placeholder:${meta.networkLabel}:${meta.quoteLabel}:${index}`,
    networkLabel: meta.networkLabel,
    quoteLabel: meta.quoteLabel,
    quoteIcon: meta.quoteIcon,
  }))
  return [...sales, ...placeholders]
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

  const configured = isGrsConfiguredAnywhere()
  const isDemo = !configured
  // Always merge EVM home + Solana spoke for the four-window TGE catalog.
  const bookMode = 'all' as const
  const refreshBook = useCallback(() => {
    setBookTick((value) => value + 1)
    refresh()
  }, [refresh])

  // GRS spoke sales live on Devnet — don't stay stuck on Phantom mainnet / Sepolia CA.
  useEffect(() => {
    if (!solanaWallet.isConnected) return
    setSelectedChainType('solana')
    if (solanaCluster !== 'devnet') setSolanaCluster('devnet')
  }, [setSelectedChainType, setSolanaCluster, solanaCluster, solanaWallet.isConnected])

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
        const rows = [...pack.rows].sort((a, b) => Number(a.id - b.id))
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

  const catalogSlots = useMemo(() => buildCatalogSlots(bookRows), [bookRows])

  const selected =
    bookRows.find((sale) => sale.key === saleKey) ?? bookRows[0] ?? null


  const saleConfig = selected?.config ?? config
  const chainKind = saleConfig?.kind ?? null
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
          execute: () =>
            executeSolanaGrsBuy({
              connection: createGrsSolanaConnection(saleConfig),
              config: saleConfig,
              publicKey: solanaWallet.publicKey!,
              signTransaction: async (transaction) => {
                if (!solanaWallet.signTransaction) {
                  throw new Error('Connected wallet cannot sign transactions')
                }
                return solanaWallet.signTransaction(transaction)
              },
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
      <div className="grs-book" role="list" aria-label="Token sales on Ethereum and Solana">
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
                      <span className="grs-book-price-value">0.02</span>
                      <PriceUnit quoteIcon={slot.quoteIcon} quoteSymbol={slot.quoteLabel} />
                    </span>
                    <span className="grs-book-network">
                      <span className="grs-book-network-icon" aria-hidden="true">
                        <GrsChainGlyph name={slot.networkLabel} size={14} />
                      </span>
                      {slot.networkLabel}
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
                    <span className="grs-book-price-value">{unitValue}</span>
                    <PriceUnit quoteIcon={sale.quoteIcon} quoteSymbol={sale.quoteSymbol} />
                  </span>
                  <span className="grs-book-network">
                    <span className="grs-book-network-icon" aria-hidden="true">
                      <GrsChainGlyph name={sale.networkLabel} size={14} />
                    </span>
                    {sale.networkLabel}
                  </span>
                </span>

                <span className="grs-book-foot" aria-label="Sale size">
                  <span className="grs-book-foot-cell">
                    <span className="grs-book-meta-label">Available</span>
                    <span className="grs-book-meta-value">
                      <img
                        className="grs-book-ticker-icon"
                        src={assetUrl('grs.png')}
                        alt=""
                        width={14}
                        height={14}
                      />
                      {formatTokenBalance(sale.grsAmount, sale.decimals, 2)}
                      <span className="grs-book-ticker-sym">GRS</span>
                    </span>
                  </span>
                  <span className="grs-book-foot-cell">
                    <span className="grs-book-meta-label">Total ask</span>
                    <span className="grs-book-meta-value">
                      <img
                        className="grs-book-ticker-icon"
                        src={sale.quoteIcon}
                        alt=""
                        width={14}
                        height={14}
                      />
                      {formatTokenBalance(sale.assetAmount, sale.quoteDecimals, 4)}
                      <span className="grs-book-ticker-sym">{sale.quoteSymbol}</span>
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
              usdTrailingLabel="remaining"
              maxAmount={maxAmount}
              decimals={decimals}
              disabled={!selected}
            />

            <div className="grai-action-metrics grai-action-metrics--under-amount" aria-live="polite">
              <div className="grai-action-metric-row">
                <span className="grai-action-metric-label-wrap">
                  <GraiFieldInfoButton
                    className="grai-action-metric-label-info"
                    hint="Buying the listed remainder pays remaining assetAmount exactly. A partial fill is floor(amount × assetAmount / remaining GRS)."
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
              connected={
                chainKind === 'solana' ? solanaWallet.isConnected : evmWallet.isConnected
              }
              disabled={
                isDemo ||
                !selected ||
                Boolean(selected.unpayableEvmAsset) ||
                !amount.trim() ||
                !isGrsRecipient(recipientValue, chainKind)
              }
              pending={isPending}
              label="Buy"
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
