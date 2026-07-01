import { useEffect, useRef, useState } from 'react'
import { ThemeToggle } from './ThemeToggle'
import { ConnectWalletButton } from './ConnectWalletButton'
import { assetUrl } from '../utils/appPaths'
import {
  navigateToGraiSection,
  readGraiSectionFromHash,
  type GraiSection,
} from '../utils/graiNavigation'
import './Header.css'

const MAIN_APP_URL = import.meta.env.VITE_MAIN_APP_URL || '/'

export type HeaderMainView = 'grai' | 'backtest'

interface HeaderProps {
  activeView: HeaderMainView
  onViewChange: (view: HeaderMainView) => void
}

const GRAI_MINT_MENU_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 12h8" />
    <path d="M12 8v8" />
  </svg>
)

const GRAI_BURN_MENU_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </svg>
)

const GRAI_ASSET_MENU_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <ellipse cx="12" cy="7" rx="8" ry="3" />
    <path d="M4 7v4c0 1.7 3.6 3 8 3s8-1.3 8-3V7" />
    <path d="M4 11v4c0 1.7 3.6 3 8 3s8-1.3 8-3v-4" />
  </svg>
)

const GRAI_GRINDERS_MENU_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="6" cy="6" r="2" />
    <circle cx="18" cy="6" r="2" />
    <circle cx="12" cy="18" r="2" />
    <path d="M8 6h8" />
    <path d="M7.3 7.7l5.4 9.6" />
    <path d="M16.7 7.7l-5.4 9.6" />
  </svg>
)

const GRAI_ALLOCATE_MENU_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="6" cy="6" r="2" />
    <circle cx="18" cy="6" r="2" />
    <circle cx="12" cy="18" r="2" />
    <path d="M8 6h8" />
    <path d="M7.3 7.7l5.4 9.6" />
    <path d="M16.7 7.7l-5.4 9.6" />
  </svg>
)

const GRAI_DISTRIBUTE_MENU_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M14 7h7v7" />
  </svg>
)

const BACKTEST_MENU_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 3v18h18" />
    <path d="M7 16l4-6 4 3 5-7" />
  </svg>
)

const GRAI_SECTIONS: { section: GraiSection; label: string; icon: JSX.Element }[] = [
  { section: 'grinders', label: 'Grinders', icon: GRAI_GRINDERS_MENU_ICON },
  { section: 'mint', label: 'MINT', icon: GRAI_MINT_MENU_ICON },
  { section: 'burn', label: 'BURN', icon: GRAI_BURN_MENU_ICON },
  { section: 'assets', label: 'ASSETS', icon: GRAI_ASSET_MENU_ICON },
  { section: 'allocate', label: 'ALLOCATE', icon: GRAI_ALLOCATE_MENU_ICON },
  { section: 'distribute', label: 'DISTRIBUTE', icon: GRAI_DISTRIBUTE_MENU_ICON },
]

interface GraiMenuItemsProps {
  isGraiPage: boolean
  graiSection: GraiSection | null
  onSectionClick: (section: GraiSection) => void
}

function GraiMenuItems({ isGraiPage, graiSection, onSectionClick }: GraiMenuItemsProps) {
  return (
    <>
      {GRAI_SECTIONS.map(({ section, label, icon }) => (
        <button
          key={section}
          type="button"
          role="menuitem"
          className={`header-nav-grai-dropdown-item ${isGraiPage && graiSection === section ? 'is-active' : ''}`}
          onClick={() => onSectionClick(section)}
        >
          <span className="header-nav-grai-dropdown-item-icon" aria-hidden="true">
            {icon}
          </span>
          {label}
        </button>
      ))}
    </>
  )
}

