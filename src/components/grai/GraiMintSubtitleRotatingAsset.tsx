import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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

export function GraiMintSubtitleRotatingAsset() {
  const { assets } = useGraiAssets()
  const rotateEntries = useMemo(() => {
    const source = assets.length > 0 ? assets : FALLBACK_GRAI_ASSETS
    return buildMintSubtitleRotateEntries(source)
  }, [assets])
  const [entryIndex, setEntryIndex] = useState(0)
  const currentEntry = rotateEntries[entryIndex] ?? { label: 'Assets' }
  const innerRef = useRef<HTMLSpanElement>(null)
  const [slotWidth, setSlotWidth] = useState<number | null>(null)
  const [isWidthTransitionReady, setIsWidthTransitionReady] = useState(false)

  const measureSlotWidth = useCallback(() => {
    const el = innerRef.current
    if (!el) return
    setSlotWidth(el.scrollWidth)
  }, [])

  useLayoutEffect(() => {
    measureSlotWidth()
  }, [currentEntry.label, currentEntry.icon?.src, measureSlotWidth])

  useLayoutEffect(() => {
    if (slotWidth === null) return
    const frame = window.requestAnimationFrame(() => {
      setIsWidthTransitionReady(true)
    })
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
    <span
      className={`grai-page-subtitle-rotating-slot${isWidthTransitionReady ? ' is-width-ready' : ''}`}
      style={slotWidth === null ? undefined : { width: `${slotWidth}px` }}
      aria-live="polite"
    >
      <span
        key={currentEntry.label}
        ref={innerRef}
        className="grai-page-subtitle-rotating-word-current"
      >
        {currentEntry.icon ? (
          <span className="grai-page-subtitle-rotating-word-icon" aria-hidden="true">
            <img
              src={currentEntry.icon.src}
              alt=""
              loading="lazy"
              decoding="async"
              onLoad={measureSlotWidth}
            />
          </span>
        ) : null}
        <span className="grai-page-subtitle-rotating-word-label">{currentEntry.label}</span>
      </span>
    </span>
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

export function GraiMintSubtitleText() {
  return (
    <span className="grai-page-subtitle-text-line">
      <span className="grai-page-subtitle-text-segment">Turn</span>
      <GraiMintSubtitleRotatingAsset />
      <span className="grai-page-subtitle-text-segment">Price Volatility into Yields</span>
    </span>
  )
}
