import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { ConnectWalletButton } from './ConnectWalletButton'
import { HeaderSettingsPopover } from './HeaderSettingsPopover'
import { BALANCE_COLUMN_ICONS } from './grai/graiPageIcons'
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

const LOCK_NAV_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

const UNLOCK_NAV_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
)

const LIQUIDATE_NAV_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </svg>
)

const REDEEM_NAV_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 12h8" />
  </svg>
)

const VOTE_NAV_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 12 2 2 4-4" />
    <path d="M5 7h14v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7z" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>
)

const BRIBE_NAV_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 12v10H4V12" />
    <path d="M2 7h20v5H2z" />
    <path d="M12 22V7" />
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
  </svg>
)

const CLAIM_NAV_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 19V5" />
    <path d="m5 12 7 7 7-7" />
  </svg>
)

const BUYBACK_NAV_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
)

const GRAI_NAV_ITEMS: { section: GraiSection; label: string; icon: ReactNode }[] = [
  { section: 'mint', label: 'Deposit', icon: MINT_NAV_ICON },
  { section: 'claim', label: 'Claim', icon: CLAIM_NAV_ICON },
  { section: 'lock', label: 'Lock', icon: LOCK_NAV_ICON },
  { section: 'unlock', label: 'Unlock', icon: UNLOCK_NAV_ICON },
  { section: 'assets', label: 'Assets', icon: BALANCE_COLUMN_ICONS.assets },
  { section: 'buyback', label: 'Buyback', icon: BUYBACK_NAV_ICON },
  { section: 'vote', label: 'Vote', icon: VOTE_NAV_ICON },
  { section: 'bribe', label: 'Bribe', icon: BRIBE_NAV_ICON },
  { section: 'auctions', label: 'Liquidate', icon: LIQUIDATE_NAV_ICON },
  { section: 'burn', label: 'Redeem', icon: REDEEM_NAV_ICON },
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

  const headerRef = useRef<HTMLElement>(null)
  const [navLockSpacerHeight, setNavLockSpacerHeight] = useState(0)

  useLayoutEffect(() => {
    if (!isMobileNavOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileNavOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)

    const scrollY = window.scrollY
    const headerHeight = headerRef.current?.offsetHeight ?? 0
    setNavLockSpacerHeight(headerHeight)

    const { style } = document.body
    const previous = {
      overflow: style.overflow,
      position: style.position,
      top: style.top,
      left: style.left,
      right: style.right,
      width: style.width,
    }

    style.overflow = 'hidden'
    style.position = 'fixed'
    style.top = `-${scrollY}px`
    style.left = '0'
    style.right = '0'
    style.width = '100%'

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      style.overflow = previous.overflow
      style.position = previous.position
      style.top = previous.top
      style.left = previous.left
      style.right = previous.right
      style.width = previous.width
      setNavLockSpacerHeight(0)
      window.scrollTo(0, scrollY)
    }
  }, [isMobileNavOpen])

  const handleGraiSectionClick = (section: GraiSection) => {
    setIsGraiMenuOpen(false)
    navigateToGraiSection(section)
  }

  return (
    <>
    <header
      ref={headerRef}
      className={`header${isMobileNavOpen ? ' is-nav-open' : ''}`}
    >
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
              <li className="header-nav-item header-nav-item--grinders">
                <NavLink
                  to="/grinders"
                  className={({ isActive }) =>
                    `header-nav-link header-nav-link--grinders${isActive ? ' is-current' : ''}`
                  }
                >
                  GRINDERS
                  <GraiUiCaret className="header-nav-caret header-nav-caret--right" />
                </NavLink>
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
            <li>
              <NavLink
                to="/grinders"
                className={({ isActive }) =>
                  `header-nav-link header-nav-link--grinders${isActive ? ' is-current' : ''}`
                }
                onClick={() => setIsMobileNavOpen(false)}
              >
                GRINDERS
                <GraiUiCaret className="header-nav-caret header-nav-caret--right" />
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
    {isMobileNavOpen ? (
      <div
        className="header-nav-lock-spacer"
        style={{ height: navLockSpacerHeight }}
        aria-hidden="true"
      />
    ) : null}
    </>
  )
}

export default Header
