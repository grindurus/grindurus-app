import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { isAddress } from 'viem'
import { GraiAmountInput } from '../grai/GraiAmountInput'
import { GraiFieldInfoButton } from '../grai/GraiFieldInfo'
import { useEvmWallet } from '../../hooks/useEvmWallet'
import { useActiveWallet } from '../../hooks/useActiveWallet'
import { useWalletContext } from '../../providers/AppWalletProvider'
import { useGrsEvmTransaction } from '../../hooks/useGrsEvmTransaction'
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
import type { GrsEvmConfig } from '../../grs/deployments'
import type { GrsSale, GrsSnapshot } from '../../grs/evm/readProtocol'
import { navigateToGrsSection } from '../../utils/grsNavigation'
import { GrsFeedback, GrsSubmit, toastGrsSuccess } from './GrsActionBits'

type Props = {
  config: GrsEvmConfig | null
  snapshot: GrsSnapshot | null
  isLoading: boolean
  refresh: () => void
  note: ReactNode
}

export function GrsSalesPanel({ config, snapshot, isLoading, refresh, note }: Props) {
  const evmWallet = useEvmWallet()
  const activeWallet = useActiveWallet()
  const { setSelectedChainType } = useWalletContext()
  const { run, reset, error, lastHash, isPending } = useGrsEvmTransaction()
  const [saleId, setSaleId] = useState('')
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [cost, setCost] = useState<bigint | null>(null)

  const headerEvmAddress = useMemo(() => {
    const candidates = [evmWallet.address, activeWallet.address]
    for (const value of candidates) {
      if (value && isAddress(value)) return value
    }
    return ''
  }, [activeWallet.address, evmWallet.address])
  const recipientValue = recipient.trim() ? recipient : headerEvmAddress

  const decimals = snapshot?.decimals ?? GRS_DECIMALS
  const liveSales = snapshot?.sales ?? []
  const isPreview = liveSales.length === 0
  const sales = isPreview ? MOCK_GRS_SALES : liveSales
  const selected = sales.find((sale) => sale.id.toString() === saleId) ?? sales[0] ?? null

  useEffect(() => {
    if (selected && saleId !== selected.id.toString()) setSaleId(selected.id.toString())
  }, [saleId, selected])

  useEffect(() => {
    if (!headerEvmAddress) return
    setSelectedChainType('evm')
    setRecipient((current) => (current.trim() ? current : headerEvmAddress))
  }, [headerEvmAddress, setSelectedChainType])

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
  const remainingLabel = remaining == null ? null : formatTokenBalance(remaining, decimals, 2)

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
    const to = recipientValue.trim() || headerEvmAddress
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

  const catalog = (
    <div className="grs-sales-catalog-panel">
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
              {remainingLabel} GRS · 0% sold
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
                <span className="grs-book-network">
                  #{sale.id.toString()} · {config?.chainName ?? 'Ethereum'}
                </span>
                <span className="grs-book-quote">
                  estimation:{' '}
                  {formatTokenBalance(sale.assetAmount, sale.quoteDecimals, 8)} {sale.quoteSymbol}
                </span>
              </span>
              <span className="grs-book-row-bottom">
                <span className="grs-book-grs">
                  remaining: {formatTokenBalance(sale.grsAmount, decimals, 2)} GRS
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )

  if (config && isLoading && liveSales.length === 0) {
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
                reset()
              }}
              balanceLabel={buyableLabel ? `${buyableLabel} GRS` : '—'}
              balancePrefix="This sale:"
              usdTrailingLabel="remaining"
              maxAmount={maxAmount}
              decimals={decimals}
              disabled={!selected}
            />

            <label className="grai-mint-referrer-field">
              <span className="grai-mint-referrer-label-row">
                <span className="grai-mint-referrer-label">Deliver to</span>
                <GraiFieldInfoButton hint="Buyer of this GRS. Instant transfer — no vesting lock." />
              </span>
              <div className="grai-mint-referrer-input-row">
                <input
                  className="grai-mint-referrer-input"
                  value={recipientValue}
                  spellCheck={false}
                  placeholder="0x…"
                  onChange={(event) => {
                    setRecipient(event.target.value)
                    reset()
                  }}
                />
                <button
                  type="button"
                  className="grai-mint-referrer-me-btn"
                  disabled={!headerEvmAddress}
                  title="Use connected wallet from the header"
                  aria-label="Fill connected wallet address"
                  onClick={() => {
                    if (!headerEvmAddress) return
                    setSelectedChainType('evm')
                    setRecipient(headerEvmAddress)
                    reset()
                  }}
                >
                  ME
                </button>
              </div>
            </label>

            <div className="grai-action-metrics" aria-live="polite">
              <div className="grai-action-metric-row">
                <span className="grai-action-metric-label-wrap">
                  <GraiFieldInfoButton
                    className="grai-action-metric-label-info"
                    hint="GRS you receive from this buy. Instant transfer — no vesting lock."
                  />
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
              connected
              disabled={
                isPreview || !selected || !amount.trim() || !isAddress(recipientValue)
              }
              pending={isPending}
              label="Buy"
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
