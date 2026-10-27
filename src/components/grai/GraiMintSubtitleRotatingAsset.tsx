import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { FALLBACK_GRAI_ASSETS, type GraiAsset, type GraiAssetIcon } from '../../grai/knownMints'
import { useGraiAssets } from '../../hooks/useGraiAssets'

const MINT_SUBTITLE_ROTATE_MS = 2400
const MINT_SUBTITLE_STABLECOIN_SYMBOLS = new Set(['USDC', 'USDT', 'USD', 'DAI'])
const MINT_SUBTITLE_FEATURED_SYMBOLS = ['ETH'] as const

type MintSubtitleRotateEntry = {
  label: string
  icon?: GraiAssetIcon
}

function resolveMintSubtitleAsset(symbol: string, source: GraiAsset[]): MintSubtitleRotateEntry | null {
  const normalized = symbol.toUpperCase()
  const match = source.find((asset) => asset.symbol.toUpperCase() === normalized)
  if (match) return { label: match.symbol, icon: match.icon }

  const fallback = FALLBACK_GRAI_ASSETS.find((asset) => asset.symbol.toUpperCase() === normalized)
  if (fallback) return { label: fallback.symbol, icon: fallback.icon }

  return null
}

function buildMintSubtitleRotateEntries(source: GraiAsset[]): MintSubtitleRotateEntry[] {
  const seen = new Set<string>()
  const entries: MintSubtitleRotateEntry[] = [{ label: 'Assets' }]
  seen.add('Assets')

  for (const symbol of MINT_SUBTITLE_FEATURED_SYMBOLS) {
    const featured = resolveMintSubtitleAsset(symbol, source)
    if (!featured || seen.has(featured.label)) continue
    seen.add(featured.label)
    entries.push(featured)
  }

  for (const asset of source) {
    if (!asset.symbol || seen.has(asset.symbol)) continue
    if (MINT_SUBTITLE_STABLECOIN_SYMBOLS.has(asset.symbol.toUpperCase())) continue
    seen.add(asset.symbol)
    entries.push({ label: asset.symbol, icon: asset.icon })
  }

  return entries
}

export type GraiMintSubtitleProbeVariant = 'deposit' | 'claim'

