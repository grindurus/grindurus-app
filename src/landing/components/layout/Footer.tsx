import { Link } from 'react-router-dom'

const SOCIAL_LINKS = [
  { href: 'https://x.com/grindurus', icon: 'x', label: 'X' },
  { href: 'https://github.com/grindurus', icon: 'github', label: 'GitHub' },
  { href: 'https://docs.grindurus.xyz', icon: 'docs', label: 'Documentation' },
]

function SocialIcons() {
  return (
    <div className="flex items-center gap-4">
      {SOCIAL_LINKS.map(({ href, icon, label }) => (
        <a
          key={icon}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className="w-9 h-9 rounded-full bg-black/10 dark:bg-white/90 text-black flex items-center justify-center transition-all duration-200 hover:opacity-90 hover:scale-105"
        >
          {icon === 'x' && (
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          )}
          {icon === 'github' && (
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
          )}
          {icon === 'docs' && (
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path
                fillRule="evenodd"
                d="M4 4a2 2 0 012-2h8.586A2 2 0 0116 2.586L19.414 6A2 2 0 0120 7.414V20a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </a>
      ))}
    </div>
  )
}

const FOOTER_CHART_FILL_ID = 'grindurus-footer-yield-fill'
const FOOTER_CHART_STROKE_ID = 'grindurus-footer-yield-stroke'

export default function Footer() {
  return (
    <footer className="relative mt-auto overflow-hidden border-t border-black/15 bg-[#e8e8e8] py-10 dark:border-white/15 dark:bg-black">
      <div
        className="pointer-events-none absolute bottom-0 left-0 hidden h-[300px] w-full xl:block"
        aria-hidden
      >
        <svg viewBox="0 0 1200 300" className="h-full w-full" fill="none" preserveAspectRatio="none">
          <defs>
            <linearGradient id={FOOTER_CHART_FILL_ID} x1="600" y1="40" x2="600" y2="300" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ff69b4" stopOpacity="0.12" />
              <stop offset="1" stopColor="#ff1493" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={FOOTER_CHART_STROKE_ID} x1="0" y1="0" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ff69b4" stopOpacity="0.5" />
              <stop offset="1" stopColor="#ff1493" stopOpacity="0.5" />
            </linearGradient>
          </defs>
          <line x1="0" y1="95" x2="1200" y2="95" className="stroke-black/[0.05] dark:stroke-white/[0.06]" strokeWidth="1" />
          <line x1="0" y1="165" x2="1200" y2="165" className="stroke-black/[0.05] dark:stroke-white/[0.06]" strokeWidth="1" />
          <line x1="0" y1="235" x2="1200" y2="235" className="stroke-black/[0.05] dark:stroke-white/[0.06]" strokeWidth="1" />
          <path
            d="M0 228 C200 218 360 198 540 168 S880 98 1200 70 L1200 300 L0 300 Z"
            fill={`url(#${FOOTER_CHART_FILL_ID})`}
          />
          <path
            d="M0 228 C200 218 360 198 540 168 S880 98 1200 70"
            stroke={`url(#${FOOTER_CHART_STROKE_ID})`}
            strokeLinecap="round"
            strokeWidth="2"
          />
          <path
            d="M0 198 C260 208 420 178 640 188 S920 158 1200 145"
            className="stroke-black/[0.14] dark:stroke-white/[0.12]"
            strokeDasharray="5 6"
            strokeLinecap="round"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      <div className="relative z-10 mx-auto flex max-w-[1280px] flex-col items-end gap-8 px-8 sm:flex-row sm:items-end sm:justify-between">
        <Link to="/" className="order-2 shrink-0 self-start no-underline sm:order-1 sm:self-end" aria-label="GrindURUS home">
          <span
            className="inline-block whitespace-nowrap font-mono text-3xl font-semibold uppercase tracking-wide text-transparent bg-shimmer-size bg-clip-text animate-shimmer sm:text-4xl md:text-5xl"
            style={{ backgroundImage: 'linear-gradient(90deg, #ff69b4, #ffffff, #ff1493, #ffffff, #ff69b4)' }}
          >
            GrindURUS
          </span>
        </Link>
        <div className="order-1 flex flex-col items-end gap-3 sm:order-2">
          <p className="m-0 font-mono text-sm text-[#1a1a1a]/85 dark:text-white/85">© GrindURUS 2026. All rights reserved.</p>
          <SocialIcons />
        </div>
      </div>
    </footer>
  )
}
