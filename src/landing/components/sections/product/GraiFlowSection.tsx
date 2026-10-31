import { useEffect, useState } from 'react'
import { APP_HOME } from '@landing/config'
import { Title } from '@landing/components/ui/Title'
import { Description } from '@landing/components/ui/Description'
import { Button } from '@landing/components/ui/Button'
import usdcSvg from '@landing/assets/token-usdc.svg'
import ethSvg from '@landing/assets/token-eth.svg'
import solSvg from '@landing/assets/token-sol.svg'
import btcSvg from '@landing/assets/token-btc.svg'
import grindurusLogo from '@landing/assets/logo.png'
import { grinderNftForPair } from '@landing/lib/grinderArt'

const TOKEN_ICONS: Record<string, string> = {
  USDC: usdcSvg,
  ETH: ethSvg,
  SOL: solSvg,
  BTC: btcSvg,
}

const CUSTODIAN_PAIRS = [
  { base: 'ETH', quote: 'USDC' },
  { base: 'SOL', quote: 'USDC' },
  { base: 'BTC', quote: 'USDC' },
  { base: 'ETH', quote: 'BTC' },
  { base: 'SOL', quote: 'ETH' },
] as const

const PAIR_ROTATE_MS = 2800

function ChartActionLabel({
  x,
  y,
  fill,
  action,
  symbol,
  align = 'center',
  viewWidth = 128,
}: {
  x: number
  y: number
  fill: string
  action: 'BUY' | 'SELL'
  symbol: string
  align?: 'start' | 'center' | 'end'
  viewWidth?: number
}) {
  const icon = TOKEN_ICONS[symbol] ?? usdcSvg
  const prefix = `${action} (+ `
  const suffix = ')'
  // monospace ~4.55 units per char at fontSize 7.5
  const charW = 4.55
  const iconSize = 9.5
  const gap = 1.8
  const pad = 2
  const prefixW = prefix.length * charW
  const symbolW = symbol.length * charW
  const suffixW = charW
  const total = prefixW + gap + iconSize + gap + symbolW + suffixW
  let start =
    align === 'end'
      ? viewWidth - pad - total
      : align === 'start'
        ? x
        : x - total / 2
  start = Math.max(pad, Math.min(start, viewWidth - pad - total))
  const iconX = start + prefixW + gap
  const symbolX = iconX + iconSize + gap

  return (
    <g>
      <text
        x={start}
        y={y}
        fill={fill}
        fontSize="7.5"
        fontFamily="monospace"
        fontWeight="700"
        textAnchor="start"
      >
        {prefix}
      </text>
      <image
        href={icon}
        x={iconX}
        y={y - iconSize + 1.6}
        width={iconSize}
        height={iconSize}
        preserveAspectRatio="xMidYMid meet"
      />
      <text
        x={symbolX}
        y={y}
        fill={fill}
        fontSize="7.5"
        fontFamily="monospace"
        fontWeight="700"
        textAnchor="start"
      >
        {`${symbol}${suffix}`}
      </text>
    </g>
  )
}

function ModeChart({
  mode,
  base,
  quote,
  id,
}: {
  mode: 'DIRECT' | 'INVERSE'
  base: string
  quote: string
  id: string
}) {
  const direct = mode === 'DIRECT'
  return (
    <div className="grai-flow__mode-chart-wrap">
      <span className="grai-flow__mode-chart-label">
        {direct ? 'buy low, sell high' : 'sell high, buy low'}
      </span>
      <svg
        className="grai-flow__mode-chart"
        viewBox="0 0 128 68"
        aria-label={direct ? 'Buy low, sell high' : 'Sell high, buy low'}
      >
        <title id={id}>{direct ? 'Buy low, sell high' : 'Sell high, buy low'}</title>
        <line
          x1="6"
          y1="34"
          x2="108"
          y2="34"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
        {direct ? (
          <>
            <path
              d="M 10 34 C 24 50, 32 50, 48 50 C 64 50, 78 18, 102 18"
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1.6"
              strokeDasharray="3 3"
            />
            <circle cx="48" cy="50" r="3.6" fill="#ff69b4" className="animate-pulse" />
            <circle
              cx="102"
              cy="18"
              r="3.6"
              fill="#fff"
              className="animate-pulse"
              style={{ animationDelay: '0.8s' }}
            />
            <ChartActionLabel x={48} y={64} fill="#ff69b4" action="BUY" symbol={base} />
            <ChartActionLabel x={102} y={12} fill="#fff" action="SELL" symbol={quote} align="end" />
          </>
        ) : (
          <>
            <path
              d="M 10 34 C 24 18, 32 18, 48 18 C 64 18, 78 50, 102 50"
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1.6"
              strokeDasharray="3 3"
            />
            <circle cx="48" cy="18" r="3.6" fill="#ff1493" className="animate-pulse" />
            <circle
              cx="102"
              cy="50"
              r="3.6"
              fill="#fff"
              className="animate-pulse"
              style={{ animationDelay: '0.8s' }}
            />
            <ChartActionLabel x={48} y={12} fill="#ff1493" action="SELL" symbol={quote} />
            <ChartActionLabel x={102} y={64} fill="#fff" action="BUY" symbol={base} align="end" />
          </>
        )}
      </svg>
      <span className="grai-flow__mode-chart-legend" aria-hidden>
        <span className="grai-flow__mode-chart-legend-swatch" />
        <span>price trajectory</span>
      </span>
    </div>
  )
}

