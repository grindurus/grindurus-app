import { useCallback, useEffect, useRef, useState } from 'react'
import tokenUsdc from '@landing/assets/token-usdc.svg'
import tokenWeth from '@landing/assets/token-weth.svg'
import arbitrumLogo from '@landing/assets/arbitrum-logo.svg'
import grindurusLogo from '@landing/assets/logo.png'

const SOL_TOKEN_IMG =
  'https://assets.coingecko.com/coins/images/4128/small/solana.png'
const ETH_TOKEN_IMG =
  'https://assets.coingecko.com/coins/images/279/small/ethereum.png'

const GRAI_NETWORKS = [
  { id: 'solana', name: 'Solana', img: SOL_TOKEN_IMG },
  { id: 'arbitrum', name: 'Arbitrum', img: arbitrumLogo },
  { id: 'ethereum', name: 'Ethereum', img: ETH_TOKEN_IMG },
] as const

const NETWORK_COUNT = GRAI_NETWORKS.length
const NETWORK_AUTO_MS = 4_200
const NETWORK_SWIPE_PX = 36

const YIELD_CHIPS = [
  { id: 'usdc-a', symbol: 'USDC', img: tokenUsdc as string, left: '8%', top: '36%', anim: 'animate-grai-yield-l', delay: '0s' },
  { id: 'sol-a', symbol: 'SOL', img: SOL_TOKEN_IMG, left: '48%', top: '30%', anim: 'animate-grai-yield-r', delay: '0.8s' },
  { id: 'eth-a', symbol: 'ETH', img: tokenWeth as string, left: '28%', top: '26%', anim: 'animate-grai-yield-c', delay: '1.6s' },
  { id: 'usdc-b', symbol: 'USDC', img: tokenUsdc as string, left: '44%', top: '40%', anim: 'animate-grai-yield-r', delay: '2.4s' },
  { id: 'sol-b', symbol: 'SOL', img: SOL_TOKEN_IMG, left: '12%', top: '28%', anim: 'animate-grai-yield-l', delay: '3.2s' },
  { id: 'eth-b', symbol: 'ETH', img: tokenWeth as string, left: '32%', top: '38%', anim: 'animate-grai-yield-c', delay: '4s' },
] as const

