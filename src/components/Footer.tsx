import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { assetUrl } from '../utils/appPaths'
import './Footer.css'

const DOCS_URL = 'https://docs.grindurus.xyz'
const TWITTER_URL = 'https://x.com/grindurus'
const GITHUB_URL = 'https://github.com/grindurus'

const FOOTER_X_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
)

const FOOTER_GITHUB_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
)

type FooterLinkItem = {
  key: string
  label: string
  icon: ReactNode
  href: string
  /** When true, only the icon is shown; `label` is used for aria-label. */
  iconOnly?: boolean
}

const FOOTER_SOCIAL_ITEMS: FooterLinkItem[] = [
  { key: 'x', label: 'X', href: TWITTER_URL, icon: FOOTER_X_ICON, iconOnly: true },
  { key: 'github', label: 'GitHub', href: GITHUB_URL, icon: FOOTER_GITHUB_ICON, iconOnly: true },
  { key: 'docs', label: 'Docs', href: DOCS_URL, icon: <BookOpen aria-hidden="true" /> },
]

function FooterLink({ item }: { item: FooterLinkItem }) {
  return (
    <a
      href={item.href}
      className={`app-footer-link${item.iconOnly ? ' app-footer-link--icon-only' : ''}`}
      target="_blank"
      rel="noreferrer"
      aria-label={item.iconOnly ? item.label : undefined}
    >
      <span className="app-footer-link-icon">{item.icon}</span>
      {item.iconOnly ? null : <span>{item.label}</span>}
    </a>
  )
}

function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="app-footer">
      <div className="app-footer-container">
        <div className="app-footer-top">
          <div className="app-footer-logo-row">
            <Link to="/grai" className="app-footer-logo">
              <img src={assetUrl('logo.png')} alt="" className="app-footer-logo-img" width={32} height={32} />
              <span className="app-footer-logo-text">GrindURUS</span>
            </Link>
            <span className="app-footer-copyright">© {year} All rights reserved</span>
          </div>

          <div className="app-footer-social">
            {FOOTER_SOCIAL_ITEMS.map((item) => (
              <FooterLink key={item.key} item={item} />
            ))}
          </div>
        </div>

        <p className="app-footer-tagline">Passive access to volatility harvesting.</p>
      </div>
    </footer>
  )
}

export default Footer
