import { useEffect, useRef, useState } from 'react'
import { useGraiDeployment } from '../../grai/GraiDeploymentProvider'
import type { GraiAmountAsset } from './GraiAmountInput'
import { MINT_ASSET_SOLSCAN_ICON } from './graiPageIcons'
import { GraiUiCaret } from './GraiUiCaret'

type Props = {
  assets: GraiAmountAsset[]
  selected: GraiAmountAsset | undefined
  onSelect: (asset: GraiAmountAsset) => void
  ariaLabel?: string
  /** Secondary line under the symbol (e.g. balance or volatility). */
  detailLabel?: string | null
  /** Accessible label for detail line when it differs from visible text. */
  detailAriaLabel?: string | null
  disabled?: boolean
}

export function GraiAssetSelect({
  assets,
  selected,
  onSelect,
  ariaLabel = 'Select asset',
  detailLabel,
  detailAriaLabel,
  disabled = false,
}: Props) {
  const { explorerTokenUrl } = useGraiDeployment()
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [isOpen])

  useEffect(() => {
    if (disabled) setIsOpen(false)
  }, [disabled])

  const hasChoices = assets.length > 1
  const showDetail = Boolean(detailLabel)

  return (
    <div className={`grai-asset-select${disabled ? ' is-disabled' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="grai-asset-select-trigger"
        onClick={() => {
          if (disabled || !hasChoices) return
          setIsOpen((open) => !open)
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        {selected ? (
          <span key={selected.symbol} className="grai-asset-select-main is-swap-in">
            <span className="grai-asset-select-token">
              <span className="grai-asset-select-icon" aria-hidden="true">
                <img src={selected.icon} alt="" width={24} height={24} loading="lazy" decoding="async" />
              </span>
              <span className="grai-asset-select-symbol">{selected.symbol}</span>
              {hasChoices ? <GraiUiCaret className="grai-asset-select-caret" /> : null}
            </span>
            <span className={`grai-asset-select-vol-slot${showDetail ? ' is-open' : ''}`}>
              <span
                className="grai-asset-select-vol"
                aria-hidden={!showDetail}
                aria-label={showDetail ? detailAriaLabel ?? detailLabel ?? undefined : undefined}
              >
                {showDetail ? detailLabel : '\u00a0'}
              </span>
            </span>
          </span>
        ) : (
          <span className="grai-asset-select-symbol">—</span>
        )}
        {hasChoices && !selected ? <GraiUiCaret className="grai-asset-select-caret" /> : null}
      </button>
      {isOpen && (
        <div className="grai-asset-select-list" role="listbox" aria-label={ariaLabel}>
          {assets.map((asset) => {
            const explorerHref = asset.address ? explorerTokenUrl(asset.address) : null
            const isActive = asset.symbol === selected?.symbol
            return (
              <div
                key={asset.address || asset.symbol}
                className={`grai-asset-select-option${isActive ? ' is-active' : ''}`}
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className="grai-asset-select-option-btn"
                  onClick={() => {
                    onSelect(asset)
                    setIsOpen(false)
                  }}
                >
                  <span className="grai-asset-select-icon" aria-hidden="true">
                    <img src={asset.icon} alt="" width={20} height={20} loading="lazy" decoding="async" />
                  </span>
                  <span className="grai-asset-select-symbol">{asset.symbol}</span>
                </button>
                {explorerHref ? (
                  <a
                    href={explorerHref}
                    target="_blank"
                    rel="noreferrer"
                    className="grai-mint-asset-value-solscan grai-asset-select-explorer"
                    aria-label={`View ${asset.symbol} on block explorer`}
                    title={`View ${asset.symbol} on block explorer`}
                  >
                    {MINT_ASSET_SOLSCAN_ICON}
                  </a>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