function GraiHolderFigure() {
  return (
    <svg
      viewBox="0 0 360 270"
      className="relative z-[2] h-[400px] w-auto max-w-full overflow-visible pointer-events-none animate-grai-holder-idle"
      aria-hidden
    >
      <defs>
        <linearGradient id="gh-hoodie" x1="80" y1="90" x2="186" y2="250" gradientUnits="userSpaceOnUse">
          <stop stopColor="#222" />
          <stop offset="1" stopColor="#0b0b0b" />
        </linearGradient>
        <linearGradient id="gh-bull" x1="50" y1="120" x2="240" y2="250" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1a1f2c" />
          <stop offset="0.55" stopColor="#07080c" />
          <stop offset="1" stopColor="#050505" />
        </linearGradient>
        <linearGradient id="gh-hat" x1="70" y1="18" x2="190" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2c2c2c" />
          <stop offset="1" stopColor="#0c0c0c" />
        </linearGradient>
        <linearGradient id="gh-hat-brim" x1="70" y1="40" x2="190" y2="66" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1a1a1a" />
          <stop offset="0.5" stopColor="#2a2a2a" />
          <stop offset="1" stopColor="#111" />
        </linearGradient>
        <linearGradient id="gh-grai" x1="90" y1="148" x2="176" y2="230" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#ff69b4" />
        </linearGradient>
        <linearGradient id="gh-lock" x1="154" y1="208" x2="186" y2="248" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff69b4" />
          <stop offset="1" stopColor="#ff1493" />
        </linearGradient>
        <radialGradient id="gh-aura" cx="50%" cy="56%" r="50%">
          <stop stopColor="#ff69b4" stopOpacity="0.32" />
          <stop offset="1" stopColor="#ff69b4" stopOpacity="0" />
        </radialGradient>
        <filter id="gh-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="gh-smile">
          <path d="M116 84c8 13 20 13 28 0Z" />
        </clipPath>
        <clipPath id="gh-logo-clip">
          <path d="M190 32 H330 V102 L294 112 L266 124 L254 172 H190 Z" />
        </clipPath>
      </defs>

      <ellipse cx="170" cy="240" rx="118" ry="10" fill="#ff69b4" opacity="0.16" />
      <circle cx="170" cy="150" r="118" fill="url(#gh-aura)" />

      <g>
        <path
          d="M74 157 C52 148 34 156 20 176"
          fill="none"
          stroke="#ff1493"
          strokeWidth="2.3"
          strokeLinecap="round"
        />
        <path
          d="M74 157 C52 148 34 156 20 176"
          fill="none"
          stroke="#121212"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <g fill="none" stroke="#ff1493" strokeLinecap="round">
          <path d="M20 176 C12 184 8 198 10 210" strokeWidth="1.5" />
          <path d="M20 176 C18 188 16 202 20 214" strokeWidth="1.7" />
          <path d="M20 176 C26 186 28 200 26 212" strokeWidth="1.6" />
          <path d="M20 176 C8 180 4 192 6 204" strokeWidth="1.3" />
          <path d="M20 176 C30 182 34 194 32 206" strokeWidth="1.3" />
        </g>
        <g fill="none" stroke="#fff" strokeLinecap="round" opacity="0.75">
          <path d="M20 176 C14 186 12 198 14 208" strokeWidth="0.8" />
          <path d="M20 176 C22 188 22 200 24 210" strokeWidth="0.8" />
        </g>

        <path
          d="M76 158 L68 228 L76 232 L84 164Z"
          fill="#070707"
          stroke="#ff1493"
          strokeWidth="1.6"
        />
        <path
          d="M96 156 L90 228 L98 232 L102 162Z"
          fill="#101014"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1.4"
        />

        <path
          d="M62 144 C78 112 132 108 160 140 L166 180 C128 200 78 196 52 170 C48 158 54 148 62 144Z"
          fill="#08080c"
          stroke="#ff1493"
          strokeWidth="2.2"
        />
        <path
          d="M80 140 C112 124 138 136 152 160"
          fill="none"
          stroke="#fff"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.9"
        />
        <path
          d="M68 152 C100 136 128 148 146 170"
          fill="none"
          stroke="#ff1493"
          strokeWidth="3.4"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d="M74 162 C102 150 126 160 140 176"
          fill="none"
          stroke="#fff"
          strokeWidth="2.8"
          strokeLinecap="round"
          opacity="0.75"
        />
        <path
          d="M78 168 C104 160 124 168 136 180"
          fill="none"
          stroke="#ff1493"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.7"
        />

        <path
          d="M240 86
             C186 108 132 116 78 142
             C84 196 168 214 234 178
             C268 158 278 118 270 90
             C266 76 252 74 240 86Z"
          fill="url(#gh-bull)"
          stroke="#ff1493"
          strokeWidth="2.4"
        />
        <path
          d="M232 104 C176 128 130 134 86 156"
          fill="none"
          stroke="#fff"
          strokeWidth="9"
          strokeLinecap="round"
          opacity="0.92"
        />
        <path
          d="M236 122 C180 148 138 154 96 174"
          fill="none"
          stroke="#ff1493"
          strokeWidth="6.5"
          strokeLinecap="round"
          opacity="0.82"
        />

        <path
          d="M214 122 C230 142 232 172 218 194 C200 208 180 200 176 184 C178 164 194 136 214 122Z"
          fill="#0a0a10"
          stroke="#ff1493"
          strokeWidth="2"
        />
        <path
          d="M208 136 C218 156 216 176 202 188"
          fill="none"
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.75"
        />

        <path
          d="M198 200 L194 232 L202 236 L206 204Z"
          fill="#070707"
          stroke="#ff1493"
          strokeWidth="1.6"
        />
        <path
          d="M222 184 L220 232 L228 236 L232 176Z"
          fill="#101014"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1.4"
        />

        <g>
          <path
            d="M128 124 C142 112 178 110 204 124 C208 138 200 152 184 156 C158 162 136 158 124 146 C122 136 124 128 128 124Z"
            fill="#17130f"
            stroke="#ff69b4"
            strokeWidth="1.8"
          />
          <path
            d="M132 126 C136 108 154 106 158 122"
            fill="none"
            stroke="#ff69b4"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <ellipse cx="198" cy="124" rx="9" ry="7" fill="#1c1814" stroke="#ff69b4" strokeWidth="1.6" />
          <circle cx="198" cy="117" r="4.2" fill="#2a2420" stroke="#ff69b4" strokeWidth="1.5" />
          <path
            d="M140 150 C132 172 128 190 138 198 C152 202 162 182 156 152Z"
            fill="#1a1612"
            stroke="#ff69b4"
            strokeWidth="1.4"
          />
          <path
            d="M136 190 h16 a7 5 0 0 1 0 9 h-16 a7 5 0 0 1 0 -9Z"
            fill="none"
            stroke="#ff69b4"
            strokeWidth="2"
          />
        </g>

        <image
          href={grindurusLogo}
          x="190"
          y="32"
          width="140"
          height="140"
          clipPath="url(#gh-logo-clip)"
        />
      </g>

      <g transform="translate(82 -30) scale(0.68)">

      <path
        d="M102 108h56v108c0 14-12 20-28 20s-28-6-28-20z"
        fill="url(#gh-hoodie)"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="1.4"
      />
      <path d="M130 112v104" stroke="rgba(255,105,180,0.45)" strokeWidth="1.5" strokeDasharray="2 4" />

      <path
        d="M122 104 L130 118 L138 104"
        fill="#0c0c0c"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="1"
      />
      <path
        d="M118 96 L104 122 L118 116 L128 106 Z"
        fill="#242424"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1.3"
      />
      <path
        d="M142 96 L156 122 L142 116 L132 106 Z"
        fill="#242424"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1.3"
      />
      <path d="M120 100 L108 118" stroke="rgba(255,105,180,0.4)" strokeWidth="1.2" />
      <path d="M140 100 L152 118" stroke="rgba(255,105,180,0.4)" strokeWidth="1.2" />

      <circle cx="130" cy="68" r="26" fill="#1c1c1c" stroke="rgba(255,255,255,0.18)" strokeWidth="1.4" />

      <g transform="translate(0 10)">
        <path
          d="M62 54
             C60 36 88 28 104 44
             C116 56 144 56 156 44
             C172 28 200 36 198 54
             C200 64 176 70 158 64
             C144 60 116 60 104 64
             C88 70 60 64 62 54Z"
          fill="url(#gh-hat-brim)"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="1.4"
        />
        <path
          d="M108 50 C118 44 142 44 152 50"
          fill="none"
          stroke="#ff69b4"
          strokeWidth="4.2"
          opacity="0.5"
          strokeLinecap="round"
        />
        <path
          d="M106 50
             L108 32
             C110 18 118 14 130 22
             C142 14 150 18 152 32
             L154 50
             C142 46 118 46 106 50Z"
          fill="url(#gh-hat)"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="1.3"
        />
        <path
          d="M105 47 C106 58 154 58 155 47 C152 54 108 54 105 47Z"
          fill="#161616"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1.2"
        />
        <path
          d="M105 47 C118 58 142 58 155 47 C142 54 118 54 105 47Z"
          fill="#ff69b4"
        />
      </g>
      <g>
        <path
          d="M130 74 L136 83 L124 83 Z"
          fill="#2a2a2a"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
        <path d="M128.5 77 L130 75.2 L131.2 77" fill="rgba(255,255,255,0.18)" />
        <path d="M116 84c8 13 20 13 28 0Z" fill="#050505" />
        <g clipPath="url(#gh-smile)">
          <rect x="116" y="84" width="28" height="4.2" fill="#fff" />
          <rect x="116" y="89.2" width="28" height="10" fill="#fff" />
          <path d="M122 84v4.2M128 84v4.2M134 84v4.2M140 84v4.2" stroke="rgba(5,5,5,0.32)" strokeWidth="1" />
          <path d="M122 89.2v10M128 89.2v10M134 89.2v10M140 89.2v10" stroke="rgba(5,5,5,0.32)" strokeWidth="1" />
        </g>
      </g>

      <g className="animate-grai-disc-twist" style={{ transformOrigin: '130px 188px' }}>
        <path
          d="M102 118 L84 126 L70 158 L78 184 L98 176 L108 128 Z"
          fill="#151515"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="1.3"
        />
        <path
          d="M158 118 L176 126 L190 158 L182 184 L162 176 L152 128 Z"
          fill="#151515"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="1.3"
        />

        <g filter="url(#gh-soft)">
          <circle cx="130" cy="188" r="44" fill="#050505" stroke="rgba(255,255,255,0.18)" strokeWidth="3" />
          <circle cx="130" cy="188" r="36" fill="#0a0a0a" stroke="rgba(255,105,180,0.35)" strokeWidth="1.2" />
          <text
            x="130"
            y="194"
            textAnchor="middle"
            fill="url(#gh-grai)"
            fontFamily={'JetBrains Mono, ui-monospace, monospace'}
            fontSize="16"
            fontWeight="700"
            letterSpacing="1.4"
          >
            GRAI
          </text>
        </g>

        <g className="origin-center animate-grai-lock-jiggle" style={{ transformOrigin: '172px 231px' }}>
          <path
            d="M165 226 V212 a7 8 0 0 1 14 0 V226"
            fill="none"
            stroke="#ff69b4"
            strokeWidth="3.2"
            strokeLinecap="butt"
          />
          <rect x="158" y="220" width="28" height="22" rx="5" fill="url(#gh-lock)" />
          <circle cx="172" cy="230" r="3.2" fill="#0a0a0a" />
          <path d="M172 233v5" stroke="#0a0a0a" strokeWidth="2.2" strokeLinecap="round" />
        </g>

        <g fill="#1c1c1c" stroke="rgba(255,255,255,0.22)" strokeWidth="1">
          <ellipse cx="88" cy="186" rx="10" ry="9" />
          <rect x="92" y="175" width="16" height="4.5" rx="2.2" transform="rotate(-18 92 177.2)" />
          <rect x="94" y="183" width="17" height="4.5" rx="2.2" transform="rotate(-6 94 185.2)" />
          <rect x="94" y="191" width="16" height="4.5" rx="2.2" transform="rotate(7 94 193.2)" />
          <rect x="91" y="198" width="13" height="4.2" rx="2.1" transform="rotate(18 91 200.1)" />
          <ellipse cx="102" cy="168" rx="4.2" ry="6.2" transform="rotate(-38 102 168)" />

          <ellipse cx="172" cy="186" rx="10" ry="9" />
          <rect x="152" y="175" width="16" height="4.5" rx="2.2" transform="rotate(18 168 177.2)" />
          <rect x="149" y="183" width="17" height="4.5" rx="2.2" transform="rotate(6 166 185.2)" />
          <rect x="150" y="191" width="16" height="4.5" rx="2.2" transform="rotate(-7 166 193.2)" />
          <rect x="156" y="198" width="13" height="4.2" rx="2.1" transform="rotate(-18 169 200.1)" />
        </g>
      </g>

      <path
        d="M108 224 L96 268 L90 304 L108 312 L122 306 L128 270 L130 228 Z"
        fill="#121212"
        stroke="rgba(255,255,255,0.16)"
        strokeWidth="1.3"
      />
      <path
        d="M88 300 L84 318 C86 324 126 324 128 316 L124 300 Z"
        fill="#0d0d0d"
        stroke="#ff69b4"
        strokeWidth="1.4"
      />
      </g>
    </svg>
  )
}

