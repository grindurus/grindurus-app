import { GraiGrindersSection } from '../../../../components/grai/GraiGrindersSection'
import '../../../../pages/GraiPage.css'

type Props = {
  /** Nested under mobile hero CTA — no full-bleed section chrome. */
  embedded?: boolean
  className?: string
}

/** Same interactive grinders summary + table as `/grai`. */
export function LandingGrindersPlaque({ embedded = false, className }: Props) {
  return (
    <section
      className={
        embedded
          ? `landing-grinders-plaque landing-grinders-plaque--embedded relative w-full ${className ?? ''}`
          : `landing-grinders-plaque relative w-full bg-black border-y border-white/10 ${className ?? ''}`
      }
      aria-label="Live grinders summary"
    >
      <div
        className={
          embedded
            ? 'landing-grinders-plaque__host w-full text-center'
            : 'landing-grinders-plaque__host max-w-[1280px] mx-auto px-4 sm:px-8 py-3 md:py-4'
        }
      >
        <GraiGrindersSection
          showTableToggle={false}
          showNetworkFilter={false}
          tvlLabel={embedded ? 'TOTAL VALUE LOCKED' : 'TVL'}
        />
      </div>
    </section>
  )
}
