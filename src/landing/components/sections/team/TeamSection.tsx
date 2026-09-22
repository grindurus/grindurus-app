import { TEAM } from '../../../constants/team'
import { Title } from '@landing/components/ui/Title'

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

export function TeamSection() {
  return (
    <section className="w-full bg-black py-6 md:py-12 lg:py-16">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-8">
        <div className="mb-12 text-center md:mb-16">
          <Title>Core Team</Title>
        </div>
        <div className="mb-16 grid gap-12 md:mb-20 md:grid-cols-3 md:gap-10 lg:gap-12">
          {TEAM.map((member, id) => (
            <div key={`${id}-photo`} className="flex flex-col items-center text-center">
              <div className="relative mb-4 aspect-square w-56 max-w-full shrink-0 overflow-hidden rounded-full border-2 border-white/15 bg-[#111] shadow-[0_0_0_1px_rgba(255,105,180,0.08)] sm:w-64 md:mb-5 md:w-72 lg:w-80">
                <img
                  src={member.photo}
                  alt={`${member.fullname} ${member.role}`}
                  className="h-full w-full object-cover"
                  width={320}
                  height={320}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="mt-1 flex max-w-[20rem] flex-col items-center gap-3">
                <div className="text-center font-mono text-sm leading-snug">
                  <p className="m-0 font-semibold text-white/85">{member.fullname}</p>
                  <p className="m-0 mt-1.5 text-xs font-normal tracking-wide text-white/55">{member.role}</p>
                </div>
                <a
                  href={member.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${member.fullname} on LinkedIn`}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/90 transition-colors hover:border-brand-pink/40 hover:bg-white/10 hover:text-brand-pink"
                >
                  <LinkedInIcon className="h-[18px] w-[18px]" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
