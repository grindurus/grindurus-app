import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { ConnectWalletButton } from './ConnectWalletButton'
import { HeaderSettingsPopover } from './HeaderSettingsPopover'
import { GraiUiCaret } from './grai/GraiUiCaret'
import { navigateToGraiSection, type GraiSection } from '../utils/graiNavigation'
import { navigateToGrsSection, type GrsSection } from '../utils/grsNavigation'
import { navigateToAffiliatesSection, type AffiliatesSection } from '../utils/affiliatesNavigation'
import { useHeaderNavClicks } from '../hooks/useHeaderNavClicks'
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

const DISTRIBUTE_NAV_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="5" cy="6" r="2.25" />
    <circle cx="19" cy="6" r="2.25" />
    <circle cx="12" cy="18" r="2.25" />
    <path d="M7 7.5 10.5 15" />
    <path d="m17 7.5-3.5 7.5" />
  </svg>
)

const GRAI_NAV_ITEMS: { section: GraiSection; label: string; icon: ReactNode }[] = [
  { section: 'mint', label: 'Deposit', icon: MINT_NAV_ICON },
  { section: 'claim', label: 'Claim', icon: CLAIM_NAV_ICON },
  { section: 'lock', label: 'Lock', icon: LOCK_NAV_ICON },
  { section: 'unlock', label: 'Unlock', icon: UNLOCK_NAV_ICON },
  { section: 'assets', label: 'Distribute', icon: DISTRIBUTE_NAV_ICON },
  { section: 'vote', label: 'Vote', icon: VOTE_NAV_ICON },
  { section: 'bribe', label: 'Bribe', icon: BRIBE_NAV_ICON },
  { section: 'auctions', label: 'Liquidate', icon: LIQUIDATE_NAV_ICON },
]

const BRIDGE_NAV_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 17 17 7" />
    <path d="M7 7h10v10" />
  </svg>
)

const SALE_NAV_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="20" r="1.4" />
    <circle cx="18" cy="20" r="1.4" />
    <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 1.95-1.55L21 8H7" />
  </svg>
)

const GRANT_NAV_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="6.25" />
    <circle cx="12" cy="12" r="2.25" fill="currentColor" stroke="none" />
    <path d="M12 5.75v1.5M12 16.75v1.5M5.75 12h1.5M16.75 12h1.5" />
  </svg>
)

const GRS_NAV_ITEMS: { section: GrsSection; label: string; icon: ReactNode }[] = [
  { section: 'token-sale', label: 'Token Sale', icon: SALE_NAV_ICON },
  { section: 'bridge', label: 'Bridge', icon: BRIDGE_NAV_ICON },
  { section: 'vesting', label: 'Release', icon: UNLOCK_NAV_ICON },
  { section: 'vest', label: 'Vest', icon: LOCK_NAV_ICON },
  { section: 'grant', label: 'Grant', icon: GRANT_NAV_ICON },
  { section: 'sales', label: 'Sale', icon: SALE_NAV_ICON },
]

const ALLOCATE_NAV_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="6" cy="6" r="2" />
    <circle cx="18" cy="6" r="2" />
    <circle cx="12" cy="18" r="2" />
    <path d="M8 6h8" />
    <path d="M7.3 7.7l5.4 9.6" />
    <path d="M16.7 7.7l-5.4 9.6" />
  </svg>
)

const REGISTER_NAV_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="m9 15 2 2 4-4" />
  </svg>
)

const GRINDERS_NAV_ITEMS: { section: GraiSection; label: string; icon: ReactNode }[] = [
  { section: 'allocate', label: 'Allocate', icon: ALLOCATE_NAV_ICON },
  { section: 'deallocate', label: 'Deallocate', icon: CLAIM_NAV_ICON },
  { section: 'distribute', label: 'Distribute', icon: DISTRIBUTE_NAV_ICON },
  { section: 'confirm', label: 'Confirm', icon: VOTE_NAV_ICON },
  { section: 'liquidate', label: 'Liquidate', icon: LIQUIDATE_NAV_ICON },
  { section: 'custodian', label: 'Mint', icon: MINT_NAV_ICON },
  { section: 'register', label: 'Register', icon: REGISTER_NAV_ICON },
]

