import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { FALLBACK_GRAI_ASSETS, type GraiAsset, type GraiAssetIcon } from '../grai/knownMints'
import { FloatingTokenBackground, STABLE_FLOATING_TOKENS } from '../components/FloatingTokenBackground'
import { HowItWorksModal } from '../components/HowItWorksModal'
import { GraiGrindersSection } from '../components/grai/GraiGrindersSection'
import { GraiMintBurnPanel } from '../components/grai/GraiMintBurnPanel'
import { GraiAssetsSection } from '../components/grai/GraiAssetsSection'
import { GraiUiCaret } from '../components/grai/GraiUiCaret'
import { useGraiAssets } from '../hooks/useGraiAssets'
import { type GraiSection, isManageSectionHash } from '../utils/graiNavigation'
import './GraiPage.css'

const GraiTokenFlowDiagram = lazy(() =>
  import('../components/GraiTokenFlowDiagram').then((m) => ({ default: m.GraiTokenFlowDiagram })),
)

const HOVER_PREVIEW_MINT_STEP_IDS = ['mint', 'allocate', 'decision', 'swap', 'distribute', 'burn'] as const
const HOVER_PREVIEW_REDEEM_STEP_IDS = ['burn'] as const
const HOVER_PREVIEW_CLOSE_DELAY_MS = 666
const HOVER_PREVIEW_MIN_WIDTH = 1101
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

function GraiMintSubtitleText() {
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
    <span className="grai-page-subtitle-text-line">
      <span className="grai-page-subtitle-text-segment">Turn</span>
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
      <span className="grai-page-subtitle-text-segment">Price Volatility into Yield</span>
    </span>
  )
}

