import { INTEGRATED_PARTNERS } from '../../../constants/partners'
import { Title } from '@landing/components/ui/Title'

export function PartnersSection() {
  const marqueeItems = [
    ...INTEGRATED_PARTNERS,
    ...INTEGRATED_PARTNERS,
    ...INTEGRATED_PARTNERS,
    ...INTEGRATED_PARTNERS,
  ]

  return (
    <section className="py-6 md:py-12 lg:py-16 overflow-hidden overflow-x-hidden max-w-[100vw] bg-black">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8">
        <Title className="text-center mb-6">Integrated With</Title>
      </div>
      <div className="relative w-full max-w-full overflow-hidden marquee-mask">
        <div className="flex gap-12 w-max px-6 animate-[marquee-scroll_30s_linear_infinite] hover:[animation-play-state:paused]">
          {marqueeItems.map((p, i) => (
            <a
              key={`${p.id}-${i}`}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 no-underline text-[#1a1a1a]/90 dark:text-white/90 flex-shrink-0 transition-all duration-200 hover:opacity-100"
            >
              {p.imgLight ? (
                <>
                  <img src={p.img} alt={p.name} width={40} height={40} className="object-contain hidden dark:block" aria-hidden />
                  <img src={p.imgLight} alt={p.name} width={40} height={40} className="object-contain block dark:hidden" aria-hidden />
                </>
              ) : (
                <img src={p.img} alt={p.name} width={40} height={40} className="object-contain" />
              )}
              <span className="font-mono text-base font-semibold whitespace-nowrap">{p.name}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