const YIELD_PORTFOLIOS = [
  {
    id: 'pf1',
    yieldPct: 48,
    tokens: [usdcSvg, solSvg] as const,
    x: 22,
    y: 108,
  },
  {
    id: 'pf2',
    yieldPct: 53,
    tokens: [ethSvg, btcSvg] as const,
    x: 134,
    y: 108,
  },
  {
    id: 'pf3',
    yieldPct: 51,
    tokens: [usdcSvg, ethSvg, solSvg] as const,
    x: 78,
    y: 78,
  },
] as const

function MiniPortfolio({
  x,
  y,
  yieldPct,
  tokens,
  delay,
  claimIndex,
}: {
  x: number
  y: number
  yieldPct: number
  tokens: readonly string[]
  delay: string
  claimIndex: number
}) {
  const w = 48
  const h = 36
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="grai-flow__mini-pf" style={{ animationDelay: delay }}>
      <text
        x="0"
        y={-h / 2 - 5}
        textAnchor="middle"
        fill="#ff69b4"
        fontFamily="JetBrains Mono, ui-monospace, monospace"
        fontSize="5.5"
        fontWeight="700"
        letterSpacing="0.5"
      >
        {`Claim ${claimIndex}`}
      </text>
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx="4"
        fill="#0c0c0c"
        stroke="#ff69b4"
        strokeWidth="1.4"
      />
      <path
        d={`M${-w / 2} ${-h / 2 + 8} H${w / 2}`}
        stroke="rgba(255,105,180,0.35)"
        strokeWidth="1"
      />
      <text
        x="0"
        y={-6}
        textAnchor="middle"
        fill="#fff"
        fontFamily="JetBrains Mono, ui-monospace, monospace"
        fontSize="4.5"
        fontWeight="600"
        letterSpacing="0.4"
      >
        INDEXED YIELD
      </text>
      <text
        x="0"
        y={6}
        textAnchor="middle"
        fill="#ff69b4"
        fontFamily="JetBrains Mono, ui-monospace, monospace"
        fontSize="9"
        fontWeight="800"
      >
        {`+${yieldPct}%`}
      </text>
      {tokens.map((src, i) => {
        const n = tokens.length
        const gap = 9
        const start = -((n - 1) * gap) / 2
        const cx = start + i * gap
        return (
          <image
            key={`${src}-${i}`}
            href={src}
            x={cx - 4}
            y={10}
            width="8"
            height="8"
            preserveAspectRatio="xMidYMid meet"
          />
        )
      })}
      </g>
    </g>
  )
}

