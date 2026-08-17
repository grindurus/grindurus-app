import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { isAddress } from 'viem'
import { GraiAmountInput } from '../grai/GraiAmountInput'
import { GraiFieldInfoButton } from '../grai/GraiFieldInfo'
import { useEvmWallet } from '../../hooks/useEvmWallet'
import { useGrsEvmTransaction } from '../../hooks/useGrsEvmTransaction'
import { formatTokenBalance, normalizeDecimalInput, parseTokenAmount } from '../../grai/onchain'
import { assetUrl } from '../../utils/appPaths'
import { shortenAddress } from '../../utils/shortenAddress'
import { GRS_DECIMALS } from '../../grs/constants'
import {
  MOCK_GRS_SALES,
  MOCK_TOKEN_SALES_REMAINING,
  mockQuoteSaleCost,
  partyName,
} from '../../grs/preview'
import { executeGrsBuy } from '../../grs/evm/executeTransactions'
import { previewGrsBuy } from '../../grs/evm/readProtocol'
import type { GrsEvmConfig } from '../../grs/deployments'
import type { GrsSale, GrsSnapshot } from '../../grs/evm/readProtocol'
import { navigateToGrsSection } from '../../utils/grsNavigation'
import { GrsFeedback, GrsSubmit, toastGrsSuccess } from './GrsActionBits'

const TOKEN_SALES_CAP = 150_000_000n * 10n ** 18n

type Props = {
  config: GrsEvmConfig | null
  snapshot: GrsSnapshot | null
  isLoading: boolean
  refresh: () => void
  note: ReactNode
}

function saleHeadline(sale: GrsSale): string {
  return `${formatTokenBalance(sale.assetAmount, sale.quoteDecimals, 8)} ${sale.quoteSymbol} / ${formatTokenBalance(sale.grsAmount, GRS_DECIMALS, 2)} GRS`
}

function proceedsWho(sale: GrsSale): string {
  const name = partyName(sale.recipient)
  const short = shortenAddress(sale.recipient)
  return name ? `${name} · ${short}` : short
}