function Header({ activeView, onViewChange }: HeaderProps) {
  const [graiMenuOpen, setGraiMenuOpen] = useState(false)
  const [mobileGraiOpen, setMobileGraiOpen] = useState(false)
  const [graiSection, setGraiSection] = useState<GraiSection | null>(() => readGraiSectionFromHash())
  const graiMenuRef = useRef<HTMLDivElement>(null)
  const mobileGraiRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!graiMenuOpen) return
    const onDocumentClick = (event: MouseEvent) => {
      if (graiMenuRef.current?.contains(event.target as Node)) return
      setGraiMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocumentClick)
    return () => document.removeEventListener('mousedown', onDocumentClick)
  }, [graiMenuOpen])

  useEffect(() => {
    if (!mobileGraiOpen) return
    const onDocumentClick = (event: MouseEvent) => {
      if (mobileGraiRef.current?.contains(event.target as Node)) return
      setMobileGraiOpen(false)
    }
    document.addEventListener('mousedown', onDocumentClick)
    return () => document.removeEventListener('mousedown', onDocumentClick)
  }, [mobileGraiOpen])

  useEffect(() => {
    const syncGraiSection = () => setGraiSection(readGraiSectionFromHash())
    window.addEventListener('hashchange', syncGraiSection)
    window.addEventListener('popstate', syncGraiSection)
    window.addEventListener('grai-section-nav', syncGraiSection)
    return () => {
      window.removeEventListener('hashchange', syncGraiSection)
      window.removeEventListener('popstate', syncGraiSection)
      window.removeEventListener('grai-section-nav', syncGraiSection)
    }
  }, [])

  const handleGraiSectionClick = (section: GraiSection) => {
    setGraiMenuOpen(false)
    setMobileGraiOpen(false)
    navigateToGraiSection(section, () => onViewChange('grai'))
  }

  const isGraiPage = activeView === 'grai'

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-left">
          <a href={MAIN_APP_URL} className="header-logo" style={{ textDecoration: 'none' }}>
            <img src={assetUrl('logo.png')} alt="GrindURUS" className="header-logo-img" />
          </a>
          <div
            ref={mobileGraiRef}
            className={`header-grai-burger-wrap ${isGraiPage ? 'is-active' : ''}`}
          >
            <button
              type="button"
              className={`header-grai-burger ${mobileGraiOpen ? 'is-open' : ''}`}
              onClick={() => setMobileGraiOpen((open) => !open)}
              aria-expanded={mobileGraiOpen}
              aria-haspopup="menu"
              aria-label="GRAI menu"
            >
              <span className="header-grai-burger-lines" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span className="header-grai-burger-label">GRAI</span>
            </button>
            <div
              className={`header-grai-mobile-menu ${mobileGraiOpen ? 'is-open' : ''}`}
              role="menu"
              aria-label="GRAI"
            >
              <button
                type="button"
                role="menuitem"
                className="header-nav-grai-dropdown-item header-grai-mobile-backtest"
                disabled
              >
                <span className="header-nav-grai-dropdown-item-icon" aria-hidden="true">
                  {BACKTEST_MENU_ICON}
                </span>
                BACKTEST (SOON)
              </button>
              <button
                type="button"
                role="menuitem"
                className={`header-nav-grai-dropdown-item header-grai-mobile-home ${isGraiPage && !graiSection ? 'is-active' : ''}`}
                onClick={() => {
                  setMobileGraiOpen(false)
                  onViewChange('grai')
                }}
              >
                GRAI Home
              </button>
              <GraiMenuItems
                isGraiPage={isGraiPage}
                graiSection={graiSection}
                onSectionClick={handleGraiSectionClick}
              />
            </div>
          </div>
          <nav className="header-nav" aria-label="Product sections">
            <button
              type="button"
              className="header-nav-btn"
              disabled
            >
              BACKTEST (SOON)
            </button>
            <div
              ref={graiMenuRef}
              className={`header-nav-grai ${activeView === 'grai' ? 'is-active' : ''}`}
            >
              <div className="header-nav-grai-menu-wrap">
                <button
                  type="button"
                  className={`header-nav-grai-toggle ${graiMenuOpen ? 'is-open' : ''}`}
                  onClick={() => setGraiMenuOpen((open) => !open)}
                  aria-expanded={graiMenuOpen}
                  aria-haspopup="menu"
                  aria-label="GRAI menu"
                >
                  <span className="header-grai-burger-lines" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                </button>
                <button
                  type="button"
                  className="header-nav-grai-label"
                  onClick={() => {
                    setGraiMenuOpen(false)
                    onViewChange('grai')
                  }}
                >
                  GRAI
                </button>
                <div
                  className={`header-nav-grai-dropdown ${graiMenuOpen ? 'is-open' : ''}`}
                  role="menu"
                  aria-label="GRAI"
                >
                  <GraiMenuItems
                    isGraiPage={isGraiPage}
                    graiSection={graiSection}
                    onSectionClick={handleGraiSectionClick}
                  />
                </div>
              </div>
            </div>
          </nav>
        </div>
        <div className="header-actions">
          {MAIN_APP_URL !== '/' && (
            <a href={MAIN_APP_URL} className="my-grinders-btn" style={{ textDecoration: 'none' }}>
              ← GrindURUS
            </a>
          )}
          <ConnectWalletButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

export default Header
