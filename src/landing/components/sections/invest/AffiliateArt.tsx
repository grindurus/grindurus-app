import { useEffect, useId, useState } from 'react'

type Point = readonly [number, number]

type Branch = {
  p0: Point
  p1: Point
  p2: Point
  p3: Point
  primary?: boolean
}

const BRANCHES: Branch[] = [
  { p0: [210, 172], p1: [210, 172], p2: [92, 200], p3: [78, 248], primary: true },
  { p0: [210, 172], p1: [210, 172], p2: [210, 210], p3: [210, 252], primary: true },
  { p0: [210, 172], p1: [210, 172], p2: [328, 200], p3: [342, 248], primary: true },
  { p0: [78, 248], p1: [60, 278], p2: [48, 300], p3: [40, 318] },
  { p0: [78, 248], p1: [102, 282], p2: [118, 304], p3: [128, 322] },
  { p0: [210, 252], p1: [188, 288], p2: [176, 308], p3: [168, 326] },
  { p0: [210, 252], p1: [232, 288], p2: [246, 308], p3: [254, 326] },
  { p0: [342, 248], p1: [318, 282], p2: [302, 304], p3: [292, 322] },
  { p0: [342, 248], p1: [360, 278], p2: [372, 300], p3: [380, 318] },
]

function cubicPoint(branch: Branch, t: number) {
  const { p0, p1, p2, p3 } = branch
  const u = 1 - t
  const x = u ** 3 * p0[0] + 3 * u ** 2 * t * p1[0] + 3 * u * t ** 2 * p2[0] + t ** 3 * p3[0]
  const y = u ** 3 * p0[1] + 3 * u ** 2 * t * p1[1] + 3 * u * t ** 2 * p2[1] + t ** 3 * p3[1]
  const dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0])
  const dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1])
  return { x, y, rotate: (Math.atan2(-dx, dy) * 180) / Math.PI }
}

function branchPath(branch: Branch) {
  return `M${branch.p0[0]} ${branch.p0[1]} C${branch.p1[0]} ${branch.p1[1]} ${branch.p2[0]} ${branch.p2[1]} ${branch.p3[0]} ${branch.p3[1]}`
}

const HEX = '0123456789ABCDEF'
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const ADDRESS_TICK_MS = 80
const ADDRESS_ROLL_MS = 1_000
const ADDRESS_HOLD_MS = 2_000
const ADDRESS_CYCLE_MS = ADDRESS_ROLL_MS + ADDRESS_HOLD_MS
const STATIC_ADDRESS = '0x8F3C…E5b847'
const STATIC_STATS = { own: 1.2e6, l1: 4.8e6, l2: 12.4e6 } as const

type AffStats = { own: number; l1: number; l2: number }

function formatAffUsd(n: number) {
  if (n < 0.005) return '$0'
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return m >= 10 ? `$${Math.round(m)}M` : `$${m.toFixed(1)}M`
  }
  if (n >= 1_000) {
    const k = n / 1_000
    return k >= 10 ? `$${Math.round(k)}K` : `$${k.toFixed(1)}K`
  }
  if (n < 10) return `$${n.toFixed(2)}`
  return `$${Math.round(n)}`
}

function seedStats(): AffStats {
  return {
    own: 0.4e6 + Math.random() * 4.6e6,
    l1: 1.5e6 + Math.random() * 14e6,
    l2: 4e6 + Math.random() * 36e6,
  }
}