function YieldPerson() {
  return (
    <div className="grai-flow__depositor grai-flow__depositor--yield">
      <svg className="grai-flow__person" viewBox="0 0 156 168" aria-hidden>
        <defs>
          <linearGradient id="gf-hoodie-y" x1="54" y1="78" x2="102" y2="150" gradientUnits="userSpaceOnUse">
            <stop stopColor="#222" />
            <stop offset="1" stopColor="#0b0b0b" />
          </linearGradient>
          <linearGradient id="gf-hat-y" x1="58" y1="10" x2="98" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2c2c2c" />
            <stop offset="1" stopColor="#0c0c0c" />
          </linearGradient>
          <linearGradient id="gf-lock-y" x1="92" y1="128" x2="108" y2="148" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ff69b4" />
            <stop offset="1" stopColor="#ff1493" />
          </linearGradient>
          <clipPath id="gf-smile-y">
            <path d="M66 56c6 10 16 10 22 0Z" />
          </clipPath>
        </defs>

        <ellipse cx="78" cy="160" rx="40" ry="5" fill="#ff69b4" opacity="0.18" />

        <path
          d="M58 86h40v48c0 10-8 14-20 14s-20-4-20-14z"
          fill="url(#gf-hoodie-y)"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="1.2"
        />
        <path d="M78 88v46" stroke="rgba(255,105,180,0.4)" strokeWidth="1.2" strokeDasharray="2 3" />

        {/* arms holding locked GRAI */}
        <path
          d="M60 96 C48 108 42 122 48 132"
          fill="none"
          stroke="#ff1493"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M96 96 C108 108 114 122 108 132"
          fill="none"
          stroke="#ff1493"
          strokeWidth="2.4"
          strokeLinecap="round"
        />

        {/* locked GRAI disc */}
        <g className="grai-flow__locked-grai">
          <circle cx="78" cy="124" r="26" fill="#050505" stroke="rgba(255,255,255,0.2)" strokeWidth="2.2" />
          <circle cx="78" cy="124" r="20" fill="#0a0a0a" stroke="rgba(255,105,180,0.4)" strokeWidth="1.1" />
          <text
            x="78"
            y="128"
            textAnchor="middle"
            fill="#ff69b4"
            fontFamily="JetBrains Mono, ui-monospace, monospace"
            fontSize="9"
            fontWeight="700"
            letterSpacing="0.8"
          >
            GRAI
          </text>
          {/* padlock */}
          <g className="grai-flow__grai-lock">
            <path
              d="M96 132 V124 a5 5.5 0 0 1 10 0 V132"
              fill="none"
              stroke="#ff69b4"
              strokeWidth="2.2"
              strokeLinecap="butt"
            />
            <rect x="93" y="130" width="16" height="13" rx="3" fill="url(#gf-lock-y)" />
            <circle cx="101" cy="136" r="1.8" fill="#0a0a0a" />
            <path d="M101 138v3" stroke="#0a0a0a" strokeWidth="1.4" strokeLinecap="round" />
          </g>
        </g>

        <path
          d="M66 82 L78 94 L90 82"
          fill="#0c0c0c"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
        />
        <path
          d="M62 76 L50 98 L62 92 L70 84 Z"
          fill="#242424"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1.1"
        />
        <path
          d="M94 76 L106 98 L94 92 L86 84 Z"
          fill="#242424"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1.1"
        />

        <circle cx="78" cy="50" r="18" fill="#1c1c1c" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />

        <path
          d="M46 42 C46 30 62 24 70 34 C76 40 90 40 96 34 C104 24 120 30 120 42 C120 48 106 52 96 48 C90 46 76 46 70 48 C60 52 46 48 46 42Z"
          fill="#1a1a1a"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="1.1"
        />
        <path
          d="M64 38 L66 22 C68 14 74 12 78 18 C82 12 88 14 90 22 L92 38 C86 34 72 34 64 38Z"
          fill="url(#gf-hat-y)"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="1.1"
        />
        <path d="M63 36 C72 44 84 44 93 36 C84 42 72 42 63 36Z" fill="#ff69b4" />

        <path
          d="M78 52 L82 58 L74 58 Z"
          fill="#2a2a2a"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
        <path d="M66 56c6 10 16 10 22 0Z" fill="#050505" />
        <g clipPath="url(#gf-smile-y)">
          <rect x="66" y="56" width="22" height="3.2" fill="#fff" />
          <rect x="66" y="60" width="22" height="7" fill="#fff" />
        </g>

        {/* mini portfolios orbiting / arriving to the locked GRAI holder */}
        {YIELD_PORTFOLIOS.map((pf, i) => (
          <MiniPortfolio
            key={pf.id}
            x={pf.x}
            y={pf.y}
            yieldPct={pf.yieldPct}
            tokens={pf.tokens}
            delay={`${i * 0.45}s`}
            claimIndex={i + 1}
          />
        ))}
      </svg>
    </div>
  )
}