export function GraiMintSubtitleRotatingAsset({
  onMaxLineWidth,
  probeVariant = 'deposit',
}: {
  /** Called when the widest full-line width is known/updated (for stable scale). */
  onMaxLineWidth?: (maxLineWidth: number) => void
  /** Full-line probe copy used to lock shrink-to-fit scale across ticker words. */
  probeVariant?: GraiMintSubtitleProbeVariant
}) {
  const { assets } = useGraiAssets()
  const rotateEntries = useMemo(() => {
    const source = assets.length > 0 ? assets : FALLBACK_GRAI_ASSETS
    return buildMintSubtitleRotateEntries(source)
  }, [assets])
  const [entryIndex, setEntryIndex] = useState(0)
  const currentEntry = rotateEntries[entryIndex] ?? { label: 'Assets' }
  const wordRef = useRef<HTMLSpanElement>(null)
  const probeRef = useRef<HTMLSpanElement>(null)
  const [slotWidth, setSlotWidth] = useState<number | null>(null)
  const [isWidthTransitionReady, setIsWidthTransitionReady] = useState(false)

  const measureCurrentWidth = useCallback(() => {
    const word = wordRef.current
    if (!word) return
    const width = Math.ceil(word.scrollWidth)
    if (width > 0) setSlotWidth(width)
  }, [])

  const measureMaxLineWidth = useCallback(() => {
    const probe = probeRef.current
    if (!probe) return
    let max = 0
    for (const child of probe.children) {
      max = Math.max(max, Math.ceil((child as HTMLElement).scrollWidth))
    }
    if (max > 0) onMaxLineWidth?.(max)
  }, [onMaxLineWidth])

  useLayoutEffect(() => {
    measureCurrentWidth()
  }, [currentEntry.label, currentEntry.icon?.src, measureCurrentWidth])

  useLayoutEffect(() => {
    measureMaxLineWidth()
  }, [rotateEntries, probeVariant, measureMaxLineWidth])

  useLayoutEffect(() => {
    if (slotWidth === null) return
    const frame = window.requestAnimationFrame(() => setIsWidthTransitionReady(true))
    return () => window.cancelAnimationFrame(frame)
  }, [slotWidth])

  useEffect(() => {
    setEntryIndex(0)
  }, [rotateEntries])

  useEffect(() => {
    if (rotateEntries.length <= 1) return undefined
    const id = window.setInterval(() => {
      setEntryIndex((current) => (current + 1) % rotateEntries.length)
    }, MINT_SUBTITLE_ROTATE_MS)
    return () => window.clearInterval(id)
  }, [rotateEntries])

  return (
    <>
      {/* Off-screen full-line probes: scale locks to the widest variant, slot still hugs each ticker. */}
      <span ref={probeRef} className="grai-page-subtitle-line-probe" aria-hidden="true">
        {rotateEntries.map((entry) => (
          <span key={`probe-line-${probeVariant}-${entry.label}`} className="grai-page-subtitle-text-line">
            {probeVariant === 'claim' ? (
              <>
                <span className="grai-page-subtitle-text-segment">Claim</span>
                <span className="grai-page-subtitle-rotating-slot">
                  <span className="grai-page-subtitle-rotating-word-current">
                    {entry.icon ? (
                      <span className="grai-page-subtitle-rotating-word-icon">
                        <img
                          src={entry.icon.src}
                          alt=""
                          loading="eager"
                          decoding="async"
                          onLoad={measureMaxLineWidth}
                        />
                      </span>
                    ) : null}
                    <span className="grai-page-subtitle-rotating-word-label">{entry.label}</span>
                  </span>
                </span>
                <span className="grai-page-subtitle-text-segment">Price Volatility Yields</span>
              </>
            ) : (
              <>
                <span className="grai-page-subtitle-text-segment">Turn</span>
                <span className="grai-page-subtitle-rotating-slot">
                  <span className="grai-page-subtitle-rotating-word-current">
                    {entry.icon ? (
                      <span className="grai-page-subtitle-rotating-word-icon">
                        <img
                          src={entry.icon.src}
                          alt=""
                          loading="eager"
                          decoding="async"
                          onLoad={measureMaxLineWidth}
                        />
                      </span>
                    ) : null}
                    <span className="grai-page-subtitle-rotating-word-label">{entry.label}</span>
                  </span>
                </span>
                <span className="grai-page-subtitle-text-segment">Price Volatility</span>
                <span className="grai-page-subtitle-text-segment grai-page-subtitle-text-segment--after-term">
                  into Yields
                </span>
              </>
            )}
          </span>
        ))}
      </span>
      <span
        className={`grai-page-subtitle-rotating-slot${isWidthTransitionReady ? ' is-width-ready' : ''}`}
        style={slotWidth === null ? undefined : { width: `${slotWidth}px` }}
        aria-live="polite"
      >
        <span
          key={currentEntry.label}
          ref={wordRef}
          className="grai-page-subtitle-rotating-word-current"
        >
          {currentEntry.icon ? (
            <span className="grai-page-subtitle-rotating-word-icon" aria-hidden="true">
              <img
                src={currentEntry.icon.src}
                alt=""
                loading="lazy"
                decoding="async"
                onLoad={measureCurrentWidth}
              />
            </span>
          ) : null}
          <span className="grai-page-subtitle-rotating-word-label">{currentEntry.label}</span>
        </span>
      </span>
    </>
  )
}

