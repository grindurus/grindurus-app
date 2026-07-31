import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  formatVolatilityPct,
  lookupGraiAssetYieldMetrics,
} from '../../grai/assetYieldMetrics'
import { formatTokenBalance, normalizeDecimalInput, parseTokenAmount } from '../../grai/onchain'
import { GraiAssetSelect, type GraiAssetSelectMenuOption } from './GraiAssetSelect'

export type GraiAmountAsset = {
  icon: string
  symbol: string
  address: string
  /** Optional secondary line in the dropdown (e.g. claimable balance). */
  detail?: string
}

type Props = {
  label: string
  assets: GraiAmountAsset[]
  defaultAsset?: string
  value: string
  onValueChange: (value: string) => void
  onAssetChange?: (asset: GraiAmountAsset) => void
  balanceLabel: string
  /** Prefix before the balance amount. Defaults to "Available:". */
  balancePrefix?: string
  balanceTopLabel?: string
  maxAmount: string
  decimals: number | null
  usdLabel?: string
  footerStartLabel?: string
  showPresets?: boolean
  /** When false, hides price vol under the asset select. Defaults to true. */
  showVolatility?: boolean
  /**
   * Fill-field layout (matches bribe/auction amount card):
   * escrow/balance above the card; label + presets above input inside the card.
   */
  presetsUnderLabel?: boolean
  /** Rendered under the footer row inside the amount card. */
  afterFooter?: ReactNode
  /** Greys out amount + asset select and blocks interaction. */
  disabled?: boolean
  /** Custom dropdown options (e.g. bribe voters). Trigger still shows the selected asset. */
  selectMenuOptions?: GraiAssetSelectMenuOption[]
  selectedMenuId?: string | null
  onSelectMenuOption?: (id: string) => void
  selectMenuAriaLabel?: string
  selectAriaLabel?: string
  selectMenuLeadingAction?: { label: string; onClick: () => void } | null
}