const LINK_NAV_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
)

const DASHBOARD_NAV_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
)

const AFFILIATES_NAV_ITEMS: { section: AffiliatesSection; label: string; icon: ReactNode }[] = [
  { section: 'link', label: 'Referral link', icon: LINK_NAV_ICON },
  { section: 'dashboard', label: 'Dashboard', icon: DASHBOARD_NAV_ICON },
  { section: 'program', label: 'Program', icon: REGISTER_NAV_ICON },
]

function HeaderNavPathButton({
  path,
  active,
  children,
  onClick,
}: {
  path: string
  active: boolean
  children: ReactNode
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
}) {
  return (
    <NavLink
      to={{ pathname: path, search: '', hash: '' }}
      data-app-path={path}
      className={`header-nav-link${active ? ' is-current' : ''}`}
      onClick={onClick}
    >
      {children}
    </NavLink>
  )
}

function Header() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const isBacktestActive = pathname.startsWith('/backtest')
  const isAffiliatesActive = pathname.startsWith('/affiliate')
  const isGraiActive = pathname.startsWith('/grai')
  const isGrindersActive = pathname.startsWith('/grinders')
  const isGrsActive = pathname.startsWith('/grs')
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [isAffiliatesMenuOpen, setIsAffiliatesMenuOpen] = useState(false)
  const [isGraiMenuOpen, setIsGraiMenuOpen] = useState(false)
  const [isGrindersMenuOpen, setIsGrindersMenuOpen] = useState(false)
  const [isGrsMenuOpen, setIsGrsMenuOpen] = useState(false)
  const mobileNavId = useId()
  const affiliatesMenuRef = useRef<HTMLLIElement>(null)
  const graiMenuRef = useRef<HTMLLIElement>(null)
  const grindersMenuRef = useRef<HTMLLIElement>(null)
  const grsMenuRef = useRef<HTMLLIElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const desktopNavTrackRef = useRef<HTMLDivElement>(null)
  const [navIndicator, setNavIndicator] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    visible: false,
  })
  const [navIndicatorReady, setNavIndicatorReady] = useState(false)

  useEffect(() => {
    setIsMobileNavOpen(false)
    setIsAffiliatesMenuOpen(false)
    setIsGraiMenuOpen(false)
    setIsGrindersMenuOpen(false)
    setIsGrsMenuOpen(false)
  }, [pathname])

  useLayoutEffect(() => {
    const track = desktopNavTrackRef.current
    if (!track) return

    const update = () => {
      const currentLink = track.querySelector<HTMLElement>('.header-nav-link.is-current')
      if (!currentLink) {
        setNavIndicator((prev) => ({ ...prev, visible: false }))
        return
      }
      const target = currentLink.closest('.header-nav-item--grai') ?? currentLink
      const trackRect = track.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const padX = 8
      const padY = 3
      setNavIndicator({
        left: targetRect.left - trackRect.left - padX,
        top: targetRect.top - trackRect.top - padY,
        width: targetRect.width + padX * 2,
        height: targetRect.height + padY * 2,
        visible: true,
      })
      requestAnimationFrame(() => setNavIndicatorReady(true))
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(track)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [pathname])

  useEffect(() => {
    if (!isAffiliatesMenuOpen && !isGraiMenuOpen && !isGrindersMenuOpen && !isGrsMenuOpen) return

    const onDocumentClick = (event: globalThis.MouseEvent) => {
      const target = event.target as Node
      if (!affiliatesMenuRef.current?.contains(target)) setIsAffiliatesMenuOpen(false)
      if (!graiMenuRef.current?.contains(target)) setIsGraiMenuOpen(false)
      if (!grindersMenuRef.current?.contains(target)) setIsGrindersMenuOpen(false)
      if (!grsMenuRef.current?.contains(target)) setIsGrsMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAffiliatesMenuOpen(false)
        setIsGraiMenuOpen(false)
        setIsGrindersMenuOpen(false)
        setIsGrsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocumentClick)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocumentClick)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isAffiliatesMenuOpen, isGraiMenuOpen, isGrindersMenuOpen, isGrsMenuOpen])

  const [navLockSpacerHeight, setNavLockSpacerHeight] = useState(74)

  useLayoutEffect(() => {
    const el = headerRef.current
    if (!el) return
    const update = () => setNavLockSpacerHeight(el.offsetHeight)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [isMobileNavOpen])

  useLayoutEffect(() => {
    if (!isMobileNavOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileNavOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)

    const scrollY = window.scrollY

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
      window.scrollTo(0, scrollY)
    }
  }, [isMobileNavOpen])

  const handleAffiliatesSectionClick = (section: AffiliatesSection) => {
    setIsAffiliatesMenuOpen(false)
    navigateToAffiliatesSection(section)
  }

  const handleGraiSectionClick = (section: GraiSection) => {
    setIsGraiMenuOpen(false)
    setIsGrindersMenuOpen(false)
    setIsAffiliatesMenuOpen(false)
    navigateToGraiSection(section)
  }

  const handleGrindersSectionClick = (section: GraiSection) => {
    setIsGrindersMenuOpen(false)
    navigateToGraiSection(section)
  }

  const handleGrsSectionClick = (section: GrsSection) => {
    setIsGrsMenuOpen(false)
    navigateToGrsSection(section)
  }

  const closeMenus = useCallback(() => {
    setIsAffiliatesMenuOpen(false)
    setIsGraiMenuOpen(false)
    setIsGrindersMenuOpen(false)
    setIsGrsMenuOpen(false)
    setIsMobileNavOpen(false)
  }, [])

  const goToPath = useCallback(
    (path: string) => {
      closeMenus()
      if (path === '/grai' && pathname.startsWith('/grai')) {
        navigateToGraiSection('mint')
        return
      }
      navigate({ pathname: path, search: '', hash: '' })
    },
    [closeMenus, navigate, pathname],
  )

  useHeaderNavClicks(headerRef, goToPath)

  return (
    <>
    {createPortal(
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
            <Link
              to="/"
              className="header-logo-text"
              onClick={() => setIsMobileNavOpen(false)}
            >
              GrindURUS
            </Link>
          </div>
        </div>
          <nav className="header-nav header-nav--desktop" aria-label="Product sections">
            <div className="header-nav-track" ref={desktopNavTrackRef}>
              <span
                className={`header-nav-indicator${navIndicator.visible ? ' is-visible' : ''}${navIndicatorReady ? ' is-ready' : ''}`}
                style={{
                  transform: `translate(${navIndicator.left}px, ${navIndicator.top}px)`,
                  width: navIndicator.width,
                  height: navIndicator.height,
                }}
                aria-hidden="true"
              />
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
                ref={affiliatesMenuRef}
                className={`header-nav-item header-nav-item--grai${isAffiliatesMenuOpen ? ' is-open' : ''}`}
              >
                <HeaderNavPathButton
                  path="/affiliate"
                  active={isAffiliatesActive}
                  onClick={closeMenus}
                >
                  AFFILIATES
                </HeaderNavPathButton>
                <button
                  type="button"
                  className={`header-nav-caret-btn${isAffiliatesMenuOpen ? ' is-open' : ''}`}
                  aria-expanded={isAffiliatesMenuOpen}
                  aria-haspopup="menu"
                  aria-label="AFFILIATES sections"
                  onClick={() => {
                    setIsGraiMenuOpen(false)
                    setIsGrindersMenuOpen(false)
                    setIsGrsMenuOpen(false)
                    setIsAffiliatesMenuOpen((open) => !open)
                  }}
                >
                  <GraiUiCaret className="header-nav-caret" />
                </button>
                <div
                  className={`header-nav-dropdown${isAffiliatesMenuOpen ? ' is-open' : ''}`}
                  role="menu"
                  aria-label="AFFILIATES sections"
                  aria-hidden={!isAffiliatesMenuOpen}
                  hidden={!isAffiliatesMenuOpen}
                >
                  {AFFILIATES_NAV_ITEMS.map((item) => (
                    <button
                      key={item.section}
                      type="button"
                      role="menuitem"
                      className="header-nav-dropdown-item"
                      onClick={() => handleAffiliatesSectionClick(item.section)}
                    >
                      <span className="header-nav-dropdown-item-icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </li>
              <li
                ref={graiMenuRef}
                className={`header-nav-item header-nav-item--grai${isGraiMenuOpen ? ' is-open' : ''}`}
              >
                <HeaderNavPathButton
                  path="/grai"
                  active={isGraiActive}
                  onClick={(event) => {
                    closeMenus()
                    if (pathname.startsWith('/grai')) {
                      event.preventDefault()
                      navigateToGraiSection('mint')
                    }
                  }}
                >
                  GRAI
                </HeaderNavPathButton>
                <button
                  type="button"
                  className={`header-nav-caret-btn${isGraiMenuOpen ? ' is-open' : ''}`}
                  aria-expanded={isGraiMenuOpen}
                  aria-haspopup="menu"
                  aria-label="GRAI sections"
                  onClick={() => {
                    setIsAffiliatesMenuOpen(false)
                    setIsGrsMenuOpen(false)
                    setIsGrindersMenuOpen(false)
                    setIsGraiMenuOpen((open) => !open)
                  }}
                >
                  <GraiUiCaret className="header-nav-caret" />
                </button>
                <div
                  className={`header-nav-dropdown${isGraiMenuOpen ? ' is-open' : ''}`}
                  role="menu"
                  aria-label="GRAI sections"
                  aria-hidden={!isGraiMenuOpen}
                  hidden={!isGraiMenuOpen}
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
              <li
                ref={grindersMenuRef}
                className={`header-nav-item header-nav-item--grai${isGrindersMenuOpen ? ' is-open' : ''}`}
              >
                <HeaderNavPathButton
                  path="/grinders"
                  active={isGrindersActive}
                  onClick={closeMenus}
                >
                  GRINDERS
                </HeaderNavPathButton>
                <button
                  type="button"
                  className={`header-nav-caret-btn${isGrindersMenuOpen ? ' is-open' : ''}`}
                  aria-expanded={isGrindersMenuOpen}
                  aria-haspopup="menu"
                  aria-label="GRINDERS sections"
                  onClick={() => {
                    setIsAffiliatesMenuOpen(false)
                    setIsGraiMenuOpen(false)
                    setIsGrsMenuOpen(false)
                    setIsGrindersMenuOpen((open) => !open)
                  }}
                >
                  <GraiUiCaret className="header-nav-caret" />
                </button>
                <div
                  className={`header-nav-dropdown${isGrindersMenuOpen ? ' is-open' : ''}`}
                  role="menu"
                  aria-label="GRINDERS sections"
                  aria-hidden={!isGrindersMenuOpen}
                  hidden={!isGrindersMenuOpen}
                >
                  {GRINDERS_NAV_ITEMS.map((item) => (
                    <button
                      key={item.section}
                      type="button"
                      role="menuitem"
                      className="header-nav-dropdown-item"
                      onClick={() => handleGrindersSectionClick(item.section)}
                    >
                      <span className="header-nav-dropdown-item-icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </li>
              <li
                ref={grsMenuRef}
                className={`header-nav-item header-nav-item--grai${isGrsMenuOpen ? ' is-open' : ''}`}
              >
                <HeaderNavPathButton
                  path="/grs"
                  active={isGrsActive}
                  onClick={closeMenus}
                >
                  GRS
                </HeaderNavPathButton>
                <button
                  type="button"
                  className={`header-nav-caret-btn${isGrsMenuOpen ? ' is-open' : ''}`}
                  aria-expanded={isGrsMenuOpen}
                  aria-haspopup="menu"
                  aria-label="GRS sections"
                  onClick={() => {
                    setIsAffiliatesMenuOpen(false)
                    setIsGraiMenuOpen(false)
                    setIsGrindersMenuOpen(false)
                    setIsGrsMenuOpen((open) => !open)
                  }}
                >
                  <GraiUiCaret className="header-nav-caret" />
                </button>
                <div
                  className={`header-nav-dropdown${isGrsMenuOpen ? ' is-open' : ''}`}
                  role="menu"
                  aria-label="GRS sections"
                  aria-hidden={!isGrsMenuOpen}
                  hidden={!isGrsMenuOpen}
                >
                  {GRS_NAV_ITEMS.map((item) => (
                    <button
                      key={item.section}
                      type="button"
                      role="menuitem"
                      className="header-nav-dropdown-item"
                      onClick={() => handleGrsSectionClick(item.section)}
                    >
                      <span className="header-nav-dropdown-item-icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </li>
            </ul>
            </div>
          </nav>
        <div className="header-actions">
          <div className="header-wallet-cluster">
            <ConnectWalletButton />
            <HeaderSettingsPopover />
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
              <HeaderNavPathButton
                path="/affiliate"
                active={isAffiliatesActive}
                onClick={closeMenus}
              >
                AFFILIATES
              </HeaderNavPathButton>
            </li>
            <li>
              <HeaderNavPathButton
                path="/grai"
                active={isGraiActive}
                onClick={(event) => {
                  closeMenus()
                  if (pathname.startsWith('/grai')) {
                    event.preventDefault()
                    navigateToGraiSection('mint')
                  }
                }}
              >
                GRAI
              </HeaderNavPathButton>
            </li>
            <li>
              <HeaderNavPathButton
                path="/grinders"
                active={isGrindersActive}
                onClick={closeMenus}
              >
                GRINDERS
              </HeaderNavPathButton>
            </li>
            <li>
              <HeaderNavPathButton
                path="/grs"
                active={isGrsActive}
                onClick={closeMenus}
              >
                GRS
              </HeaderNavPathButton>
            </li>
            {isAffiliatesActive
              ? AFFILIATES_NAV_ITEMS.map((item) => (
                  <li key={item.section}>
                    <button
                      type="button"
                      className="header-nav-link header-mobile-nav-sublink"
                      onClick={() => {
                        setIsMobileNavOpen(false)
                        handleAffiliatesSectionClick(item.section)
                      }}
                    >
                      <span className="header-nav-dropdown-item-icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  </li>
                ))
              : null}
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
            {isGrindersActive
              ? GRINDERS_NAV_ITEMS.map((item) => (
                  <li key={item.section}>
                    <button
                      type="button"
                      className="header-nav-link header-mobile-nav-sublink"
                      onClick={() => {
                        setIsMobileNavOpen(false)
                        handleGrindersSectionClick(item.section)
                      }}
                    >
                      <span className="header-nav-dropdown-item-icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  </li>
                ))
              : null}
            {isGrsActive
              ? GRS_NAV_ITEMS.map((item) => (
                  <li key={item.section}>
                    <button
                      type="button"
                      className="header-nav-link header-mobile-nav-sublink"
                      onClick={() => {
                        setIsMobileNavOpen(false)
                        handleGrsSectionClick(item.section)
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
    </header>,
    document.body,
    )}
    <div
      className="header-nav-lock-spacer"
      style={{ height: navLockSpacerHeight }}
      aria-hidden="true"
    />
    </>
  )
}

export default Header
