import { useEffect, useRef, useState } from 'react'
import { useGraiDeployment } from '../../grai/GraiDeploymentProvider'
import type { GraiAmountAsset } from './GraiAmountInput'
import { MINT_ASSET_SOLSCAN_ICON } from './graiPageIcons'
import { GraiUiCaret } from './GraiUiCaret'

export type GraiAssetSelectMenuOption = {
  id: string
  label: string
  detail?: string
  icon?: string
}

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
  /**
   * When set, the dropdown lists these options instead of `assets`.
   * The trigger still shows the selected asset + detailLabel.
   */
  menuOptions?: GraiAssetSelectMenuOption[]
  selectedMenuId?: string | null
  onSelectMenuOption?: (id: string) => void
  menuAriaLabel?: string
  /** First row in the custom menu (e.g. "See all"). */
  menuLeadingAction?: { label: string; onClick: () => void } | null
}

export function GraiAssetSelect({
  assets,
  selected,
  onSelect,
  ariaLabel = 'Select asset',
  detailLabel,
  detailAriaLabel,
  disabled = false,
  menuOptions,
  selectedMenuId,
  onSelectMenuOption,
  menuAriaLabel,
  menuLeadingAction = null,
}: Props) {
  const { explorerTokenUrl } = useGraiDeployment()
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const useMenuOptions = Boolean(menuOptions && menuOptions.length > 0)
  const hasChoices =
    Boolean(menuLeadingAction) ||
    (useMenuOptions ? menuOptions!.length > 1 : assets.length > 1)
  const listAriaLabel = menuAriaLabel ?? ariaLabel

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
        <div className="grai-asset-select-list" role="listbox" aria-label={listAriaLabel}>
          {useMenuOptions ? (
            <>
              {menuLeadingAction ? (
                <div className="grai-asset-select-option grai-asset-select-option--leading">
                  <button
                    type="button"
                    className="grai-asset-select-option-btn grai-asset-select-option-btn--leading"
                    onClick={() => {
                      menuLeadingAction.onClick()
                      setIsOpen(false)
                    }}
                  >
                    <span className="grai-asset-select-symbol">{menuLeadingAction.label}</span>
                  </button>
                </div>
              ) : null}
              {menuOptions!.map((option) => {
                const isActive =
                  selectedMenuId != null &&
                  option.id.toLowerCase() === selectedMenuId.toLowerCase()
                return (
                  <div
                    key={option.id}
                    className={`grai-asset-select-option${isActive ? ' is-active' : ''}`}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className="grai-asset-select-option-btn grai-asset-select-option-btn--menu"
                      onClick={() => {
                        onSelectMenuOption?.(option.id)
                        setIsOpen(false)
                      }}
                    >
                      {option.icon ? (
                        <span className="grai-asset-select-icon" aria-hidden="true">
                          <img
                            src={option.icon}
                            alt=""
                            width={20}
                            height={20}
                            loading="lazy"
                            decoding="async"
                          />
                        </span>
                      ) : null}
                      <span className="grai-asset-select-option-copy">
                        <span className="grai-asset-select-symbol">{option.label}</span>
                        {option.detail ? (
                          <span className="grai-asset-select-option-detail">{option.detail}</span>
                        ) : null}
                      </span>
                    </button>
                  </div>
                )
              })}
            </>
          ) : (
            assets.map((asset) => {
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
                        <img
                          src={asset.icon}
                          alt=""
                          width={20}
                          height={20}
                          loading="lazy"
                          decoding="async"
                        />
                      </span>
                      <span className="grai-asset-select-option-copy">
                        <span className="grai-asset-select-symbol">{asset.symbol}</span>
                        {asset.detail ? (
                          <span className="grai-asset-select-option-detail">{asset.detail}</span>
                        ) : null}
                      </span>
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
              })
          )}
        </div>
      )}
    </div>
  )
}
