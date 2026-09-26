import { APP_HOME } from '@landing/config'
import { Button } from '../../ui/Button'
import { TokenAdBanner } from './TokenAdBanner'

export function HeroSection() {
  return (
    <>
      {/* ── MOBILE layout (hidden on md+) ── */}
      <section className="md:hidden w-full bg-black flex flex-col items-center justify-center text-center px-6 overflow-hidden min-h-[100svh] pt-[64px] pb-8">
        {/* Headline */}
        <h1 className="font-mono font-black text-[clamp(2.2rem,10vw,3rem)] leading-[1.2] mb-3 relative z-10">
          <span className="block text-brand-pink text-[clamp(1.85rem,8vw,2.7rem)] whitespace-nowrap [text-shadow:0_0_20px_black]">
            Onchain Hedge Fund
          </span>
        </h1>

        {/* Token ad banner */}
        <div className="relative w-full max-w-[420px]" style={{ height: 'clamp(240px, 62vw, 340px)' }}>
          <TokenAdBanner contained />
        </div>

        {/* Description + CTA */}
        <p className="font-mono text-[clamp(0.9rem,3.5vw,1rem)] leading-[1.7] text-white/70 mb-6 mt-2 max-w-[380px] relative z-10">
          Infrastructure for Turning Price Volatility into Indexed Yield
        </p>
        <Button href={APP_HOME} size="md">
          Open App
        </Button>
      </section>

      {/* ── DESKTOP layout (hidden below md) ── */}
      <section
        className="mt-[74px] hidden md:flex relative w-full min-h-[90vh] bg-black items-center justify-center overflow-hidden"
      >
        {/* Token ad banner background */}
        <TokenAdBanner />

        {/* Hero text always above banner; only CTA captures clicks */}
        <div className="relative z-30 max-w-[1280px] mx-auto px-8 w-full flex justify-center pointer-events-none">
          <div className="text-center w-full">
            <h1 className="font-mono font-black text-[clamp(2.5rem,6vw,5rem)] leading-[1.2] pb-6">
              <span className="block text-brand-pink text-[clamp(2.6rem,5.2vw,4.5rem)] whitespace-nowrap [text-shadow:0_0_28px_rgba(0,0,0,0.95),0_2px_12px_rgba(0,0,0,0.8)]">
                Onchain Hedge Fund
              </span>
            </h1>

            <p
              className="
              font-mono text-[clamp(0.95rem,2vw,1.1rem)] leading-[1.7]
              text-white/75 dark:text-white/80 mb-4 mx-auto
              [text-shadow:0_0_24px_rgba(0,0,0,0.95),0_2px_10px_rgba(0,0,0,0.8)]
              whitespace-nowrap"
            >
              Infrastructure for Turning Price Volatility into Indexed Yield
            </p>

            <span className="pointer-events-auto inline-flex">
              <Button href={APP_HOME} size="md">
                Open App
              </Button>
            </span>
          </div>
        </div>
      </section>
    </>
  )
}