function GraiPage() {
  const { clusterMismatch, evmChainMismatch, solanaCluster, chainKind, evm, hasStaticConfig, isConfigured, protocolError } = useGraiDeployment()
  const [actionView, setActionView] = useState<'mint' | 'burn'>('mint')
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false)
  const [isFlowPreviewOpen, setIsFlowPreviewOpen] = useState(false)
  const [hasMountedFlowPreview, setHasMountedFlowPreview] = useState(false)
  const [isFlowPreviewAllowed, setIsFlowPreviewAllowed] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(`(min-width: ${HOVER_PREVIEW_MIN_WIDTH}px)`).matches : false,
  )
  const flowPreviewCloseTimerRef = useRef<number | null>(null)
  const flowPreviewStepIds =
    actionView === 'mint' ? [...HOVER_PREVIEW_MINT_STEP_IDS] : [...HOVER_PREVIEW_REDEEM_STEP_IDS]

  const [isManageSectionOpen, setIsManageSectionOpen] = useState(() =>
    isManageSectionHash(window.location.hash.slice(1)),
  )

  const clearFlowPreviewCloseTimer = useCallback(() => {
    if (flowPreviewCloseTimerRef.current == null) return
    window.clearTimeout(flowPreviewCloseTimerRef.current)
    flowPreviewCloseTimerRef.current = null
  }, [])

  const openFlowPreview = useCallback(() => {
    if (!isFlowPreviewAllowed) return
    clearFlowPreviewCloseTimer()
    setHasMountedFlowPreview(true)
    setIsFlowPreviewOpen(true)
  }, [clearFlowPreviewCloseTimer, isFlowPreviewAllowed])

  const scheduleCloseFlowPreview = useCallback(() => {
    clearFlowPreviewCloseTimer()
    flowPreviewCloseTimerRef.current = window.setTimeout(() => {
      setIsFlowPreviewOpen(false)
      flowPreviewCloseTimerRef.current = null
    }, HOVER_PREVIEW_CLOSE_DELAY_MS)
  }, [clearFlowPreviewCloseTimer])

  useEffect(() => {
    return () => clearFlowPreviewCloseTimer()
  }, [clearFlowPreviewCloseTimer])

  useEffect(() => {
    if (isHowItWorksOpen) setIsFlowPreviewOpen(false)
  }, [isHowItWorksOpen])

  useEffect(() => {
    const media = window.matchMedia(`(min-width: ${HOVER_PREVIEW_MIN_WIDTH}px)`)
    const sync = () => {
      const allowed = media.matches
      setIsFlowPreviewAllowed(allowed)
      if (!allowed) {
        clearFlowPreviewCloseTimer()
        setIsFlowPreviewOpen(false)
      }
    }
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [clearFlowPreviewCloseTimer])

  useEffect(() => {
    const applySection = (section: GraiSection) => {
      if (section === 'mint') setActionView('mint')
      else if (section === 'burn') setActionView('burn')
      setIsManageSectionOpen(section === 'allocate' || section === 'distribute')
    }

    const onSectionNav = (event: Event) => {
      applySection((event as CustomEvent<GraiSection>).detail)
    }

    const onHashChange = () => {
      const hash = window.location.hash.slice(1)
      setIsManageSectionOpen(isManageSectionHash(hash))
      if (hash === 'mint' || hash === 'burn' || hash === 'grinders' || hash === 'allocate' || hash === 'distribute' || hash === 'manage') {
        applySection(hash === 'manage' ? 'allocate' : hash)
      }
    }

    window.addEventListener('grai-section-nav', onSectionNav)
    window.addEventListener('hashchange', onHashChange)
    onHashChange()

    return () => {
      window.removeEventListener('grai-section-nav', onSectionNav)
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [])

  return (
    <div className="grai-page">
      {(clusterMismatch || evmChainMismatch || !isConfigured || protocolError) && (
        <div className="grai-page-meta">
          {clusterMismatch && (
            <p className="grai-page-network-warning" role="status">
              Switch your Solana wallet to {solanaCluster === 'mainnet-beta' ? 'Mainnet' : solanaCluster} to mint or redeem GRAI.
            </p>
          )}
          {evmChainMismatch && evm && (
            <p className="grai-page-network-warning" role="status">
              Switch your EVM wallet to {evm.chainName} to mint or redeem GRAI.
            </p>
          )}
          {!isConfigured && chainKind === null && (
            <p className="grai-page-network-warning" role="status">
              GRAI is not configured for this network. Set deployment env vars before using the app.
            </p>
          )}
          {!isConfigured && chainKind === 'evm' && (
            <p className="grai-page-network-warning" role="status">
              GRAI is not configured for this EVM network. Set VITE_GRAI_*_TOKEN and VITE_GRAI_*_PROTOCOL env vars.
            </p>
          )}
          {!isConfigured && chainKind === 'solana' && !hasStaticConfig && (
            <p className="grai-page-network-warning" role="status">
              GRAI is not configured for this Solana cluster. Set deployment env vars before using the app.
            </p>
          )}
          {protocolError && (
            <p className="grai-page-network-warning" role="status">
              {protocolError}
            </p>
          )}
        </div>
      )}

      <FloatingTokenBackground
        tokens={STABLE_FLOATING_TOKENS}
        className={`grai-content-row${isFlowPreviewOpen ? ' is-flow-preview-open' : ''}`}
      >
        {isFlowPreviewAllowed ? (
          <div
            className={`grai-flow-hover-preview${isFlowPreviewOpen ? ' is-open' : ''}`}
            aria-hidden={!isFlowPreviewOpen}
            onMouseEnter={openFlowPreview}
            onMouseLeave={scheduleCloseFlowPreview}
          >
            <button
              type="button"
              className="grai-flow-hover-preview-see-all"
              onClick={() => setIsHowItWorksOpen(true)}
              aria-haspopup="dialog"
            >
              See All
            </button>
            {hasMountedFlowPreview ? (
              <Suspense fallback={null}>
                <GraiTokenFlowDiagram
                  key={actionView}
                  stepIds={flowPreviewStepIds}
                  className="grai-token-flow--hover-preview"
                />
              </Suspense>
            ) : null}
          </div>
        ) : null}
        <div className="grai-actions-block" id="grai-actions-section">
          <div className="grai-page-subtitle-wrap">
            <button
              type="button"
              className="header-nav-link header-nav-info grai-page-how-it-works-hint"
              onClick={() => setIsHowItWorksOpen(true)}
              aria-haspopup="dialog"
            >
              <Info className="header-nav-info-icon" aria-hidden="true" />
              How it works?
            </button>
            <button
              type="button"
              className="grai-page-subtitle is-fit-width is-clickable"
              onClick={() => setIsHowItWorksOpen(true)}
              onMouseEnter={isFlowPreviewAllowed ? openFlowPreview : undefined}
              onFocus={isFlowPreviewAllowed ? openFlowPreview : undefined}
              onMouseLeave={isFlowPreviewAllowed ? scheduleCloseFlowPreview : undefined}
              onBlur={isFlowPreviewAllowed ? scheduleCloseFlowPreview : undefined}
              aria-haspopup="dialog"
              aria-expanded={isFlowPreviewAllowed ? isFlowPreviewOpen : undefined}
            >
              <span>
                {actionView === 'mint' ? <GraiMintSubtitleText /> : 'Redeem Anytime'}
              </span>
              {isFlowPreviewAllowed ? <GraiUiCaret className="grai-page-subtitle-caret" /> : null}
            </button>
          </div>
          <GraiMintBurnPanel actionView={actionView} onActionViewChange={setActionView} />
        </div>
      </FloatingTokenBackground>

      <div className="grai-bottom-row">
        <GraiGrindersSection />
      </div>

      <GraiAssetsSection isManageSectionOpen={isManageSectionOpen} />
      <HowItWorksModal isOpen={isHowItWorksOpen} onClose={() => setIsHowItWorksOpen(false)} />
    </div>
  )
}

export default GraiPage