export function GrsSalesPanel({ config, snapshot, isLoading, refresh, note }: Props) {
  const evmWallet = useEvmWallet()
  const { run, reset, error, lastHash, isPending } = useGrsEvmTransaction()
  const [saleId, setSaleId] = useState('')
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [cost, setCost] = useState<bigint | null>(null)

  const decimals = snapshot?.decimals ?? GRS_DECIMALS
  const liveSales = snapshot?.sales ?? []
  const isPreview = liveSales.length === 0
  const sales = isPreview ? MOCK_GRS_SALES : liveSales
  const selected = sales.find((sale) => sale.id.toString() === saleId) ?? sales[0] ?? null

  useEffect(() => {
    if (selected && saleId !== selected.id.toString()) setSaleId(selected.id.toString())
  }, [saleId, selected])

  useEffect(() => {
    if (evmWallet.address) {
      setRecipient((current) => (current.trim() ? current : evmWallet.address ?? ''))
    }
  }, [evmWallet.address])

  useEffect(() => {
    if (!selected) {
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
        if (isPreview || !config) {
          if (!cancelled) setCost(mockQuoteSaleCost(raw, selected.grsAmount, selected.assetAmount))
          return
        }
        void previewGrsBuy(config, selected.id, raw)
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
  }, [amount, config, decimals, isPreview, selected])

  const remaining = isPreview
    ? MOCK_TOKEN_SALES_REMAINING
    : (snapshot?.tokenSalesRemaining ?? null)
  const sold = remaining == null ? null : TOKEN_SALES_CAP > remaining ? TOKEN_SALES_CAP - remaining : 0n
  const remainingLabel = remaining == null ? null : formatTokenBalance(remaining, decimals, 2)
  const soldPct = remaining == null || sold == null ? 0 : Number((sold * 10_000n) / TOKEN_SALES_CAP) / 100

  const assets = useMemo(
    () => [{ icon: assetUrl('logo.png'), symbol: 'GRS', address: config?.address ?? 'grs' }],
    [config?.address],
  )
  const listed = selected?.grsAmount ?? 0n
  const buyable =
    remaining == null ? listed : listed === 0n ? remaining : listed < remaining ? listed : remaining
  const maxAmount = buyable > 0n ? formatTokenBalance(buyable, decimals) : ''
  const buyableLabel = buyable > 0n ? formatTokenBalance(buyable, decimals, 2) : null
  const costLabel =
    selected && cost != null
      ? `${formatTokenBalance(cost, selected.quoteDecimals, 8)} ${selected.quoteSymbol}`
      : null

  const handleBuy = async () => {
    if (!selected || !config || isPreview) return
    const to = recipient.trim() || evmWallet.address
    if (!to || !isAddress(to)) return
    reset()
    try {
      const result = await run({
        config,
        connectMessage: 'Connect an EVM wallet to buy GRS',
        chainAction: 'buy GRS',
        failureMessage: 'Purchase failed',
        amountInput: amount,
        execute: () =>
          executeGrsBuy({
            config,
            saleId: selected.id,
            amountInput: amount,
            recipient: to,
            nativeQuote: selected.native,
            quoteAddress: selected.asset,
            decimals,
          }),
      })
      toastGrsSuccess(`Bought ${result.amountLabel} GRS`, config.chainId, result.hash)
      setAmount('')
      refresh()
    } catch {
      /* status captured */
    }
  }

  if (config && isLoading && liveSales.length === 0) {
    return (
      <div className="grs-sales-split">
        <aside className="grs-sales-catalog" />
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

  const catalog = (
    <aside className="grs-sales-catalog">
      <div className="grs-sales-catalog-panel">
      {isPreview ? (
        <p className="grs-preview-note">
          Preview of the TGE sale book — several rows, each with remaining GRS and the quote
          proceeds the seller wants for that remainder. Home owner lists and LayerZero-publishes;
          the spoke accepts that listing after inventory is on this contract. TokenSales 150M is
          still the chain-wide buy/grant cap.
        </p>
      ) : null}

      {remaining != null ? (
        <div className="grai-action-metrics">
          <div className="grai-action-metric-row">
            <span className="grai-action-metric-label-wrap">
              <GraiFieldInfoButton
                className="grai-action-metric-label-info"
                hint="Token-sales bucket: 150M GRS (15% of supply) on this chain. Instant transfer, no vesting."
              />
              <span className="grai-action-metric-label">For sale</span>
            </span>
            <span className="grai-action-metric-value">
              {remainingLabel} GRS · {soldPct.toFixed(1)}% sold
            </span>
          </div>
        </div>
      ) : null}

      <div className="grs-book" role="list">
        {sales.map((sale) => {
          const active = selected?.id === sale.id
          return (
            <button
              key={sale.id.toString()}
              type="button"
              role="listitem"
              className={`grs-book-row${active ? ' is-active' : ''}`}
              onClick={() => {
                setSaleId(sale.id.toString())
                reset()
              }}
            >
              <span className="grs-book-row-top">
                <span>
                  #{sale.id.toString()} · {sale.quoteSymbol}
                </span>
                <span>{saleHeadline(sale)}</span>
              </span>
              <span className="grs-book-who">
                {formatTokenBalance(sale.grsAmount, decimals, 2)} GRS · proceeds {proceedsWho(sale)}
              </span>
            </button>
          )
        })}
      </div>
      </div>
    </aside>
  )

  return (
    <div className="grs-sales-split">
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
                reset()
              }}
              balanceLabel={buyableLabel ? `${buyableLabel} GRS` : '—'}
              balancePrefix="This sale:"
              maxAmount={maxAmount}
              decimals={decimals}
              disabled={!selected}
            />

            <label className="grai-mint-referrer-field">
              <span className="grai-mint-referrer-label-row">
                <span className="grai-mint-referrer-label">Deliver to</span>
                <GraiFieldInfoButton hint="Buyer of this GRS. Instant transfer — no vesting lock." />
              </span>
              <input
                className="grai-mint-referrer-input"
                value={recipient}
                spellCheck={false}
                placeholder="0x…"
                onChange={(event) => {
                  setRecipient(event.target.value)
                  reset()
                }}
              />
            </label>

            <div className="grai-action-metrics" aria-live="polite">
              {selected ? (
                <div className="grai-action-metric-row">
                  <span className="grai-action-metric-label-wrap">
                    <GraiFieldInfoButton
                      className="grai-action-metric-label-info"
                      hint="Quote proceeds from buy() go to this address (sale.recipient), not to the GRS buyer."
                    />
                    <span className="grai-action-metric-label">Proceeds</span>
                  </span>
                  <span className="grai-action-metric-value">{proceedsWho(selected)}</span>
                </div>
              ) : null}
              <div className="grai-action-metric-row">
                <span className="grai-action-metric-label-wrap">
                  <GraiFieldInfoButton
                    className="grai-action-metric-label-info"
                    hint="Buying the listed remainder pays remaining assetAmount exactly. A partial fill is floor(amount × assetAmount / remaining GRS). Native ETH is sent as msg.value; ERC-20 is approved then transferred."
                  />
                  <span className="grai-action-metric-label">You pay</span>
                </span>
                <span className="grai-action-metric-value">
                  {costLabel ?? (selected ? `— ${selected.quoteSymbol}` : '—')}
                </span>
              </div>
            </div>

            <GrsFeedback
              isPending={isPending}
              pendingLabel="Buying GRS…"
              error={error}
              hash={lastHash}
              chainId={config?.chainId}
              successLabel="Purchase confirmed."
            />

            {lastHash ? (
              <button type="button" className="grs-text-btn" onClick={() => navigateToGrsSection('bridge')}>
                Bridge it next
              </button>
            ) : null}

            <GrsSubmit
              connected={evmWallet.isConnected}
              disabled={
                isPreview || !selected || !amount.trim() || !isAddress(recipient.trim() || evmWallet.address || '')
              }
              pending={isPending}
              label={selected ? `Buy with ${selected.quoteSymbol}` : 'Buy GRS'}
              onClick={() => {
                void handleBuy()
              }}
            />

            <div className="grai-action-deposit-notes">
              <p className="grai-action-deposit-note">{note}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
