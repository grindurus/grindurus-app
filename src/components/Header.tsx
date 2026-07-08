import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { ConnectWalletButton } from './ConnectWalletButton'
import { HeaderSettingsPopover } from './HeaderSettingsPopover'
import { BALANCE_COLUMN_ICONS, GRINDERS_COLUMN_ICONS } from './grai/graiPageIcons'
import { GraiUiCaret } from './grai/GraiUiCaret'
import { navigateToGraiSection, type GraiSection } from '../utils/graiNavigation'
import { assetUrl } from '../utils/appPaths'
import './Header.css'

const MINT_NAV_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v8" />
    <path d="M8 12h8" />
  </svg>
)

const REDEEM_NAV_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 12h8" />
  </svg>
)

const DISTRIBUTE_NAV_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="6" cy="12" r="2" />
    <circle cx="18" cy="6" r="2" />
    <circle cx="18" cy="18" r="2" />
    <path d="M8 12h4" />
    <path d="M12 12l5-5" />
    <path d="M12 12l5 5" />
  </svg>
)

const GRAI_NAV_ITEMS: { section: GraiSection; label: string; icon: ReactNode }[] = [
  { section: 'mint', label: 'Mint', icon: MINT_NAV_ICON },
  { section: 'burn', label: 'Redeem', icon: REDEEM_NAV_ICON },
  { section: 'assets', label: 'Assets', icon: BALANCE_COLUMN_ICONS.assets },
  { section: 'grinders', label: 'Grinders', icon: GRINDERS_COLUMN_ICONS.network },
  { section: 'allocate', label: 'Allocate', icon: BALANCE_COLUMN_ICONS.allocated },
  { section: 'distribute', label: 'Distribute', icon: DISTRIBUTE_NAV_ICON },
]

function Header() {
  const { pathname } = useLocation()
  const isBacktestActive = pathname.startsWith('/backtest')
  const isGraiActive = pathname.startsWith('/grai')
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [isGraiMenuOpen, setIsGraiMenuOpen] = useState(false)
  const mobileNavId = useId()
  const graiMenuRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    setIsMobileNavOpen(false)
    setIsGraiMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!isGraiMenuOpen) return

    const onDocumentClick = (event: MouseEvent) => {
      if (graiMenuRef.current?.contains(event.target as Node)) return
      setIsGraiMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsGraiMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocumentClick)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocumentClick)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isGraiMenuOpen])

  useEffect(() => {
    if (!isMobileNavOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileNavOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isMobileNavOpen])

  const handleGraiSectionClick = (section: GraiSection) => {
    setIsGraiMenuOpen(false)
    navigateToGraiSection(section)
  }

  return (
    <header className={`header${isMobileNavOpen ? ' is-nav-open' : ''}`}>
      <div className="header-container">
        <div className="header-left">
          <div className="header-brand">
            <Link to="/" className="header-logo" onClick={() => setIsMobileNavOpen(false)}>
              <img src={assetUrl('logo.png')} alt="" className="header-logo-img" />
            </Link>
            <button
              type="button"
              className="header-menu-btn"
              aria-expanded={isMobileNavOpen}
              aria-controls={mobileNavId}
              aria-label={isMobileNavOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setIsMobileNavOpen((open) => !open)}
            >
              {isMobileNavOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
            <Link
              to="/"
              className="header-logo-text"
              onClick={() => setIsMobileNavOpen(false)}
            >
              GrindURUS
            </Link>
          </div>
          <nav className="header-nav header-nav--desktop" aria-label="Product sections">
            <ul className="header-nav-list">
              <li>
                <span
                  className={`header-nav-link is-disabled${isBacktestActive ? ' is-current' : ''}`}
                  aria-disabled="true"
                >
                  Backtest (soon)
                </span>
              </li>
              <li
                ref={graiMenuRef}
                className={`header-nav-item header-nav-item--grai${isGraiMenuOpen ? ' is-open' : ''}`}
              >
                <NavLink
                  to="/grai"
                  className={({ isActive }) => `header-nav-link${isActive ? ' is-current' : ''}`}
                >
                  GRAI
                </NavLink>
                <button
                  type="button"
                  className={`header-nav-caret-btn${isGraiMenuOpen ? ' is-open' : ''}`}
                  aria-expanded={isGraiMenuOpen}
                  aria-haspopup="menu"
                  aria-label="GRAI sections"
                  onClick={() => setIsGraiMenuOpen((open) => !open)}
                >
                  <GraiUiCaret className="header-nav-caret" />
                </button>
                <div
                  className={`header-nav-dropdown${isGraiMenuOpen ? ' is-open' : ''}`}
                  role="menu"
                  aria-label="GRAI sections"
                  aria-hidden={!isGraiMenuOpen}
                >
                  {GRAI_NAV_ITEMS.map((item) => (
                    <button
                      key={item.section}
                      type="button"
                      role="menuitem"
                      className="header-nav-dropdown-item"
                      onClick={() => handleGraiSectionClick(item.section)}
                    >
                      <span className="header-nav-dropdown-item-icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </li>
            </ul>
          </nav>
        </div>
        <div className="header-actions">
          <div className="header-wallet-cluster">
            <ConnectWalletButton />
            <HeaderSettingsPopover />
          </div>
        </div>
      </div>

      <div
        className={`header-mobile-nav${isMobileNavOpen ? ' is-open' : ''}`}
        id={mobileNavId}
        aria-hidden={!isMobileNavOpen}
      >
        <nav aria-label="Product sections">
          <ul className="header-mobile-nav-list">
            <li>
              <span
                className={`header-nav-link is-disabled${isBacktestActive ? ' is-current' : ''}`}
                aria-disabled="true"
              >
                Backtest (soon)
              </span>
            </li>
            <li>
              <NavLink
                to="/grai"
                className={({ isActive }) => `header-nav-link${isActive ? ' is-current' : ''}`}
                onClick={() => setIsMobileNavOpen(false)}
              >
                GRAI
              </NavLink>
            </li>
            {isGraiActive
              ? GRAI_NAV_ITEMS.map((item) => (
                  <li key={item.section}>
                    <button
                      type="button"
                      className="header-nav-link header-mobile-nav-sublink"
                      onClick={() => {
                        setIsMobileNavOpen(false)
                        handleGraiSectionClick(item.section)
                      }}
                    >
                      <span className="header-nav-dropdown-item-icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  </li>
                ))
              : null}
          </ul>
        </nav>
      </div>

      {isMobileNavOpen ? (
        <button
          type="button"
          className="header-mobile-backdrop"
          aria-label="Close menu"
          onClick={() => setIsMobileNavOpen(false)}
        />
      ) : null}
    </header>
  )
}

export default Header
