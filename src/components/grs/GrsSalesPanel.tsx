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
  MOCK_TOKEN_SALES_REMAINING,
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

function mockBookRows(): GrsSaleBookRow[] {
  return MOCK_GRS_SALES.map((sale) => ({
    ...sale,
    key: `demo:${sale.id.toString()}`,
    networkLabel: 'Demo',
    decimals: GRS_DECIMALS,
    config: {
      kind: 'evm',
      chainId: 11155111,
      chainName: 'Demo',
      address: '0x0000000000000000000000000000000000000001',
    },
  }))
}

export function GrsSalesPanel({ config, snapshot, isLoading, refresh, note }: Props) {
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
  const [bookInventory, setBookInventory] = useState<{
    remaining: bigint | null
    spent: bigint | null
    cap: bigint | null
    decimals: number | null
  }>({ remaining: null, spent: null, cap: null, decimals: null })
  const [bookTick, setBookTick] = useState(0)

  const configured = isGrsConfiguredAnywhere()
  const isDemo = !configured
  // Solana wallet → spoke book. EVM wallet (or CA on EVM) → selected chain only.
  const bookMode: 'solana' | 'evm' = solanaWallet.isConnected
    ? 'solana'
    : evmWallet.isConnected || config?.kind === 'evm'
      ? 'evm'
      : config?.kind === 'solana'
        ? 'solana'
        : 'evm'
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
      setBookInventory({
        remaining: MOCK_TOKEN_SALES_REMAINING,
        spent: null,
        cap: null,
        decimals: GRS_DECIMALS,
      })
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
        setBookInventory({
          remaining: pack.tokenSalesRemaining,
          spent: pack.tokenSalesSpent,
          cap: pack.tokenSalesCap,
          decimals: pack.tokenSalesDecimals,
        })
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

  const remaining = isDemo ? MOCK_TOKEN_SALES_REMAINING : bookInventory.remaining
  const remainingDecimals = isDemo
    ? GRS_DECIMALS
    : (bookInventory.decimals ?? snapshot?.tokenSalesDecimals ?? snapshot?.decimals ?? GRS_DECIMALS)
  const remainingLabel =
    remaining == null ? null : formatTokenBalance(remaining, remainingDecimals, 2)
  const spent = isDemo ? null : bookInventory.spent
  const cap = isDemo ? null : bookInventory.cap
  const soldPct =
    spent != null && cap != null && cap > 0n
      ? Number((spent * 10_000n) / cap) / 100
      : null
  const tokenAddress =
    saleConfig?.kind === 'solana'
      ? saleConfig.mint.toBase58()
      : (saleConfig?.address ?? 'grs')
  const assets = useMemo(
    () => [{ icon: assetUrl('logo.png'), symbol: 'GRS', address: tokenAddress }],
    [tokenAddress],
  )
  const listed = selected?.grsAmount ?? 0n
  const maxAmount = listed > 0n ? formatTokenBalance(listed, decimals) : ''
  const buyableLabel = listed > 0n ? formatTokenBalance(listed, decimals, 2) : null
  const costLabel =
    selected && cost != null
      ? `${formatTokenBalance(cost, selected.quoteDecimals, 8)} ${selected.quoteSymbol}`
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
      {remaining != null ? (
        <div className="grai-action-metrics">
          <div className="grai-action-metric-row">
            <span className="grai-action-metric-label-wrap">
              <GraiFieldInfoButton
                className="grai-action-metric-label-info"
                hint="Home TokenSales inventory: GRS held on the home OFT (uncapped — buybacks can re-enter). Same book whether you buy on home or a spoke."
              />
              <span className="grai-action-metric-label">For sale</span>
            </span>
            <span className="grai-action-metric-value">
              {remainingLabel} GRS
              {soldPct != null ? ` · ${soldPct.toFixed(soldPct < 10 ? 2 : 1)}% sold` : ''}
            </span>
          </div>
        </div>
      ) : null}

      <div className="grs-book" role="list">
        {bookError ? (
          <p className="grai-manage-feedback is-error" role="alert">
            {bookError}
          </p>
        ) : null}
        {bookRows.length === 0 ? (
          <p className="grs-empty">
            {bookLoading || isLoading
              ? 'Loading sales…'
              : bookMode === 'solana'
                ? 'No open sales on Solana Devnet.'
                : `No open sales on ${config?.kind === 'evm' ? config.chainName : 'this chain'}.`}
          </p>
        ) : (
          bookRows.map((sale) => {
            const active = selected?.key === sale.key
            const unitPrice = saleUnitPriceLabel(sale, sale.decimals)
            const [unitValue, ...unitRest] = unitPrice.split(' ')
            const unitSuffix = unitRest.join(' ')
            return (
              <button
                key={sale.key}
                type="button"
                role="listitem"
                className={`grs-book-row${active ? ' is-active' : ''}${sale.unpayableEvmAsset ? ' is-blocked' : ''}`}
                onClick={() => selectSale(sale)}
              >
                <span className="grs-book-row-header">
                  <span className="grs-book-sale-id">#{sale.id.toString()}</span>
                  <span className="grs-book-network">
                    <span className="grs-book-network-icon" aria-hidden="true">
                      <GrsChainGlyph name={sale.networkLabel} size={14} />
                    </span>
                    {sale.networkLabel}
                  </span>
                </span>

                <span className="grs-book-unit">
                  <span className="grs-book-unit-value">{unitValue}</span>
                  <span className="grs-book-unit-suffix">{unitSuffix || `${sale.quoteSymbol} / GRS`}</span>
                </span>

                <span className="grs-book-stats" aria-label="Sale size">
                  <span className="grs-book-stat">
                    <span className="grs-book-meta-label">Left</span>
                    <span className="grs-book-meta-value">
                      {formatTokenBalance(sale.grsAmount, sale.decimals, 2)}
                      <img
                        className="grs-book-ticker-icon"
                        src={assetUrl('logo.png')}
                        alt=""
                        width={14}
                        height={14}
                      />
                      GRS
                    </span>
                  </span>
                  <span className="grs-book-stat">
                    <span className="grs-book-meta-label">Ask</span>
                    <span className="grs-book-meta-value">
                      {formatTokenBalance(sale.assetAmount, sale.quoteDecimals, 4)}
                      <img
                        className="grs-book-ticker-icon"
                        src={sale.quoteIcon}
                        alt=""
                        width={14}
                        height={14}
                      />
                      {sale.quoteSymbol}
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

            <div className="grai-action-metrics" aria-live="polite">
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
                <span className="grai-action-metric-value">
                  {amount.trim() ? `${amount} GRS` : '— GRS'}
                </span>
              </div>
              <div className="grai-action-metric-row">
                <span className="grai-action-metric-label-wrap">
                  <GraiFieldInfoButton
                    className="grai-action-metric-label-info"
                    hint="Buying the listed remainder pays remaining assetAmount exactly. A partial fill is floor(amount × assetAmount / remaining GRS)."
                  />
                  <span className="grai-action-metric-label">You pay</span>
                </span>
                <span className="grai-action-metric-value">
                  {costLabel ?? (selected ? `— ${selected.quoteSymbol}` : '—')}
                </span>
              </div>
            </div>

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
