import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatTokenBalance, normalizeDecimalInput, parseTokenAmount } from '../../grai/onchain'
import { GraiAssetSelect } from './GraiAssetSelect'

export type GraiAmountAsset = {
  icon: string
  symbol: string
  address: string
}

const PRESET_FRACTIONS = [25, 50, 75] as const

type Props = {
  label: string
  assets: GraiAmountAsset[]
  defaultAsset?: string
  value: string
  onValueChange: (value: string) => void
  onAssetChange?: (asset: GraiAmountAsset) => void
  balanceLabel: string
  maxAmount: string
  decimals: number | null
  usdLabel: string
}

export function GraiAmountInput({
  label,
  assets,
  defaultAsset,
  value,
  onValueChange,
  onAssetChange,
  balanceLabel,
  maxAmount,
  decimals,
  usdLabel,
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

  return (
    <div className="grai-amount-input">
      <div className="grai-amount-input-header">
        <span className="grai-amount-input-label">{label}</span>
        <span className="grai-amount-input-balance" aria-label={`Balance of ${selectedAsset?.symbol ?? 'asset'}`}>
          Balance: {balanceLabel.replace(new RegExp(`\\s*${selectedAsset?.symbol ?? ''}$`), '').trim() || balanceLabel}
        </span>
      </div>
      <div className="grai-amount-input-field">
        <input
          type="text"
          inputMode="decimal"
          className="grai-amount-input-control"
          placeholder="0.00"
          value={value}
          onChange={(e) => onValueChange(normalizeDecimalInput(e.target.value, decimals ?? 9))}
          aria-label={label}
        />
        <GraiAssetSelect
          assets={assets}
          selected={selectedAsset}
          onSelect={(asset) => setSelectedSymbol(asset.symbol)}
        />
      </div>
      <div className="grai-amount-input-footer">
        <span className={`grai-amount-input-usd${value.trim() ? '' : ' is-placeholder'}`} aria-live="polite">
          {usdLabel}
        </span>
        <div className="grai-amount-preset-btns" aria-label="Amount presets">
          {PRESET_FRACTIONS.map((percent) => (
            <button
              key={percent}
              type="button"
              className="grai-amount-preset-btn"
              onClick={() => applyFraction(percent / 100)}
              disabled={!maxAmount}
            >
              {percent}%
            </button>
          ))}
          <button
            type="button"
            className="grai-amount-preset-btn"
            onClick={() => applyFraction(1)}
            disabled={!maxAmount}
          >
            MAX
          </button>
        </div>
      </div>
    </div>
  )
}
