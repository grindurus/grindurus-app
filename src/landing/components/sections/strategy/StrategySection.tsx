import { useEffect, useState } from 'react'
import { Title } from '@landing/components/ui/Title'
import { SubTitle } from '@landing/components/ui/SubTitle'
import { Description } from '@landing/components/ui/Description'
import usdcSvg from '@landing/assets/token-usdc.svg'
import wethSvg from '@landing/assets/token-weth.svg'
import arbitrumLogo from '@landing/assets/arbitrum-logo.svg'

const STRATEGY_PAIRS = [
  { base: 'SOL', quote: 'USDC' },
  { base: 'ETH', quote: 'USDC' },
  { base: 'BTC', quote: 'USDC' },
  { base: 'ARB', quote: 'USDC' },
] as const

type StrategySymbol = (typeof STRATEGY_PAIRS)[number]['base'] | (typeof STRATEGY_PAIRS)[number]['quote']

const TOKEN_ICONS: Record<StrategySymbol, string> = {
  USDC: usdcSvg,
  ETH: wethSvg,
  ARB: arbitrumLogo,
  SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
}

const PAIR_ROTATE_MS = 5_000
const LABEL_ICON = 7
const LABEL_ICON_GAP = 1.6

function labelWidth(text: string) {
  if (!text) return 0
  return text.length * 3.6 + Math.max(0, text.length - 1)
}

function StrategyPairLabel({
  id,
  x,
  y,
  fill,
  action,
  symbol,
}: {
  id: string
  x: number
  y: number
  fill: string
  action: 'BUY' | 'SELL'
  symbol: StrategySymbol
}) {
  const icon = TOKEN_ICONS[symbol]
  const prefix = `${action} (+`
  const ticker = `${symbol})`
  const prefixW = labelWidth(prefix)
  const tickerW = labelWidth(ticker)
  const total = prefixW + LABEL_ICON_GAP + LABEL_ICON + LABEL_ICON_GAP + tickerW
  const start = x - total / 2
  const iconX = start + prefixW + LABEL_ICON_GAP
  const tickerX = iconX + LABEL_ICON + LABEL_ICON_GAP
  const clipId = `strategy-pair-icon-${id}`
  const iconCy = y - 1.6

  return (
    <g>
      <clipPath id={clipId}>
        <circle cx={iconX + LABEL_ICON / 2} cy={iconCy} r={LABEL_ICON / 2} />
      </clipPath>
      <text
        x={start}
        y={y}
        fill={fill}
        fontSize="6"
        fontFamily="monospace"
        textAnchor="start"
        fontWeight="bold"
        letterSpacing="1"
      >
        {prefix}
      </text>
      <image
        href={icon}
        x={iconX}
        y={y - LABEL_ICON + 1.9}
        width={LABEL_ICON}
        height={LABEL_ICON}
        clipPath={`url(#${clipId})`}
      />
      <text
        x={tickerX}
        y={y}
        fill={fill}
        fontSize="6"
        fontFamily="monospace"
        textAnchor="start"
        fontWeight="bold"
        letterSpacing="1"
      >
        {ticker}
      </text>
    </g>
  )
}

