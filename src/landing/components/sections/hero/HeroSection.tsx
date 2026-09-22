import { APP_HOME } from '@landing/config'
import { Button } from '../../ui/Button'
import { OrbitRing } from './OrbitRing'

export function HeroSection() {
  return (
    <>
      {/* ── MOBILE layout (hidden on md+) ── */}
      <section className="pt-[74px] md:hidden w-full bg-black flex flex-col items-center text-center px-6 pt-16 pb-14 overflow-hidden min-h-[90vh]">
        {/* Headline */}
        <h1 className="font-mono font-black text-[clamp(2.2rem,10vw,3rem)] leading-[1.2] mb-4 mt-32">
          <span className="block text-brand-pink text-[clamp(1.85rem,8vw,2.7rem)] whitespace-nowrap [text-shadow:0_0_20px_black]">
            Onchain Hedge Fund
          </span>
        </h1>

        {/* Inline animation block */}
        <div className="relative w-full" style={{ height: 'clamp(220px, 60vw, 340px)' }}>
          <OrbitRing contained />
        </div>

        {/* Description + CTA */}
        <p className="font-mono text-[clamp(0.9rem,3.5vw,1rem)] leading-[1.7] text-white/70 mb-8 max-w-[380px]">
          Infrastructure for Turning Price Volatility into Yield
        </p>
        <Button href={APP_HOME} size="md">
          Open App
        </Button>
      </section>

      {/* ── DESKTOP layout (hidden below md) ── */}
      <section
        className="mt-[74px] hidden md:flex relative w-full min-h-[90vh] bg-black items-center justify-center overflow-hidden"
      >
        {/* Background animation layer */}
        <OrbitRing />

        {/* Hero text – sits above animation */}
        <div className="max-w-[1280px] mx-auto px-8 w-full flex justify-center">
          <div className="relative z-10 text-center w-full">
            <h1 className="font-mono font-black text-[clamp(2.5rem,6vw,5rem)] leading-[1.2] pb-6">
              <span className="block text-brand-pink text-[clamp(2.6rem,5.2vw,4.5rem)] whitespace-nowrap [text-shadow:0_0_20px_black]">
                Onchain Hedge Fund
              </span>
            </h1>

            <p
              className="
              font-mono text-[clamp(0.95rem,2vw,1.1rem)] leading-[1.7]
              text-white/75 dark:text-white/80 mb-4 mx-auto [text-shadow:0_0_20px_black]
              whitespace-nowrap"
            >
              Infrastructure for Turning Price Volatility into Yield
            </p>

            <Button href={APP_HOME} size="md">
              Open App
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
