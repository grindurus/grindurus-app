import { useEffect, useRef, useState } from 'react'
import { ThemeToggle } from './ThemeToggle'
import { ConnectWalletButton } from './ConnectWalletButton'
import { navigateTo } from '../utils/navigate'
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
  isGraiManage?: boolean
}

const GRAI_MENU_CHEVRON = (
  <svg
    className="header-nav-grai-toggle-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
)

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

const GRAI_MANAGE_MENU_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v2" />
    <path d="M12 21v2" />
    <path d="M4.22 4.22l1.42 1.42" />
    <path d="M18.36 18.36l1.42 1.42" />
    <path d="M1 12h2" />
    <path d="M21 12h2" />
    <path d="M4.22 19.78l1.42-1.42" />
    <path d="M18.36 5.64l1.42-1.42" />
  </svg>
)

function Header({ activeView, onViewChange, isGraiManage = false }: HeaderProps) {
  const [graiMenuOpen, setGraiMenuOpen] = useState(false)
  const [graiSection, setGraiSection] = useState<GraiSection | null>(() => readGraiSectionFromHash())
  const graiMenuRef = useRef<HTMLDivElement>(null)

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
    navigateToGraiSection(section, () => onViewChange('grai'))
  }

  const handleManageClick = () => {
    navigateTo('/grai/manage')
    setGraiMenuOpen(false)
  }

  const isGraiPage = activeView === 'grai' && !isGraiManage

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-left">
          <a href={MAIN_APP_URL} className="header-logo" style={{ textDecoration: 'none' }}>
            <img src={assetUrl('logo.png')} alt="GrindURUS" className="header-logo-img" />
          </a>
          <nav className="header-nav" aria-label="Product sections">
            <button
              type="button"
              className={`header-nav-btn ${activeView === 'backtest' ? 'is-active' : ''}`}
              onClick={() => onViewChange('backtest')}
            >
              BACKTEST
            </button>
            <div
              ref={graiMenuRef}
              className={`header-nav-grai ${activeView === 'grai' ? 'is-active' : ''}`}
            >
              <div className="header-nav-grai-menu-wrap">
                <button
                  type="button"
                  className={`header-nav-grai-toggle ${graiMenuOpen ? '' : 'is-collapsed'}`}
                  onClick={() => setGraiMenuOpen((open) => !open)}
                  aria-expanded={graiMenuOpen}
                  aria-haspopup="menu"
                  aria-label="GRAI menu"
                >
                  {GRAI_MENU_CHEVRON}
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
                  <button
                    type="button"
                    role="menuitem"
                    className={`header-nav-grai-dropdown-item ${isGraiPage && graiSection === 'grinders' ? 'is-active' : ''}`}
                    onClick={() => handleGraiSectionClick('grinders')}
                  >
                    <span className="header-nav-grai-dropdown-item-icon" aria-hidden="true">
                      {GRAI_GRINDERS_MENU_ICON}
                    </span>
                    Grinders
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={`header-nav-grai-dropdown-item ${isGraiPage && graiSection === 'mint' ? 'is-active' : ''}`}
                    onClick={() => handleGraiSectionClick('mint')}
                  >
                    <span className="header-nav-grai-dropdown-item-icon" aria-hidden="true">
                      {GRAI_MINT_MENU_ICON}
                    </span>
                    MINT
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={`header-nav-grai-dropdown-item ${isGraiPage && graiSection === 'burn' ? 'is-active' : ''}`}
                    onClick={() => handleGraiSectionClick('burn')}
                  >
                    <span className="header-nav-grai-dropdown-item-icon" aria-hidden="true">
                      {GRAI_BURN_MENU_ICON}
                    </span>
                    BURN
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={`header-nav-grai-dropdown-item ${isGraiPage && graiSection === 'assets' ? 'is-active' : ''}`}
                    onClick={() => handleGraiSectionClick('assets')}
                  >
                    <span className="header-nav-grai-dropdown-item-icon" aria-hidden="true">
                      {GRAI_ASSET_MENU_ICON}
                    </span>
                    ASSETS
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={`header-nav-grai-dropdown-item ${isGraiManage ? 'is-active' : ''}`}
                    onClick={handleManageClick}
                  >
                    <span className="header-nav-grai-dropdown-item-icon" aria-hidden="true">
                      {GRAI_MANAGE_MENU_ICON}
                    </span>
                    MANAGE
                  </button>
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
