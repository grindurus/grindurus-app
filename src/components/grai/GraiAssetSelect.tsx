import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  /** Show a shimmer under the symbol while balance / detail data loads. */
  detailLoading?: boolean
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

function canScrollListFurther(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight > 1
}

export function GraiAssetSelect({
  assets,
  selected,
  onSelect,
  ariaLabel = 'Select asset',
  detailLabel,
  detailAriaLabel,
  detailLoading = false,
  disabled = false,
  menuOptions,
  selectedMenuId,
  onSelectMenuOption,
  menuAriaLabel,
  menuLeadingAction = null,
}: Props) {
  const { explorerTokenUrl } = useGraiDeployment()
  const [isOpen, setIsOpen] = useState(false)
  const [canScrollMore, setCanScrollMore] = useState(false)
  const [selectWidthPx, setSelectWidthPx] = useState<number | null>(null)
  const [widthReady, setWidthReady] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const widthPxRef = useRef<number | null>(null)

  const useMenuOptions = Boolean(menuOptions && menuOptions.length > 0)
  const hasChoices =
    Boolean(menuLeadingAction) ||
    (useMenuOptions ? menuOptions!.length > 1 : assets.length > 1)
  const listAriaLabel = menuAriaLabel ?? ariaLabel
  const listItemCount = useMenuOptions
    ? (menuOptions?.length ?? 0) + (menuLeadingAction ? 1 : 0)
    : assets.length
  const listContentKey = useMenuOptions
    ? `${listItemCount}:${menuOptions?.map((option) => option.detail ?? '').join('|') ?? ''}`
    : assets.map((asset) => `${asset.address}:${asset.detail ?? ''}`).join('|')

  const updateScrollHint = useCallback(() => {
    const list = listRef.current
    if (!list) {
      setCanScrollMore(false)
      return
    }
    setCanScrollMore(canScrollListFurther(list))
  }, [])

  const animateSelectWidth = useCallback(() => {
    const root = rootRef.current
    if (!root) return

    root.style.transition = 'none'
    const from =
      widthPxRef.current ?? Math.ceil(root.getBoundingClientRect().width)

    root.style.width = 'max-content'
    const to = Math.ceil(root.getBoundingClientRect().width)

    root.style.width = `${from}px`
    void root.offsetWidth
    root.style.removeProperty('transition')
    setWidthReady(true)
    setSelectWidthPx(from)
    widthPxRef.current = to

    root.getAnimations().forEach((animation) => animation.cancel())

    if (from === to) {
      setSelectWidthPx(to)
      return
    }

    const animation = root.animate([{ width: `${from}px` }, { width: `${to}px` }], {
      duration: 340,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'forwards',
    })

    animation.onfinish = () => {
      root.style.width = `${to}px`
      setSelectWidthPx(to)
      animation.cancel()
    }
  }, [])

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

  useLayoutEffect(() => {
    if (!isOpen) {
      setCanScrollMore(false)
      return
    }
    updateScrollHint()
    const raf = window.requestAnimationFrame(() => updateScrollHint())
    const list = listRef.current
    if (!list) {
      return () => window.cancelAnimationFrame(raf)
    }

    const onScroll = () => updateScrollHint()
    list.addEventListener('scroll', onScroll, { passive: true })
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => updateScrollHint()) : null
    resizeObserver?.observe(list)

    return () => {
      window.cancelAnimationFrame(raf)
      list.removeEventListener('scroll', onScroll)
      resizeObserver?.disconnect()
    }
  }, [isOpen, listContentKey, listItemCount, updateScrollHint])

  useLayoutEffect(() => {
    animateSelectWidth()
  }, [animateSelectWidth, detailLabel, detailLoading, hasChoices, selected?.icon, selected?.symbol])

  useEffect(() => {
    const onResize = () => animateSelectWidth()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [animateSelectWidth])

  const showDetail = Boolean(detailLabel) || detailLoading

  return (
    <div
      className={`grai-asset-select${disabled ? ' is-disabled' : ''}${widthReady ? ' is-width-ready' : ''}`}
      ref={rootRef}
      style={selectWidthPx != null ? { width: selectWidthPx } : undefined}
    >
      <button
        ref={triggerRef}
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
                className={`grai-asset-select-vol${detailLoading ? ' is-loading' : ''}`}
                aria-hidden={!showDetail}
                aria-busy={detailLoading || undefined}
                aria-label={
                  detailLoading
                    ? 'Loading balance'
                    : showDetail
                      ? detailAriaLabel ?? detailLabel ?? undefined
                      : undefined
                }
              >
                {detailLoading ? (
                  <span className="grai-asset-select-vol-skeleton" aria-hidden="true" />
                ) : showDetail ? (
                  detailLabel
                ) : (
                  '\u00a0'
                )}
              </span>
            </span>
          </span>
        ) : (
          <span className="grai-asset-select-symbol">—</span>
        )}
        {hasChoices && !selected ? <GraiUiCaret className="grai-asset-select-caret" /> : null}
      </button>
      {isOpen && (
        <div className={`grai-asset-select-dropdown${canScrollMore ? ' has-scroll-more' : ''}`}>
          <div
            ref={listRef}
            className="grai-asset-select-list"
            role="listbox"
            aria-label={listAriaLabel}
          >
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
          {canScrollMore ? (
            <div className="grai-asset-select-scroll-hint" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