function wrapNetworkIndex(index: number) {
  return (index + NETWORK_COUNT) % NETWORK_COUNT
}

function GraiNetworkCarousel() {
  const [index, setIndex] = useState(0)
  const pauseUntil = useRef(0)
  const dragX = useRef<number | null>(null)

  const pauseAuto = useCallback(() => {
    pauseUntil.current = Date.now() + 8_000
  }, [])

  const go = useCallback((delta: number) => {
    setIndex((current) => wrapNetworkIndex(current + delta))
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (Date.now() < pauseUntil.current) return
      setIndex((current) => wrapNetworkIndex(current + 1))
    }, NETWORK_AUTO_MS)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div
      className="absolute left-1/2 top-[282px] z-[1] w-[300px] -translate-x-1/2 cursor-grab select-none touch-pan-y active:cursor-grabbing"
      role="region"
      aria-roledescription="carousel"
      aria-label="GRAI networks"
      onPointerDown={(event) => {
        if (event.button !== 0) return
        dragX.current = event.clientX
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerUp={(event) => {
        if (dragX.current == null) return
        const dx = event.clientX - dragX.current
        dragX.current = null
        if (Math.abs(dx) < NETWORK_SWIPE_PX) return
        pauseAuto()
        go(dx < 0 ? 1 : -1)
      }}
      onPointerCancel={() => {
        dragX.current = null
      }}
    >
      <div className="rounded-2xl border border-white/15 bg-black/80 px-2.5 py-3 shadow-[0_16px_48px_rgba(255,105,180,0.22),inset_0_0_28px_rgba(255,105,180,0.1)] backdrop-blur-sm">
        <div className="flex items-center justify-center gap-1.5">
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/45 transition-colors hover:text-brand-pink"
            aria-label="Previous network"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              pauseAuto()
              go(-1)
            }}
          >
            <svg width="16" height="16" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path d="M8 2 L4 6 L8 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="relative h-10 w-[168px] overflow-hidden" aria-live="polite">
            {GRAI_NETWORKS.map((network, networkIndex) => (
              <span
                key={network.id}
                className={`absolute inset-0 inline-flex items-center justify-center gap-2.5 transition-all duration-300 ${
                  networkIndex === index
                    ? 'translate-x-0 opacity-100'
                    : networkIndex === wrapNetworkIndex(index - 1)
                      ? '-translate-x-10 opacity-0'
                      : 'translate-x-10 opacity-0'
                }`}
              >
                <img src={network.img} alt="" width={22} height={22} className="h-[22px] w-[22px] object-contain" />
                <span className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-white">
                  {network.name}
                </span>
              </span>
            ))}
          </div>

          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/45 transition-colors hover:text-brand-pink"
            aria-label="Next network"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              pauseAuto()
              go(1)
            }}
          >
            <svg width="16" height="16" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path d="M4 2 L8 6 L4 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="mt-2.5 flex items-center justify-center gap-2" role="tablist" aria-label="Networks">
          {GRAI_NETWORKS.map((network, networkIndex) => (
            <button
              key={network.id}
              type="button"
              role="tab"
              aria-selected={networkIndex === index}
              aria-label={network.name}
              className={`h-2 rounded-full transition-all ${
                networkIndex === index ? 'w-6 bg-brand-pink' : 'w-2 bg-white/25 hover:bg-white/50'
              }`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                pauseAuto()
                setIndex(networkIndex)
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function GraiHolderScene() {
  return (
    <div className="relative flex min-h-[420px] w-full flex-1 flex-col items-center justify-center">
      <div className="pointer-events-none absolute -top-6 h-[360px] w-[360px] rounded-full border-[1.5px] border-white/10 shadow-[inset_0_0_80px_rgba(255,105,180,0.1),0_0_120px_rgba(255,105,180,0.15)]" />

      <div className="relative h-[440px] w-[340px]">
        <div className="relative -translate-y-10">
          <GraiHolderFigure />

          {YIELD_CHIPS.map((chip) => (
            <div
              key={chip.id}
              className={`pointer-events-none absolute z-10 flex items-center gap-1 rounded-full border border-white/15 bg-black/80 px-1.5 py-0.5 shadow-[0_0_16px_rgba(255,105,180,0.18)] backdrop-blur-sm ${chip.anim}`}
              style={{ left: chip.left, top: chip.top, animationDelay: chip.delay }}
            >
              <span className="font-mono text-[10px] font-bold leading-none text-brand-pink">+</span>
              <img src={chip.img} alt="" width={12} height={12} className="h-3 w-3 shrink-0 object-contain" />
              <span className="font-mono text-[10px] font-bold leading-none tracking-wide text-white">
                {chip.symbol}
              </span>
            </div>
          ))}

          <GraiNetworkCarousel />
        </div>
      </div>
    </div>
  )
}