export function StrategySection() {
  const [pairIndex, setPairIndex] = useState(0)
  const { base, quote } = STRATEGY_PAIRS[pairIndex]!

  useEffect(() => {
    const id = window.setInterval(() => {
      setPairIndex((current) => (current + 1) % STRATEGY_PAIRS.length)
    }, PAIR_ROTATE_MS)
    return () => window.clearInterval(id)
  }, [])

  return (
    <section className="w-full py-6 md:py-12 lg:py-16 bg-black relative overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 relative z-10">
        {/* Section heading */}
        <div className="text-center mb-10 md:mb-16 md:mb-24">
          <Title className="whitespace-normal break-words px-1 !text-[clamp(1.25rem,5.8vw,3.5rem)]">
            Automated Market Taker
          </Title>
          <Description>
            Market price volatility is an opportunity. No need to predict the market. <br></br>Your capital works in both modes.
          </Description>
        </div>

        {/* Strategy Cards Grid */}
        <div className="flex flex-col sm:flex-row gap-6 md:gap-8 mb-12 md:mb-20">

          {/* Card 1: Buy Low, Sell High */}
          <div className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-3xl p-4 md:p-6 relative overflow-hidden group hover:border-brand-pink/30 hover:shadow-[0_20px_60px_rgba(255,105,180,0.1)] transition-all duration-500">
            {/* Inner Glow */}
            <div className="absolute -top-[150px] -right-[150px] w-[300px] h-[300px] bg-brand-pink/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-brand-pink/20 transition-colors duration-500"></div>

            <div className="relative z-10 flex flex-col h-full">
              <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-white/70 mb-8 w-max">
                <span className="w-2 h-2 rounded-full bg-brand-pink mr-2 shadow-[0_0_8px_rgba(255,105,180,0.8)]"></span>
                DIRECT MODE
              </div>

              <SubTitle className="mb-6">
                Buy Low, Sell High
              </SubTitle>
              <Description className="mb-10">
                Use USDC to buy dips and sell rallies.<br></br>
                Result: Your USDC grows.
              </Description>

              {/* Graphic */}
              <div className="w-full h-40 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center p-6 relative">
                <div className="pointer-events-none absolute bottom-2 left-3 z-10 flex items-center gap-2 sm:bottom-2.5 sm:left-4 sm:gap-2.5">
                  <span
                    className="block h-0 w-4 shrink-0 border-0 border-t-2 border-dashed border-white/50 sm:w-5"
                    aria-hidden
                  />
                  <span className="font-mono text-[10px] font-medium tracking-wide text-white/55 sm:text-xs">
                    decision curve
                  </span>
                </div>
                <svg viewBox="0 0 120 70" className="w-full h-full overflow-visible">
                  {/* Grid Lines */}
                  <line x1="0" y1="35" x2="120" y2="35" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="2 2" />

                  {/* Trajectory */}
                  <path d="M 10 35 C 30 55, 40 55, 60 55 C 80 55, 90 15, 110 15" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeDasharray="4 4" />

                  {/* Points */}
                  <circle cx="60" cy="55" r="4" fill="#ff69b4" className="animate-pulse" />
                  <circle cx="110" cy="15" r="4" fill="#fff" className="animate-pulse" style={{ animationDelay: '1s' }} />

                  {/* Labels */}
                  <StrategyPairLabel id="direct-buy" x={60} y={70} fill="#ff69b4" action="BUY" symbol={base} />
                  <StrategyPairLabel id="direct-sell" x={110} y={7} fill="#fff" action="SELL" symbol={quote} />
                </svg>
              </div>
            </div>
          </div>

          {/* Card 2: Sell High, Buy Low */}
          <div className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-3xl p-4 md:p-6 relative overflow-hidden group hover:border-brand-red/30 hover:shadow-[0_20px_60px_rgba(255,20,147,0.1)] transition-all duration-500">
            {/* Inner Glow */}
            <div className="absolute -top-[150px] -right-[150px] w-[300px] h-[300px] bg-brand-red/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-brand-red/20 transition-colors duration-500"></div>

            <div className="relative z-10 flex flex-col h-full">
              <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-white/70 mb-8 w-max">
                <span className="w-2 h-2 rounded-full bg-brand-red mr-2 shadow-[0_0_8px_rgba(255,20,147,0.8)]"></span>
                INVERSE MODE
              </div>

              <SubTitle className="mb-6">
                Sell High, Buy Low
              </SubTitle>
              <Description className="mb-10">
                Sell peaks and rebuy dips.<br></br>
                Result: You accumulate more SOL
              </Description>

              {/* Graphic */}
              <div className="w-full h-40 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center p-6 relative">
                <div className="pointer-events-none absolute bottom-2 left-3 z-10 flex items-center gap-2 sm:bottom-2.5 sm:left-4 sm:gap-2.5">
                  <span
                    className="block h-0 w-4 shrink-0 border-0 border-t-2 border-dashed border-white/50 sm:w-5"
                    aria-hidden
                  />
                  <span className="font-mono text-[10px] font-medium tracking-wide text-white/55 sm:text-xs">
                    decision curve
                  </span>
                </div>
                <svg viewBox="0 0 120 70" className="w-full h-full overflow-visible">
                  {/* Grid Lines */}
                  <line x1="0" y1="35" x2="120" y2="35" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="2 2" />

                  {/* Trajectory */}
                  <path d="M 10 35 C 30 15, 40 15, 60 15 C 80 15, 90 55, 110 55" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeDasharray="4 4" />

                  {/* Points */}
                  <circle cx="60" cy="15" r="4" fill="#ff1493" className="animate-pulse" />
                  <circle cx="110" cy="55" r="4" fill="#fff" className="animate-pulse" style={{ animationDelay: '1s' }} />

                  {/* Labels */}
                  <StrategyPairLabel id="inverse-sell" x={60} y={7} fill="#ff1493" action="SELL" symbol={quote} />
                  <StrategyPairLabel id="inverse-buy" x={110} y={70} fill="#fff" action="BUY" symbol={base} />
                </svg>
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  )
}