function pickChars(alphabet: string, count: number) {
  let out = ''
  for (let i = 0; i < count; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

function seedAddress(solana: boolean) {
  if (solana) return `${pickChars(BASE58, 4)}…${pickChars(BASE58, 6)}`
  return `0x${pickChars(HEX, 4)}…${pickChars(HEX, 6)}`
}

function nextIn(ch: string, alphabet: string) {
  const i = alphabet.indexOf(ch)
  if (i < 0) return alphabet[0]!
  return alphabet[(i + 1) % alphabet.length]!
}

function rollAddress(value: string, tick: number, solana: boolean) {
  const alphabet = solana ? BASE58 : HEX
  const prefix = solana ? 0 : 2
  let slot = 0
  return [...value]
    .map((ch, i) => {
      if (i < prefix || ch === '…') return ch
      slot += 1
      return tick % (1 + (slot % 3)) === 0 ? nextIn(ch, alphabet) : ch
    })
    .join('')
}

function smoothstep(t: number) {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

function UpArrow({
  x,
  y,
  rotate = 0,
  opacity = 0.95,
}: {
  x: number
  y: number
  rotate?: number
  opacity?: number
}) {
  return (
    <path
      d="M-6 5 L0 -6 L6 5"
      transform={`translate(${x} ${y}) rotate(${rotate})`}
      fill="none"
      stroke="#ff69b4"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
    />
  )
}

export function AffiliateArt() {
  // Two instances mount (mobile + desktop); duplicate paint-server ids make
  // desktop `url(#aff-line)` resolve to the hidden copy and drop primary strokes.
  const uid = useId().replace(/:/g, '')
  const idWallet = `aff-wallet-${uid}`
  const idLine = `aff-line-${uid}`
  const idNode = `aff-node-${uid}`
  const idGlow = `aff-glow-${uid}`

  const [fromAddress, setFromAddress] = useState(STATIC_ADDRESS)
  const [toAddress, setToAddress] = useState(STATIC_ADDRESS)
  const [fromStats, setFromStats] = useState<AffStats>({ ...STATIC_STATS })
  const [toStats, setToStats] = useState<AffStats>({ ...STATIC_STATS })
  const [fromOpacity, setFromOpacity] = useState(0)
  const [toOpacity, setToOpacity] = useState(1)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let tick = 0
    let cycle = 0
    let solana = false
    let wasRolling = false
    let lastTickAt = 0
    let from = { value: STATIC_ADDRESS, solana: false, stats: { ...STATIC_STATS } as AffStats }
    let to = { value: STATIC_ADDRESS, solana: false, stats: { ...STATIC_STATS } as AffStats }
    const started = performance.now()
    let frameId = 0

    const frame = (now: number) => {
      const rolling = (now - started) % ADDRESS_CYCLE_MS < ADDRESS_ROLL_MS
      if (rolling && !wasRolling) {
        cycle += 1
        tick = 0
        from = { ...to }
        solana = cycle % 3 === 0
        to = { value: seedAddress(solana), solana, stats: seedStats() }
      }
      wasRolling = rolling

      if (rolling && now - lastTickAt >= ADDRESS_TICK_MS) {
        lastTickAt = now
        tick += 1
        from = { ...from, value: rollAddress(from.value, tick, from.solana) }
        to = { ...to, value: rollAddress(to.value, tick, to.solana) }
      }

      const phase = (now - started) % ADDRESS_CYCLE_MS
      const mix = rolling ? smoothstep(phase / ADDRESS_ROLL_MS) : 1
      setFromAddress(from.value)
      setToAddress(to.value)
      setFromStats(from.stats)
      setToStats(to.stats)
      setFromOpacity(rolling ? 1 - mix : 0)
      setToOpacity(rolling ? mix : 1)

      frameId = window.requestAnimationFrame(frame)
    }

    frameId = window.requestAnimationFrame(frame)
    return () => window.cancelAnimationFrame(frameId)
  }, [])

  return (
    <div className="relative flex h-full min-h-[400px] sm:min-h-[340px] w-full items-center justify-center">
      <div
        className="pointer-events-none absolute inset-[8%] sm:inset-[12%] rounded-full bg-brand-pink/20 blur-[70px]"
        aria-hidden
      />
      <svg
        viewBox="0 0 420 360"
        className="relative z-[1] h-auto w-full max-w-[560px] md:max-w-[440px] overflow-visible origin-center scale-[1.12] sm:scale-100"
        role="img"
        aria-label="Affiliate tree growing from a T-GRAI Treasury Note"
      >
        <defs>
          <linearGradient id={idWallet} x1="70" y1="40" x2="350" y2="160" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1a1a1a" />
            <stop offset="1" stopColor="#0a0a0a" />
          </linearGradient>
          <linearGradient id={idLine} x1="210" y1="150" x2="210" y2="320" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ff69b4" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ff69b4" stopOpacity="0.15" />
          </linearGradient>
          <radialGradient id={idNode} cx="50%" cy="50%" r="50%">
            <stop stopColor="#ff9ed3" />
            <stop offset="0.45" stopColor="#ff69b4" />
            <stop offset="1" stopColor="#ff1493" />
          </radialGradient>
          <filter id={idGlow} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {BRANCHES.map((branch) => (
          <path
            key={branchPath(branch)}
            d={branchPath(branch)}
            fill="none"
            stroke={branch.primary ? `url(#${idLine})` : '#ff69b4'}
            strokeOpacity={branch.primary ? undefined : 0.35}
            strokeWidth={branch.primary ? 1.6 : 1.2}
          />
        ))}

        <g fill="none" aria-hidden>
          {BRANCHES.map((branch) => {
            const arrow = cubicPoint(branch, 0.52)
            return (
              <UpArrow
                key={`${arrow.x}-${arrow.y}`}
                x={arrow.x}
                y={arrow.y}
                rotate={arrow.rotate}
                opacity={branch.primary ? 0.95 : 0.7}
              />
            )
          })}
        </g>

        <g filter={`url(#${idGlow})`} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
          <rect
            x="58"
            y="20"
            width="304"
            height="150"
            rx="24"
            fill={`url(#${idWallet})`}
            stroke="#ff69b4"
            strokeOpacity="0.55"
            strokeWidth="1.5"
          />
          {/* T-GRAI card face — mirrors affiliates graph node (brand + OWN / L1 / L2) */}
          <text
            x="80"
            y="50"
            fill="#ff69b4"
            fontSize="16"
            fontWeight="800"
            letterSpacing="0.12em"
          >
            T-GRAI
          </text>
          <text
            x="80"
            y="68"
            fill="#fff"
            fillOpacity="0.55"
            fontSize="9.5"
            fontWeight="600"
            letterSpacing="0.02em"
          >
            Treasury Note of Grinders Artificial Index
          </text>
          <text x="80" y="96" fill="#fff" fillOpacity="0.45" fontSize="11" fontWeight="600" letterSpacing="0.06em">
            OWN
          </text>
          <text x="80" y="116" fill="#fff" fillOpacity={fromOpacity} fontSize="15" fontWeight="700">
            {formatAffUsd(fromStats.own)}
          </text>
          <text x="80" y="116" fill="#fff" fillOpacity={toOpacity} fontSize="15" fontWeight="700">
            {formatAffUsd(toStats.own)}
          </text>
          <text x="170" y="96" fill="#fff" fillOpacity="0.45" fontSize="11" fontWeight="600" letterSpacing="0.06em">
            L1
          </text>
          <text x="170" y="116" fill="#fff" fillOpacity={fromOpacity} fontSize="15" fontWeight="700">
            {formatAffUsd(fromStats.l1)}
          </text>
          <text x="170" y="116" fill="#fff" fillOpacity={toOpacity} fontSize="15" fontWeight="700">
            {formatAffUsd(toStats.l1)}
          </text>
          <text x="250" y="96" fill="#fff" fillOpacity="0.45" fontSize="11" fontWeight="600" letterSpacing="0.06em">
            L2
          </text>
          <text x="250" y="116" fill="#fff" fillOpacity={fromOpacity} fontSize="15" fontWeight="700">
            {formatAffUsd(fromStats.l2)}
          </text>
          <text x="250" y="116" fill="#fff" fillOpacity={toOpacity} fontSize="15" fontWeight="700">
            {formatAffUsd(toStats.l2)}
          </text>
          <line x1="80" y1="130" x2="340" y2="130" stroke="#ff69b4" strokeOpacity="0.28" />
          <text
            x="210"
            y="152"
            textAnchor="middle"
            fill="#fff"
            fillOpacity={fromOpacity}
            fontSize="14"
            fontWeight="700"
            letterSpacing="0.08em"
          >
            {fromAddress}
          </text>
          <text
            x="210"
            y="152"
            textAnchor="middle"
            fill="#fff"
            fillOpacity={toOpacity}
            fontSize="14"
            fontWeight="700"
            letterSpacing="0.08em"
          >
            {toAddress}
          </text>
        </g>

        <g
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fill="#ff69b4"
          fontSize="11"
          fontWeight="700"
          letterSpacing="0.08em"
          aria-hidden
        >
          <text x="10" y="254" textAnchor="start" fillOpacity="0.85">
            L1
          </text>
          <text x="10" y="324" textAnchor="start" fillOpacity="0.7">
            L2
          </text>
        </g>

        <g filter={`url(#${idGlow})`}>
          <circle cx="78" cy="248" r="11" fill={`url(#${idNode})`} />
          <circle cx="210" cy="252" r="13" fill={`url(#${idNode})`} />
          <circle cx="342" cy="248" r="11" fill={`url(#${idNode})`} />
          <circle cx="40" cy="318" r="7" fill="#ff69b4" fillOpacity="0.75" />
          <circle cx="128" cy="322" r="7" fill="#ff69b4" fillOpacity="0.75" />
          <circle cx="168" cy="326" r="7" fill="#ff69b4" fillOpacity="0.7" />
          <circle cx="254" cy="326" r="7" fill="#ff69b4" fillOpacity="0.7" />
          <circle cx="292" cy="322" r="7" fill="#ff69b4" fillOpacity="0.75" />
          <circle cx="380" cy="318" r="7" fill="#ff69b4" fillOpacity="0.75" />
        </g>
      </svg>
    </div>
  )
}
