import { useEffect, useRef, useState } from 'react'
import { APP_BACKTEST } from '@landing/config'
import { Button } from "@landing/components/ui/Button"
import { Title } from '@landing/components/ui/Title'
import { Description } from '@landing/components/ui/Description'
import { FieldLabel } from '@landing/components/ui/FieldLabel'

const YIELD_MIN = 10
const YIELD_MAX = 60
const INITIAL_USDC = 5_000
const HOLD_MS = 3000
const RECALC_MS = 300

function useAnimatedYield() {
  const [value, setValue] = useState(() => YIELD_MIN + Math.random() * (YIELD_MAX - YIELD_MIN))
  const timeoutRef = useRef<number | null>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(35)
      return
    }

    let cancelled = false
    const randomBetween = () => YIELD_MIN + Math.random() * (YIELD_MAX - YIELD_MIN)

    const clearTimers = () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      cancelAnimationFrame(rafRef.current)
    }

    const scheduleHoldThenRecalc = (heldValue: number) => {
      setValue(heldValue)
      timeoutRef.current = window.setTimeout(() => {
        if (cancelled) return
        startRecalc()
      }, HOLD_MS)
    }

    const startRecalc = () => {
      const start = performance.now()
      const tick = (now: number) => {
        if (cancelled) return
        const elapsed = now - start
        if (elapsed >= RECALC_MS) {
          scheduleHoldThenRecalc(randomBetween())
          return
        }
        setValue(randomBetween())
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    timeoutRef.current = window.setTimeout(() => {
      if (cancelled) return
      startRecalc()
    }, HOLD_MS)

    return () => {
      cancelled = true
      clearTimers()
    }
  }, [])

  return value
}

function OutputStats() {
  const yield_ = useAnimatedYield()
  const finalUsdc = INITIAL_USDC * (1 + yield_ / 100)
  const finalFormatted = finalUsdc.toLocaleString('en-US', { maximumFractionDigits: 0 })

  return (
    <div className="bg-black border border-white/10 rounded-xl px-4 py-4 flex items-stretch divide-x divide-white/10">
      {/* Yield % */}
      <div className="flex-1 flex flex-col items-center text-center pr-4">
        <FieldLabel className="mb-1.5 text-center">Annual Yield</FieldLabel>
        <span className="font-mono font-black text-2xl text-[#4ade80] tabular-nums leading-none">
          +{yield_.toFixed(1)}%
        </span>
      </div>
      {/* Final amount */}
      <div className="flex-1 flex flex-col items-center text-center pl-4">
        <FieldLabel className="mb-1.5 text-center">Final Amount</FieldLabel>
        <span className="font-mono font-black text-2xl text-white tabular-nums leading-none">
          ${finalFormatted}
        </span>
      </div>
    </div>
  )
}

function Or() {
  return (
    <span className="text-white/40">
      or
    </span>
  )
}

export function CalculatorCtaSection() {
  return (
    <section className="w-full py-6 md:py-12 lg:py-16 bg-black relative">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center relative z-10">

          {/* Left Content */}
          <div className="flex flex-col items-start text-left">
            <Title>
              Backtest any asset yourself <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-pink to-[#ff1493]">
                for just $1
              </span>
            </Title>
            <Description className="mb-10 max-w-[500px]">
              Curious how much your favorite cryptocurrency fluctuates? See the true power of automated market-taking.
              The calculator reveals exactly how volatile an asset is and exactly how much our infrastructure could earn from it.
            </Description>

            <Button href={APP_BACKTEST} size="md">
              Launch Calculator (soon)
            </Button>
          </div>

          {/* Right Graphic: Mock Calculator Widget */}
          <div className="relative flex items-center justify-center">
            <div className="bg-[#0a0a0a] border border-white/[0.08] rounded-2xl p-6 flex flex-col gap-6 w-full">
              <div>
                <FieldLabel>Asset Pair</FieldLabel>
                <div className="w-full flex items-center gap-2 bg-black border border-white/10 rounded-xl px-4 py-3 font-mono font-bold text-white text-sm cursor-pointer">
                  SOL/USDC <Or /> BTC/USDT <Or /> ETH/USDT <Or /> ...
                </div>
              </div>
              <div>
                <FieldLabel>Timeframe</FieldLabel>
                <div className="w-full flex items-center gap-2 bg-black border border-white/10 rounded-xl px-4 py-3 font-mono font-bold text-white text-sm cursor-pointer">
                  30 days (1 month) <Or /> 2 months <Or /> 3 months <Or /> ...
                </div>
              </div>

              {/* Initial Capital */}
              <div>
                <FieldLabel>Initial Capital</FieldLabel>
                <div className="bg-black border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between relative overflow-hidden group">
                  <div className="font-mono font-bold text-white flex items-baseline gap-2">
                    <span className="group-hover:text-brand-pink transition-colors duration-150">25 SOL</span>
                    <span className="text-white/40 font-semibold">($5,000)</span>
                  </div>
                </div>
              </div>
              <OutputStats />

            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