function TokenChip({
  src,
  symbol,
  size = 36,
  dark,
  bare,
}: {
  src: string
  symbol: string
  size?: number
  dark?: boolean
  /** no circular plate — just the icon */
  bare?: boolean
}) {
  return (
    <span
      className={`grai-flow__chip${dark ? ' grai-flow__chip--dark' : ''}${bare ? ' grai-flow__chip--bare' : ''}`}
      style={{ width: size, height: size }}
      title={symbol}
    >
      <img src={src} alt="" draggable={false} />
    </span>
  )
}

function Wallet({
  x,
  y,
  flip,
  tokens,
}: {
  x: number
  y: number
  flip?: boolean
  tokens: readonly string[]
}) {
  const iconSize = 8
  const gap = 9
  const n = tokens.length
  const start = -((n - 1) * gap) / 2

  return (
    <g transform={`translate(${x} ${y})${flip ? ' scale(-1 1)' : ''}`}>
      {/* body */}
      <rect
        x="-16"
        y="-10"
        width="32"
        height="22"
        rx="3"
        fill="#1a1210"
        stroke="#ff69b4"
        strokeWidth="1.5"
      />
      {/* flap */}
      <path
        d="M-16 -4 H16 V-10 Q16 -12 13 -12 H-13 Q-16 -12 -16 -10 Z"
        fill="#2a1c18"
        stroke="#ff69b4"
        strokeWidth="1.2"
      />
      {/* clasp */}
      <circle cx="0" cy="-4" r="2.2" fill="#ff1493" stroke="#fff" strokeWidth="0.6" opacity="0.95" />
      {/* token icons inside wallet — unflip so logos stay readable */}
      <g transform={flip ? 'scale(-1 1)' : undefined}>
        {tokens.map((src, i) => {
          const cx = start + i * gap
          return (
            <image
              key={`${src}-${i}`}
              href={src}
              x={cx - iconSize / 2}
              y={2}
              width={iconSize}
              height={iconSize}
              preserveAspectRatio="xMidYMid meet"
            />
          )
        })}
      </g>
    </g>
  )
}

function DepositPerson() {
  return (
    <div className="grai-flow__depositor">
      <svg className="grai-flow__person" viewBox="0 0 156 168" aria-hidden>
        <defs>
          <linearGradient id="gf-hoodie" x1="54" y1="78" x2="102" y2="150" gradientUnits="userSpaceOnUse">
            <stop stopColor="#222" />
            <stop offset="1" stopColor="#0b0b0b" />
          </linearGradient>
          <linearGradient id="gf-hat" x1="58" y1="10" x2="98" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2c2c2c" />
            <stop offset="1" stopColor="#0c0c0c" />
          </linearGradient>
          <clipPath id="gf-smile">
            <path d="M66 56c6 10 16 10 22 0Z" />
          </clipPath>
        </defs>

        <ellipse cx="78" cy="160" rx="40" ry="5" fill="#ff69b4" opacity="0.18" />

        {/* hoodie torso */}
        <path
          d="M58 86h40v48c0 10-8 14-20 14s-20-4-20-14z"
          fill="url(#gf-hoodie)"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="1.2"
        />
        <path d="M78 88v46" stroke="rgba(255,105,180,0.4)" strokeWidth="1.2" strokeDasharray="2 3" />

        {/* arms reaching to wallets */}
        <path
          d="M60 96 C44 102 34 114 32 126"
          fill="none"
          stroke="#ff1493"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M96 96 C112 102 122 114 124 126"
          fill="none"
          stroke="#ff1493"
          strokeWidth="2.4"
          strokeLinecap="round"
        />

        {/* wallets in each hand */}
        <g className="grai-flow__held">
          <Wallet x={32} y={124} tokens={[usdcSvg, solSvg]} />
        </g>
        <g className="grai-flow__held" style={{ animationDelay: '0.4s' }}>
          <Wallet x={124} y={124} flip tokens={[ethSvg, btcSvg]} />
        </g>

        {/* hood */}
        <path
          d="M66 82 L78 94 L90 82"
          fill="#0c0c0c"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
        />
        <path
          d="M62 76 L50 98 L62 92 L70 84 Z"
          fill="#242424"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1.1"
        />
        <path
          d="M94 76 L106 98 L94 92 L86 84 Z"
          fill="#242424"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1.1"
        />

        {/* head */}
        <circle cx="78" cy="50" r="18" fill="#1c1c1c" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />

        {/* hat */}
        <path
          d="M46 42 C46 30 62 24 70 34 C76 40 90 40 96 34 C104 24 120 30 120 42 C120 48 106 52 96 48 C90 46 76 46 70 48 C60 52 46 48 46 42Z"
          fill="#1a1a1a"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="1.1"
        />
        <path
          d="M64 38 L66 22 C68 14 74 12 78 18 C82 12 88 14 90 22 L92 38 C86 34 72 34 64 38Z"
          fill="url(#gf-hat)"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="1.1"
        />
        <path d="M63 36 C72 44 84 44 93 36 C84 42 72 42 63 36Z" fill="#ff69b4" />

        {/* face */}
        <path
          d="M78 52 L82 58 L74 58 Z"
          fill="#2a2a2a"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
        <path d="M66 56c6 10 16 10 22 0Z" fill="#050505" />
        <g clipPath="url(#gf-smile)">
          <rect x="66" y="56" width="22" height="3.2" fill="#fff" />
          <rect x="66" y="60" width="22" height="7" fill="#fff" />
        </g>
      </svg>
    </div>
  )
}

