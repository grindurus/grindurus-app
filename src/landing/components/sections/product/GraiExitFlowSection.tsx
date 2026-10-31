import { useEffect, useState, type ReactNode } from 'react'
import { APP_EXIT_LIQUIDATION, APP_EXIT_SWAP, APP_EXIT_VOTE } from '@landing/config'
import { Title } from '@landing/components/ui/Title'
import { Description } from '@landing/components/ui/Description'
import { Button } from '@landing/components/ui/Button'
import grindurusLogo from '@landing/assets/logo.png'
import usdcSvg from '@landing/assets/token-usdc.svg'
import ethSvg from '@landing/assets/token-eth.svg'
import solSvg from '@landing/assets/token-sol.svg'
import btcSvg from '@landing/assets/token-btc.svg'

const EXIT_ASSETS = [
  { symbol: 'BTC', src: btcSvg },
  { symbol: 'ETH', src: ethSvg },
  { symbol: 'SOL', src: solSvg },
  { symbol: 'USDC', src: usdcSvg },
] as const

const EXIT_ASSET_ROTATE_MS = 2200

const EXIT_PATHS: {
  id: string
  step: string
  title: string
  kicker: string
  body: ReactNode
  icon: ReactNode
  ctaLabel: string
  ctaHref: string
}[] = [
  {
    id: 'vote-bribe',
    step: '1',
    title: 'Vote & Bribe',
    kicker: 'Bribe market',
    body: 'Vote your GRAI toward liquidation quorum. A briber may show up and pay you to steer that vote.',
    ctaLabel: 'Open Bribe Market',
    ctaHref: APP_EXIT_VOTE,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m9 12 2 2 4-4" />
        <path d="M5 7h14v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7z" />
        <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      </svg>
    ),
  },
  {
    id: 'liquidation',
    step: '2',
    title: 'Fund Liquidation',
    kicker: 'Protocol exit',
    body: (
      <>
        <span className="grai-exit__path-lead">Redeem opens only when both hold:</span>
        <ol className="grai-exit__path-list">
          <li>Voted GRAI clears quorum</li>
          <li>Grinders idle for the period</li>
        </ol>
      </>
    ),
    ctaLabel: 'Open Liquidation',
    ctaHref: APP_EXIT_LIQUIDATION,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      </svg>
    ),
  },
  {
    id: 'dex-swap',
    step: '3',
    title: 'DEX Swap',
    kicker: 'Market exit',
    body: 'Swap GRAI through a liquidity pool — routed with hops across DEX markets for the assets you want.',
    ctaLabel: 'Open Swap',
    ctaHref: APP_EXIT_SWAP,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M16 3h5v5" />
        <path d="M8 21H3v-5" />
        <path d="M21 3 14 10" />
        <path d="m3 21 7-7" />
      </svg>
    ),
  },
]

function TokenChip({
  src,
  symbol,
  size,
  dark,
}: {
  src: string
  symbol: string
  size: number
  dark?: boolean
}) {
  return (
    <span
      className={`grai-flow__chip${dark ? ' grai-flow__chip--dark' : ''}`}
      style={{ width: size, height: size }}
      title={symbol}
    >
      <img src={src} alt="" width={size} height={size} />
    </span>
  )
}

function ExitArrow({ label }: { label: string }) {
  return (
    <div className="grai-exit__arrow" aria-hidden>
      <span className="grai-exit__arrow-line" />
      <span className="grai-exit__arrow-label">{label}</span>
      <span className="grai-exit__arrow-head" />
    </div>
  )
}

/** Centers of 3 equal columns in a 0–100 viewBox (matches CSS grid 1fr×3). */
const COL = [16.666, 50, 83.333] as const

function BranchSplit() {
  return (
    <svg className="grai-exit__branch" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden>
      <path
        d={`M50 0 V8 H${COL[0]} V28 M50 8 H${COL[2]} V28 M50 8 V28`}
        fill="none"
        stroke="rgba(255, 105, 180, 0.75)"
        strokeWidth="1.1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function BranchMerge() {
  return (
    <svg className="grai-exit__branch" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden>
      <path
        d={`M${COL[0]} 0 V20 H50 V28 M${COL[1]} 0 V20 M${COL[2]} 0 V20 H50`}
        fill="none"
        stroke="rgba(255, 105, 180, 0.75)"
        strokeWidth="1.1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function RotatingExitAsset() {
  const [idx, setIdx] = useState(0)
  const asset = EXIT_ASSETS[idx]!

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % EXIT_ASSETS.length)
    }, EXIT_ASSET_ROTATE_MS)
    return () => window.clearInterval(id)
  }, [])

  return (
    <span className="grai-exit__asset-row" aria-live="polite">
      <span key={asset.symbol} className="grai-exit__asset-chip">
        <TokenChip src={asset.src} symbol={asset.symbol} size={28} />
        <span className="grai-exit__asset-ticker">{asset.symbol}</span>
      </span>
    </span>
  )
}

/**
 * Landing diagram: GRAI → three exit routes (vote/bribe, liquidation, DEX swap) → assets.
 * Visual language mirrors GraiFlowSection (nodes, pink arrows, mono type).
 */
export function GraiExitFlowSection() {
  return (
    <section className="landing-grai-exit relative w-full pt-10 pb-10 md:pt-14 md:pb-16 lg:pt-16 lg:pb-20 bg-black overflow-x-hidden">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-10 md:mb-14">
          <Title className="!mb-4">
            Exit <span className="text-brand-pink">GRAI</span>
          </Title>
          <Description className="text-white/65">
            Three ways out of the GRAI — vote &amp; bribe, fund liquidation, or a DEX swap.
          </Description>
        </div>

        <div className="grai-exit" aria-label="GRAI exit paths">
          <div className="grai-flow__stage">
            <div className="grai-flow__node grai-flow__node--grai grai-exit__hub">
              <span className="grai-flow__node-kicker">Your position</span>
              <span className="grai-flow__node-title">
                <TokenChip src={grindurusLogo} symbol="GRAI" size={36} dark />
                GRAI
              </span>
            </div>
          </div>

          <ExitArrow label="Choose an exit" />
          <BranchSplit />

          <div className="grai-exit__fork" role="list">
            {EXIT_PATHS.map((path) => (
              <article key={path.id} className="grai-exit__path" role="listitem">
                <div className="grai-exit__path-card">
                  <span className="grai-exit__path-icon" aria-hidden>
                    {path.icon}
                  </span>
                  <span className="grai-exit__path-step">{path.step}</span>
                  <span className="grai-flow__node-kicker">{path.kicker}</span>
                  <h3 className="grai-exit__path-title">{path.title}</h3>
                  <div className="grai-exit__path-body">{path.body}</div>
                  <Button href={path.ctaHref} size="sm" className="grai-exit__path-cta">
                    {path.ctaLabel}
                  </Button>
                </div>
              </article>
            ))}
          </div>

          <BranchMerge />
          <ExitArrow label="Assets out" />

          <div className="grai-flow__stage">
            <div className="grai-flow__node grai-exit__assets">
              <span className="grai-flow__node-kicker">Back to wallet</span>
              <RotatingExitAsset />
              <span className="grai-flow__node-sub">Underlying tokens back to your wallet</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
