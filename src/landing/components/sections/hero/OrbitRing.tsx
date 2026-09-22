import { useEffect, useRef } from 'react'
import { ORBIT_TOKENS } from '../../../constants/tokens'
import logo from '@landing/assets/logo.png'

/**
 * Lemniscate (∞) orbit animation – full-width background layer.
 *
 * Exact Bernoulli lemniscate formula from the ICP landing (js/app.js):
 *   x = scale · cos(t) · √cos(2t)
 *   y = scale · sin(t) · √cos(2t)
 *
 * Where:
 *   centerX = containerWidth  / 2 - 40   (horizontal pivot)
 *   centerY = containerHeight / 2.2       (vertical pivot – slightly above centre)
 *   scale   = min(centerX, centerY) * 2   ← this is what makes it span **full width**
 *
 * Positions updated every frame via requestAnimationFrame, so it works on all
 * browsers without CSS offset-path. ResizeObserver keeps it adaptive.
 */
export function OrbitRing({ contained = false }: { contained?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const anglesRef = useRef<number[]>([])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const numLogos = ORBIT_TOKENS.length

    // Evenly-distributed starting angles (same as ICP landing)
    anglesRef.current = Array.from(
      { length: numLogos },
      (_, i) => i * ((2 * Math.PI) / numLogos)
    )

    /** Read current dimensions and return cx / cy / scale */
    function dims() {
      const w = container!.offsetWidth
      const h = container!.offsetHeight

      // Center exactly in the middle horizontally, slightly higher vertically
      const cx = w / 2
      const cy = h / 2.2

      // Cap the animation width to match the header/content container (77.5rem = 1240px)
      const contentWidth = Math.min(w, 1240)

      // We want the total width of the animation to fit the container bounds minus padding.
      // The exact width from center to edge is max(x) = scale.
      const paddingX = w < 640 ? 30 : 60
      let scale = (contentWidth / 2) - paddingX

      // Constrain by height so it doesn't overflow vertically if screen is very wide and short.
      // Max y is approximately 0.353 * scale.
      const paddingY = w < 640 ? 30 : 40
      const maxScaleY = (h - paddingY * 2) / (0.353 * 2)

      // If it's a huge desktop screen, wait! We can cap the max scale so it doesn't become huge.
      scale = Math.min(scale, maxScaleY)

      return { cx, cy, scale }
    }

    function step() {
      const icons = container!.querySelectorAll<HTMLElement>('.orbit-logo')
      if (!icons.length) { rafRef.current = requestAnimationFrame(step); return }

      const { cx, cy, scale } = dims()
      const halfIcon = icons[0].offsetWidth / 2 || 24

      for (let i = 0; i < numLogos; i++) {
        const t = anglesRef.current[i]

        // Rational parameterization of the lemniscate for continuous, smooth motion.
        // This avoids the singularity at the center that caused the glitchy fast movement.
        const sinT = Math.sin(t)
        const cosT = Math.cos(t)
        const denom = 1 + sinT * sinT

        const x = scale * (cosT / denom)
        const y = scale * (sinT * cosT / denom)

        icons[i].style.left = `${cx + x - halfIcon}px`
        icons[i].style.top = `${cy + y - halfIcon}px`

        // By multiplying the step by Math.sqrt(denom), we perfectly counteract the natural
        // slowdown at the center in this parameterization, resulting in beautifully constant speed!
        anglesRef.current[i] += 0.9e-3 * Math.sqrt(denom)
      }

      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div
      ref={containerRef}
      className={contained ? 'relative w-full h-full pointer-events-none' : 'absolute inset-0 pointer-events-none'}
      aria-hidden
    >
      {/* ── Background animation tokens loop (opacity-50 pushes them back visually) ── */}
      <div className="absolute inset-0 opacity-50 z-0">
        {ORBIT_TOKENS.map((token, i) => (
          <div
            key={`${token.symbol}-${i}`}
            className="orbit-logo absolute flex items-center justify-center
                       rounded-full bg-white
                       shadow-[0_2px_16px_rgba(0,0,0,0.2)]"
            style={{
              /* Fluid icon size: 24px on mobile → 60px on desktop (ICP uses 60px) */
              width: 'clamp(24px, 5vw, 60px)',
              height: 'clamp(24px, 5vw, 60px)',
              /* Start off-screen – RAF will position correctly on first tick */
              left: '-999px',
              top: '-999px',
            }}
          >
            <img
              src={token.src}
              alt={token.symbol}
              draggable={false}
              style={{
                width: `${(token.imgSize ?? 1) * 100}%`,
                height: `${(token.imgSize ?? 1) * 100}%`,
                objectFit: 'contain',
              }}
            />
          </div>
        ))}
      </div>

      {/* ── Center Logo (Theme aware, mobile adaptive, stays exactly at the animation pivot point) ── */}
      <div
        className="absolute flex items-center justify-center rounded-full z-10
                   bg-white dark:bg-black"
        style={{
          width: 'clamp(80px, 15vw, 140px)',
          height: 'clamp(80px, 15vw, 140px)',
          /* These match cx (w / 2) and cy (h / 2.2) from the dims() math perfectly */
          left: '50%',
          top: 'calc(100% / 2.2)',
          transform: 'translate(-50%, -50%)',
        }}
      >
        <img
          src={logo}
          alt="GrindURUS Middle Logo"
          className="w-[65%] h-[65%] object-contain opacity-50"
          draggable={false}
        />
      </div>
    </div>
  )
}