function FlowArrow({ label, reverse }: { label: string; reverse?: boolean }) {
  return (
    <div className={`grai-flow__arrow${reverse ? ' grai-flow__arrow--reverse' : ''}`} aria-hidden>
      {!reverse ? (
        <>
          <span className="grai-flow__arrow-line" />
          <span className="grai-flow__arrow-label">{label}</span>
          <span className="grai-flow__arrow-head" />
        </>
      ) : (
        <>
          <span className="grai-flow__arrow-head grai-flow__arrow-head--up" />
          <span className="grai-flow__arrow-label">{label}</span>
          <span className="grai-flow__arrow-line" />
        </>
      )}
    </div>
  )
}

function DepositMintBridge() {
  return (
    <div className="grai-flow__bridge" aria-label="Deposit assets, mint GRAI">
      <FlowArrow label="1. Deposit Assets" />
      <FlowArrow label="2. Receive GRAI" reverse />
    </div>
  )
}

function CustodianMain({
  base,
  quote,
  rotating,
  salt = 0,
  id,
}: {
  base: string
  quote: string
  rotating?: boolean
  salt?: number
  id: number
}) {
  const nftSrc = grinderNftForPair(base, quote, salt)
  // Symbolic balances (x / y / z) + demo yield % (stable per id / pair)
  const amtLetter = (['x', 'y', 'z'] as const)[(id + salt) % 3]
  const quoteLetter = (['x', 'y', 'z'] as const)[(id + salt + 1) % 3]
  const baseYieldPct = 8 + ((id * 37 + salt * 11) % 28)
  const quoteYieldPct = 10 + ((id * 53 + salt * 17) % 32)

  return (
    <div className="grai-flow__custodian-main">
      <div className="grai-flow__custodian-head">
        <TokenChip src={nftSrc} symbol={`#${id} custodian`} size={34} dark />
        <span className="grai-flow__custodian-id">#{id} custodian</span>
      </div>
      <span
        className={`grai-flow__custodian-pair${rotating ? ' grai-flow__custodian-pair--rotating' : ''}`}
      >
        <span className="grai-flow__custodian-row" key={`b-${base}`}>
          <span className="grai-flow__custodian-token">
            <span className="grai-flow__custodian-amt">{amtLetter}</span>
            <TokenChip src={TOKEN_ICONS[base]!} symbol={base} size={22} bare />
            <span>{base}</span>
          </span>
          <span className="grai-flow__custodian-bal grai-flow__custodian-bal--yield tabular-nums">
            +{baseYieldPct}%<span className="grai-flow__custodian-bal-word"> yield</span>
          </span>
        </span>
        <span className="grai-flow__custodian-row" key={`q-${quote}`}>
          <span className="grai-flow__custodian-token">
            <span className="grai-flow__custodian-amt">{quoteLetter}</span>
            <TokenChip src={TOKEN_ICONS[quote]!} symbol={quote} size={22} bare />
            <span>{quote}</span>
          </span>
          <span className="grai-flow__custodian-bal grai-flow__custodian-bal--yield tabular-nums">
            +{quoteYieldPct}%<span className="grai-flow__custodian-bal-word"> yield</span>
          </span>
        </span>
      </span>
    </div>
  )
}