export function GraiRedeemSubtitleText({ graiIcon }: { graiIcon: string }) {
  return (
    <span className="grai-page-subtitle-text-line">
      <span className="grai-page-subtitle-text-segment">Redeem</span>
      <span className="grai-page-subtitle-rotating-slot">
        <span className="grai-page-subtitle-rotating-word-current">
          <span className="grai-page-subtitle-rotating-word-icon" aria-hidden="true">
            <img src={graiIcon} alt="" loading="lazy" decoding="async" />
          </span>
          <span className="grai-page-subtitle-rotating-word-label">GRAI</span>
        </span>
      </span>
      <span className="grai-page-subtitle-text-segment">reserves</span>
    </span>
  )
}

function isCompactSubtitleViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
}

function useGraiSubtitleFit() {
  const fitRef = useRef<HTMLSpanElement>(null)
  const maxLineWidthRef = useRef(0)
  const [scale, setScale] = useState(1)

  const fitToWidth = useCallback((maxLineWidth?: number) => {
    const fit = fitRef.current
    if (!fit) return
    // Mobile uses a 2-line layout — keep full font size, no shrink-to-fit.
    if (isCompactSubtitleViewport()) {
      setScale(1)
      return
    }
    const available = fit.clientWidth
    if (available <= 0) return
    if (typeof maxLineWidth === 'number' && maxLineWidth > 0) {
      maxLineWidthRef.current = Math.max(maxLineWidthRef.current, maxLineWidth)
    }
    const needed = maxLineWidthRef.current
    if (needed <= 0) return
    const next = Math.min(1, (available - 4) / needed)
    setScale((current) => (Math.abs(current - next) < 0.005 ? current : Math.max(0.72, next)))
  }, [])

  const onMaxLineWidth = useCallback(
    (maxLineWidth: number) => {
      fitToWidth(maxLineWidth)
    },
    [fitToWidth],
  )

  useLayoutEffect(() => {
    fitToWidth()
    const fit = fitRef.current
    if (!fit || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => fitToWidth())
    ro.observe(fit)
    const mq = window.matchMedia('(max-width: 640px)')
    const onMq = () => fitToWidth()
    const onResize = () => fitToWidth()
    mq.addEventListener('change', onMq)
    window.addEventListener('resize', onResize)
    return () => {
      ro.disconnect()
      mq.removeEventListener('change', onMq)
      window.removeEventListener('resize', onResize)
    }
  }, [fitToWidth])

  return { fitRef, scale, onMaxLineWidth }
}

export function GraiMintSubtitleText() {
  const { fitRef, scale, onMaxLineWidth } = useGraiSubtitleFit()

  return (
    <span
      className="grai-page-subtitle-text-line-fit"
      ref={fitRef}
      style={{ '--grai-subtitle-scale': String(scale) } as CSSProperties}
    >
      <span className="grai-page-subtitle-text-line">
        <span className="grai-page-subtitle-text-row">
          <span className="grai-page-subtitle-text-segment">Turn</span>
          <GraiMintSubtitleRotatingAsset
            probeVariant="deposit"
            onMaxLineWidth={onMaxLineWidth}
          />
        </span>
        <span className="grai-page-subtitle-text-row">
          <span className="grai-page-subtitle-text-segment">Price Volatility</span>
          <span className="grai-page-subtitle-text-segment grai-page-subtitle-text-segment--after-term">
            into Yields
          </span>
        </span>
      </span>
    </span>
  )
}

export function GraiClaimSubtitleText() {
  const { fitRef, scale, onMaxLineWidth } = useGraiSubtitleFit()

  return (
    <span
      className="grai-page-subtitle-text-line-fit"
      ref={fitRef}
      style={{ '--grai-subtitle-scale': String(scale) } as CSSProperties}
    >
      <span className="grai-page-subtitle-text-line">
        <span className="grai-page-subtitle-text-segment">Claim</span>
        <GraiMintSubtitleRotatingAsset
          probeVariant="claim"
          onMaxLineWidth={onMaxLineWidth}
        />
        <span className="grai-page-subtitle-text-segment">Price Volatility Yields</span>
      </span>
    </span>
  )
}