export function GraiAmountInput({
  label,
  assets,
  defaultAsset,
  value,
  onValueChange,
  onAssetChange,
  balanceLabel,
  balancePrefix = 'Available:',
  balanceTopLabel,
  maxAmount,
  decimals,
  usdLabel,
  footerStartLabel,
  showPresets = true,
  showVolatility = true,
  presetsUnderLabel = false,
  afterFooter,
  disabled = false,
  selectMenuOptions,
  selectedMenuId,
  onSelectMenuOption,
  selectMenuAriaLabel,
  selectAriaLabel,
  selectMenuLeadingAction = null,
}: Props) {
  const [selectedSymbol, setSelectedSymbol] = useState<string | undefined>(defaultAsset)

  const selectedAsset = useMemo(
    () =>
      assets.find((asset) => asset.symbol === selectedSymbol) ??
      assets.find((asset) => asset.symbol === defaultAsset) ??
      assets[0],
    [assets, defaultAsset, selectedSymbol],
  )

  const onAssetChangeRef = useRef(onAssetChange)
  useEffect(() => {
    onAssetChangeRef.current = onAssetChange
  })
  useEffect(() => {
    if (selectedAsset) onAssetChangeRef.current?.(selectedAsset)
  }, [selectedAsset])

  const applyFraction = useCallback(
    (fraction: number) => {
      if (!maxAmount) return
      if (fraction >= 1) {
        onValueChange(maxAmount)
        return
      }
      if (decimals === null) return
      try {
        const maxRaw = parseTokenAmount(maxAmount, decimals)
        const amountRaw = (maxRaw * BigInt(Math.round(fraction * 100))) / 100n
        onValueChange(formatTokenBalance(amountRaw, decimals))
      } catch {
        // ignore an unparsable balance
      }
    },
    [decimals, maxAmount, onValueChange],
  )

  const useFillLayout = Boolean(presetsUnderLabel)
  const showPresetsInHeader = showPresets && useFillLayout
  const showPresetsInField = showPresets && !useFillLayout
  const showFooter = Boolean(footerStartLabel)
  const showMetaAboveField = useFillLayout && Boolean(balanceTopLabel || balanceLabel)
  const isGraiAsset = selectedAsset?.symbol.toUpperCase() === 'GRAI'
  const balanceText =
    balanceLabel.replace(new RegExp(`\\s*${selectedAsset?.symbol ?? ''}$`), '').trim() || balanceLabel
  const showUsdSlot = Boolean(usdLabel)
  const usdCollapsed = showUsdSlot && isGraiAsset
  const assetSelectDetailLabel = useMemo(() => {
    if (useFillLayout) {
      if (!showVolatility || !selectedAsset || isGraiAsset) return null
      const metrics = lookupGraiAssetYieldMetrics(selectedAsset.symbol)
      return metrics ? `price vol: ${formatVolatilityPct(metrics.volatilityPct)}` : null
    }
    return balanceText
  }, [
    balanceText,
    isGraiAsset,
    selectedAsset,
    showVolatility,
    useFillLayout,
  ])

  const presetButtons = showPresets ? (
    <div className="grai-amount-preset-btns" aria-label="Amount presets">
      <button
        type="button"
        className="grai-amount-preset-btn"
        onClick={() => applyFraction(1)}
        disabled={disabled || !maxAmount}
      >
        MAX
      </button>
    </div>
  ) : null

  const card = (
    <div className={`grai-amount-input${useFillLayout ? ' is-fill-layout' : ''}${disabled ? ' is-disabled' : ''}`}>
      <div
        className={[
          'grai-amount-input-header',
          !useFillLayout && balanceTopLabel ? 'has-balance-top' : '',
          useFillLayout ? 'is-fill-header' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {!useFillLayout && balanceTopLabel ? (
          <span className="grai-amount-input-balance-top" aria-live="polite">
            {balanceTopLabel}
          </span>
        ) : null}
        <span className="grai-amount-input-label">{label}</span>
        {showPresetsInHeader ? (
          <span className="grai-amount-input-tools">{presetButtons}</span>
        ) : null}
      </div>
      <div className="grai-amount-input-field">
        <div
          className={[
            'grai-amount-input-value-col',
            showUsdSlot ? 'has-usd' : '',
            usdCollapsed ? 'is-usd-collapsed' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <input
            type="text"
            inputMode="decimal"
            className="grai-amount-input-control"
            placeholder="0.00"
            value={value}
            onChange={(e) => onValueChange(normalizeDecimalInput(e.target.value, decimals ?? 9))}
            aria-label={label}
            disabled={disabled}
            readOnly={disabled}
          />
          {showUsdSlot ? (
            <span
              className={`grai-amount-input-usd${value.trim() ? '' : ' is-placeholder'}${
                usdCollapsed ? ' is-collapsed' : ''
              }`}
              aria-live="polite"
              aria-hidden={usdCollapsed}
            >
              {usdLabel}
            </span>
          ) : null}
        </div>
        {showPresetsInField ? (
          <div className="grai-amount-input-max" aria-label="Amount presets">
            <button
              type="button"
              className="grai-amount-preset-btn grai-amount-preset-btn--field"
              onClick={() => applyFraction(1)}
              disabled={disabled || !maxAmount}
            >
              MAX
            </button>
          </div>
        ) : null}
        <GraiAssetSelect
          assets={assets}
          selected={selectedAsset}
          onSelect={(asset) => setSelectedSymbol(asset.symbol)}
          detailLabel={assetSelectDetailLabel}
          detailAriaLabel={
            useFillLayout
              ? assetSelectDetailLabel
              : `${balancePrefix} ${balanceText}`.replace(/\s+/g, ' ').trim()
          }
          disabled={disabled}
          ariaLabel={selectAriaLabel}
          menuOptions={selectMenuOptions}
          selectedMenuId={selectedMenuId}
          onSelectMenuOption={onSelectMenuOption}
          menuAriaLabel={selectMenuAriaLabel}
          menuLeadingAction={selectMenuLeadingAction}
        />
      </div>
      {showFooter ? (
        <div className="grai-amount-input-footer">
          {footerStartLabel ? (
            <span
              className={`grai-amount-input-footer-start${value.trim() ? '' : ' is-placeholder'}`}
              aria-live="polite"
            >
              {footerStartLabel}
            </span>
          ) : null}
        </div>
      ) : null}
      {afterFooter ? <div className="grai-amount-input-after-footer">{afterFooter}</div> : null}
    </div>
  )

  if (!useFillLayout) return card

  return (
    <div className="grai-amount-input-fill-wrap">
      {showMetaAboveField ? (
        <div className="grai-amount-input-meta">
          {balanceTopLabel ? (
            <span className="grai-amount-input-balance-top" aria-live="polite">
              {balanceTopLabel}
            </span>
          ) : (
            <span />
          )}
          <span className="grai-amount-input-balance" aria-label={`Balance of ${selectedAsset?.symbol ?? 'asset'}`}>
            {balancePrefix} {balanceText}
          </span>
        </div>
      ) : null}
      {card}
    </div>
  )
}