/**
 * Single landing block: deposit → GRAI → Grinders → Custodians (offchain grinders) → yield → GRAI.
 * Mirrors grindurus-evm: GRAI.deposit → Grinders reserve → allocate → Custodian → distribute → GRAI.
 */
export function GraiFlowSection() {
  const [pairIdx, setPairIdx] = useState(0)
  const n = CUSTODIAN_PAIRS.length
  const pair = CUSTODIAN_PAIRS[pairIdx]!
  const sidePairs = [1, 2, 3].map((offset) => CUSTODIAN_PAIRS[(pairIdx + offset) % n]!)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => {
      setPairIdx((i) => (i + 1) % CUSTODIAN_PAIRS.length)
    }, PAIR_ROTATE_MS)
    return () => window.clearInterval(id)
  }, [])

  return (
    <section className="landing-grai-flow relative w-full pt-10 pb-10 md:pt-14 md:pb-16 lg:pt-16 lg:pb-20 bg-black overflow-x-hidden">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-10 md:mb-14">
          <Title className="!mb-4">
            <span className="text-brand-pink">GRAI</span>
            <span className="block text-[0.55em] font-semibold tracking-[0.04em] text-white mt-3 normal-case">
              <span className="text-brand-pink">GR</span>inders{' '}
              <span className="text-brand-pink">A</span>rtificial{' '}
              <span className="text-brand-pink">I</span>ndex
            </span>
          </Title>
          <Description className="text-white/65">
            Earn Passively Indexed Yield from Price Volatility
          </Description>
        </div>

        <div className="grai-flow" aria-label="GRAI capital and yield flow">
          {/* 1. Deposit assets — cowboy holding tokens */}
          <div className="grai-flow__stage grai-flow__stage--assets">
            <DepositPerson />
          </div>

          <DepositMintBridge />

          {/* 2. GRAI hub */}
          <div className="grai-flow__stage grai-flow__stage--hub">
            <div className="grai-flow__node grai-flow__node--grai">
              <span className="grai-flow__node-kicker">Fund share</span>
              <span className="grai-flow__node-title">
                <TokenChip src={grindurusLogo} symbol="GRAI" size={36} dark />
                GRAI
              </span>
            </div>
          </div>

          <FlowArrow label="3. Assets" />

          {/* 3. Grinders + Custodians (one vault block) */}
          <div className="grai-flow__stage grai-flow__stage--vault">
            <div className="grai-flow__vault">
              <span className="grai-flow__vault-title">Infrastructure</span>
              <div className="grai-flow__custodians">
                <div className="grai-flow__custodian" key={`feat-${pair.base}-${pair.quote}`}>
                  <div className="grai-flow__custodian-side" aria-label="Onchain Custodians">
                    <span className="grai-flow__custodian-side-title">
                      <span>Onchain</span>
                      <span>Custodians</span>
                    </span>
                    {sidePairs.map((p, i) => (
                      <div
                        className="grai-flow__custodian grai-flow__custodian--main-only"
                        key={`side-${p.base}-${p.quote}`}
                      >
                        <CustodianMain
                          base={p.base}
                          quote={p.quote}
                          rotating
                          salt={pairIdx + i + 1}
                          id={pairIdx + i + 1}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="grai-flow__mode-charts">
                    <span className="grai-flow__mode-charts-title">
                      <span>Offchain</span>
                      <span>Grinders</span>
                    </span>
                    <div className="grai-flow__mode-charts-frame">
                      <ModeChart
                        id={`cust-${pair.base}-${pair.quote}-direct`}
                        mode="DIRECT"
                        base={pair.base}
                        quote={pair.quote}
                      />
                      <ModeChart
                        id={`cust-${pair.base}-${pair.quote}-inverse`}
                        mode="INVERSE"
                        base={pair.base}
                        quote={pair.quote}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <FlowArrow label="4. Yield" />

          {/* 5. Yield — cowboy receives mini indexed-yield portfolios */}
          <div className="grai-flow__stage grai-flow__stage--yield">
            <YieldPerson />
          </div>
        </div>

        <div className="mt-10 md:mt-12 flex justify-center">
          <Button href={APP_HOME} size="md">
            Explore GRAI
          </Button>
        </div>
      </div>
    </section>
  )
}
