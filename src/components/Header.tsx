import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { ConnectWalletButton } from './ConnectWalletButton'
import { HeaderSettingsPopover } from './HeaderSettingsPopover'
import { GraiUiCaret } from './grai/GraiUiCaret'
import { navigateToGraiSection, resetGraiLiquidateView, resetGraiMintToDeposit, type GraiSection } from '../utils/graiNavigation'
import { navigateToAffiliatesSection, type AffiliatesSection } from '../utils/affiliatesNavigation'
import { navigateToBacktestSection, type BacktestSection } from '../utils/backtestNavigation'
import { useEvmWallet } from '../wallets/useEvmWallet'
import { useWalletContext } from '../wallets/walletContext'
import { isTestnetEvmChainId, preferredEvmChainId } from '../wallets/networkEnv'
import { isGrsTestnetPinned } from '../grs/networkEnvPin'
import { assetUrl, stripBasePath, toAppPath } from '../utils/appPaths'
import './Header.css'

const CREATE_NAV_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8" />
    <path d="M8 12h8" />
  </svg>
)

const PRIORITY_NAV_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7L12 16.8 5.7 20.6 8 13.6 2 9.2h7.6L12 2z" />
  </svg>
)

const QUEUE_NAV_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="6" cy="7" r="2.25" />
    <circle cx="6" cy="12" r="2.25" />
    <circle cx="6" cy="17" r="2.25" />
    <path d="M11 7h9" />
    <path d="M11 12h9" />
    <path d="M11 17h9" />
  </svg>
)

const RESULTS_NAV_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 19V5" />
    <path d="M4 19h16" />
    <path d="M8 15v-4" />
    <path d="M12 15V8" />
    <path d="M16 15v-6" />
  </svg>
)

const BACKTEST_NAV_ITEMS: { section: BacktestSection; label: string; icon: ReactNode }[] = [
  { section: 'create', label: 'Create', icon: CREATE_NAV_ICON },
  { section: 'priority', label: 'Priority', icon: PRIORITY_NAV_ICON },
  { section: 'queue', label: 'Queue', icon: QUEUE_NAV_ICON },
  { section: 'results', label: 'Results', icon: RESULTS_NAV_ICON },
]

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

const SWAP_NAV_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 3h5v5" />
    <path d="M8 21H3v-5" />
    <path d="M21 3 14 10" />
    <path d="m3 21 7-7" />
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
  { section: 'distribute', label: 'Distribute', icon: DISTRIBUTE_NAV_ICON },
  { section: 'vote', label: 'Vote', icon: VOTE_NAV_ICON },
  { section: 'bribe', label: 'Bribe', icon: BRIBE_NAV_ICON },
  { section: 'liquidation', label: 'Liquidate', icon: LIQUIDATE_NAV_ICON },
  { section: 'swap', label: 'Swap', icon: SWAP_NAV_ICON },
]

const REGISTER_NAV_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="m9 15 2 2 4-4" />
  </svg>
)

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

function isOnAppPath(path: string): boolean {
  const here = stripBasePath(window.location.pathname)
  return here === path || here.startsWith(`${path}/`)
}

type HeaderNavClickEvent = MouseEvent<HTMLAnchorElement> & { productSwitch?: boolean }

function HeaderNavPathButton({
  path,
  active,
  children,
  onClick,
}: {
  path: string
  active: boolean
  children: ReactNode
  onClick?: (event: HeaderNavClickEvent) => void
}) {
  const navigate = useNavigate()
  /** True when pointerdown already switched products — click must not run same-tab section scroll. */
  const productSwitchRef = useRef(false)
  const warmRoute = () => {
    if (path === '/grs') void import('../pages/GrsPage')
    else if (path === '/backtest') void import('../pages/BacktestPage')
  }
  return (
    <NavLink
      to={path}
      data-app-path={path}
      className={`header-nav-link${active ? ' is-current' : ''}`}
      onPointerEnter={warmRoute}
      onFocus={warmRoute}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return
        warmRoute()
        // Stay on this product: the click handler scrolls / resets sections.
        if (isOnAppPath(path)) {
          productSwitchRef.current = false
          return
        }
        // Leave before the click. A GRAI liquidation re-render was dropping that click,
        // so the router transition never started.
        productSwitchRef.current = true
        event.preventDefault()
        navigate({ pathname: path, search: '', hash: '' })
        queueMicrotask(() => {
          if (!isOnAppPath(path)) window.location.assign(toAppPath(path))
        })
      }}
      onClick={(event) => {
        const navEvent = event as HeaderNavClickEvent
        // After a product switch, pathname already matches this link, so parent
        // "if on /backtest → scroll to create" would fire and nudge the page down.
        if (productSwitchRef.current) {
          productSwitchRef.current = false
          navEvent.productSwitch = true
        }
        onClick?.(navEvent)
      }}
    >
      {children}
    </NavLink>
  )
}

function Header() {
  const { pathname } = useLocation()
  const { networkEnv, setNetworkEnv } = useWalletContext()
  const {
    isConnected: evmConnected,
    chainId: evmChainId,
    switchToChainAsync,
    switchToChain,
  } = useEvmWallet()
  const isBacktestActive = pathname.startsWith('/backtest')
  const isAffiliatesActive = pathname.startsWith('/affiliate')
  const isGraiActive = pathname.startsWith('/grai')
  const isGrsActive = pathname.startsWith('/grs')
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [mobileNavExpanded, setMobileNavExpanded] = useState<'backtest' | 'grai' | 'affiliates' | null>(null)
  const [isBacktestMenuOpen, setIsBacktestMenuOpen] = useState(false)
  const [isAffiliatesMenuOpen, setIsAffiliatesMenuOpen] = useState(false)
  const [isGraiMenuOpen, setIsGraiMenuOpen] = useState(false)
  const [navMode, setNavMode] = useState<'full' | 'compact' | 'mobile'>('full')
  const mobileNavId = useId()
  const backtestMenuRef = useRef<HTMLLIElement>(null)
  const affiliatesMenuRef = useRef<HTMLLIElement>(null)
  const graiMenuRef = useRef<HTMLLIElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const headerContainerRef = useRef<HTMLDivElement>(null)
  const desktopNavTrackRef = useRef<HTMLDivElement>(null)
  const [navIndicator, setNavIndicator] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    visible: false,
  })
  const [navIndicatorReady, setNavIndicatorReady] = useState(false)

  const isNavCompact = navMode === 'compact'
  const isNavMobile = navMode === 'mobile'
  // Desktop strip (full/compact) XOR burger drawer (mobile) — never both.
  const showBurger = isNavMobile

  // Backtest is mainnet-only. Route pin uses `setNetworkEnv` once — never fights
  // the header toggle by hardcoding Devnet on GRAI.
  useEffect(() => {
    if (!isBacktestActive) return
    if (networkEnv !== 'mainnet') setNetworkEnv('mainnet')
    if (evmConnected && isTestnetEvmChainId(evmChainId)) {
      const mainnetId = preferredEvmChainId('ethereum', 'mainnet')
      void switchToChainAsync(mainnetId).catch(() => {
        switchToChain(mainnetId)
      })
    }
  }, [
    isBacktestActive,
    networkEnv,
    setNetworkEnv,
    evmConnected,
    evmChainId,
    switchToChainAsync,
    switchToChain,
  ])

  // GRS is Testnet-only until mainnet contracts ship (`grs/networkEnvPin.ts`).
  useEffect(() => {
    if (!isGrsActive || !isGrsTestnetPinned()) return
    if (networkEnv !== 'testnet') setNetworkEnv('testnet')
    const sepoliaId = preferredEvmChainId('sepolia', 'testnet')
    if (evmConnected && evmChainId !== sepoliaId) {
      void switchToChainAsync(sepoliaId).catch(() => {
        switchToChain(sepoliaId)
      })
    }
  }, [
    isGrsActive,
    networkEnv,
    setNetworkEnv,
    evmConnected,
    evmChainId,
    switchToChainAsync,
    switchToChain,
  ])

  useEffect(() => {
    setIsMobileNavOpen(false)
    setMobileNavExpanded(null)
    setIsBacktestMenuOpen(false)
    setIsAffiliatesMenuOpen(false)
    setIsGraiMenuOpen(false)
  }, [pathname])

  useLayoutEffect(() => {
    const container = headerContainerRef.current
    if (!container) return

    // Prefer a scrollable product strip for as long as the bar has room beside brand + wallet.
    // Only drop to burger-only on very narrow viewports.
    const FULL_MIN = 980
    const COMPACT_MIN = 680

    const update = () => {
      const width = container.clientWidth
      if (width >= FULL_MIN) setNavMode('full')
      else if (width >= COMPACT_MIN) setNavMode('compact')
      else setNavMode('mobile')
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isNavMobile) setIsMobileNavOpen(false)
  }, [isNavMobile])

  useEffect(() => {
    if (!isMobileNavOpen) {
      setMobileNavExpanded(null)
      return
    }
    if (isGraiActive) setMobileNavExpanded('grai')
    else if (isBacktestActive) setMobileNavExpanded('backtest')
    else if (isAffiliatesActive) setMobileNavExpanded('affiliates')
    else setMobileNavExpanded(null)
  }, [isMobileNavOpen, isGraiActive, isBacktestActive, isAffiliatesActive])

  useLayoutEffect(() => {
    const track = desktopNavTrackRef.current
    const scroller = track?.parentElement
    if (!track || !scroller || isNavMobile) {
      setNavIndicator((prev) => ({ ...prev, visible: false }))
      return
    }

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

    // On route / mode change, bring the active product into the horizontal nav only
    // (never window.scrollIntoView — that jumps the page down after ScrollToTop).
    const currentLink = track.querySelector<HTMLElement>('.header-nav-link.is-current')
    const currentItem = currentLink?.closest('.header-nav-item--grai') ?? currentLink
    if (currentItem instanceof HTMLElement) {
      const itemLeft = currentItem.offsetLeft
      const itemRight = itemLeft + currentItem.offsetWidth
      const viewLeft = scroller.scrollLeft
      const viewRight = viewLeft + scroller.clientWidth
      if (itemLeft < viewLeft) {
        scroller.scrollLeft = itemLeft
      } else if (itemRight > viewRight) {
        scroller.scrollLeft = itemRight - scroller.clientWidth
      }
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(track)
    observer.observe(scroller)
    scroller.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      scroller.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [pathname, navMode, isNavMobile])

  useEffect(() => {
    if (!isBacktestMenuOpen && !isAffiliatesMenuOpen && !isGraiMenuOpen) {
      return
    }

    const onDocumentClick = (event: globalThis.MouseEvent) => {
      const target = event.target as Node
      if (!backtestMenuRef.current?.contains(target)) setIsBacktestMenuOpen(false)
      if (!affiliatesMenuRef.current?.contains(target)) setIsAffiliatesMenuOpen(false)
      if (!graiMenuRef.current?.contains(target)) setIsGraiMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsBacktestMenuOpen(false)
        setIsAffiliatesMenuOpen(false)
        setIsGraiMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocumentClick)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocumentClick)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isBacktestMenuOpen, isAffiliatesMenuOpen, isGraiMenuOpen])

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

  const handleBacktestSectionClick = (section: BacktestSection) => {
    setIsBacktestMenuOpen(false)
    setIsGraiMenuOpen(false)
    setIsAffiliatesMenuOpen(false)
    navigateToBacktestSection(section)
  }

  const handleGraiSectionClick = (section: GraiSection) => {
    setIsGraiMenuOpen(false)
    setIsAffiliatesMenuOpen(false)
    navigateToGraiSection(section)
  }

  const closeMenus = useCallback(() => {
    setIsBacktestMenuOpen(false)
    setIsAffiliatesMenuOpen(false)
    setIsGraiMenuOpen(false)
    setIsMobileNavOpen(false)
  }, [])

  useEffect(() => {
    // After the route has committed. Doing this on pointerdown cancelled the
    // header link while Exit by Liquidation was open.
    resetGraiLiquidateView()
    resetGraiMintToDeposit()
  }, [pathname])

  return (
    <>
    {createPortal(
    <header
      ref={headerRef}
      className={`header is-nav-${navMode}${isMobileNavOpen ? ' is-nav-open' : ''}`}
    >
      <div className="header-container" ref={headerContainerRef}>
        <div className="header-left">
          <div className="header-brand">
            <Link to="/" className="header-logo" onClick={() => setIsMobileNavOpen(false)}>
              <img src={assetUrl('logo.svg')} alt="" className="header-logo-img" />
            </Link>
            {showBurger ? (
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
            ) : null}
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
              <li
                ref={backtestMenuRef}
                className={`header-nav-item header-nav-item--grai${isBacktestActive ? ' is-current-product' : ''}${isBacktestMenuOpen ? ' is-open' : ''}`}
              >
                <HeaderNavPathButton
                  path="/backtest"
                  active={isBacktestActive}
                  onClick={(event) => {
                    closeMenus()
                    if (event.productSwitch) return
                    if (pathname.startsWith('/backtest')) {
                      event.preventDefault()
                      navigateToBacktestSection('create')
                    }
                  }}
                >
                  <span className="header-nav-link-stack">
                    <span className="header-nav-link-title">BACKTEST</span>
                    <span className="header-nav-link-sub">strategy calculator</span>
                  </span>
                </HeaderNavPathButton>
                <button
                  type="button"
                  className={`header-nav-caret-btn${isBacktestMenuOpen ? ' is-open' : ''}`}
                  aria-expanded={isBacktestMenuOpen}
                  aria-haspopup="menu"
                  aria-label="BACKTEST sections"
                  onClick={() => {
                    setIsAffiliatesMenuOpen(false)
                    setIsGraiMenuOpen(false)
                    setIsBacktestMenuOpen((open) => !open)
                  }}
                >
                  <GraiUiCaret className="header-nav-caret" />
                </button>
                <div
                  className={`header-nav-dropdown${isBacktestMenuOpen ? ' is-open' : ''}`}
                  role="menu"
                  aria-label="BACKTEST sections"
                  aria-hidden={!isBacktestMenuOpen}
                  hidden={!isBacktestMenuOpen}
                >
                  {BACKTEST_NAV_ITEMS.map((item) => (
                    <button
                      key={item.section}
                      type="button"
                      role="menuitem"
                      className="header-nav-dropdown-item"
                      onClick={() => handleBacktestSectionClick(item.section)}
                    >
                      <span className="header-nav-dropdown-item-icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </li>
              <li
                ref={graiMenuRef}
                className={`header-nav-item header-nav-item--grai${isGraiActive ? ' is-current-product' : ''}${isGraiMenuOpen ? ' is-open' : ''}`}
              >
                <HeaderNavPathButton
                  path="/grai"
                  active={isGraiActive}
                  onClick={(event) => {
                    closeMenus()
                    if (event.productSwitch) return
                    if (pathname.startsWith('/grai')) {
                      event.preventDefault()
                      navigateToGraiSection('mint')
                    }
                  }}
                >
                  <span className="header-nav-link-stack">
                    <span className="header-nav-link-title">GRAI</span>
                    <span className="header-nav-link-sub">fund share</span>
                  </span>
                </HeaderNavPathButton>
                <button
                  type="button"
                  className={`header-nav-caret-btn${isGraiMenuOpen ? ' is-open' : ''}`}
                  aria-expanded={isGraiMenuOpen}
                  aria-haspopup="menu"
                  aria-label="GRAI sections"
                  onClick={() => {
                    setIsBacktestMenuOpen(false)
                    setIsAffiliatesMenuOpen(false)
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
                ref={affiliatesMenuRef}
                className={`header-nav-item header-nav-item--grai${isAffiliatesActive ? ' is-current-product' : ''}${isAffiliatesMenuOpen ? ' is-open' : ''}`}
              >
                <HeaderNavPathButton
                  path="/affiliate"
                  active={isAffiliatesActive}
                  onClick={closeMenus}
                >
                  <span className="header-nav-link-stack">
                    <span className="header-nav-link-title">AFFILIATES</span>
                    <span className="header-nav-link-sub">referral program</span>
                  </span>
                </HeaderNavPathButton>
                <button
                  type="button"
                  className={`header-nav-caret-btn${isAffiliatesMenuOpen ? ' is-open' : ''}`}
                  aria-expanded={isAffiliatesMenuOpen}
                  aria-haspopup="menu"
                  aria-label="AFFILIATES sections"
                  onClick={() => {
                    setIsBacktestMenuOpen(false)
                    setIsGraiMenuOpen(false)
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
            </ul>
            </div>
          </nav>
        <div className="header-actions">
          <div className="header-wallet-cluster">
            <ConnectWalletButton />
            <HeaderSettingsPopover />
          </div>
        </div>
      </div>

      {showBurger ? (
      <div
        className={`header-mobile-nav${isMobileNavOpen ? ' is-open' : ''}`}
        id={mobileNavId}
        aria-hidden={!isMobileNavOpen}
      >
        <nav aria-label="Product sections">
          <ul className="header-mobile-nav-list">
            {!isNavCompact || !isBacktestActive ? (
            <li className={`header-mobile-nav-item${mobileNavExpanded === 'backtest' ? ' is-open' : ''}`}>
              <div className="header-mobile-nav-row">
                <HeaderNavPathButton
                  path="/backtest"
                  active={isBacktestActive}
                  onClick={(event) => {
                    closeMenus()
                    setIsMobileNavOpen(false)
                    if (event.productSwitch) return
                    if (pathname.startsWith('/backtest')) {
                      event.preventDefault()
                      navigateToBacktestSection('create')
                    }
                  }}
                >
                  <span className="header-nav-link-stack">
                    <span className="header-nav-link-title">BACKTEST</span>
                    <span className="header-nav-link-sub">strategy calculator</span>
                  </span>
                </HeaderNavPathButton>
                <button
                  type="button"
                  className={`header-nav-caret-btn header-mobile-nav-caret${mobileNavExpanded === 'backtest' ? ' is-open' : ''}`}
                  aria-expanded={mobileNavExpanded === 'backtest'}
                  aria-controls={`${mobileNavId}-backtest`}
                  aria-label="BACKTEST sections"
                  onClick={() =>
                    setMobileNavExpanded((cur) => (cur === 'backtest' ? null : 'backtest'))
                  }
                >
                  <GraiUiCaret className="header-nav-caret" />
                </button>
              </div>
              {mobileNavExpanded === 'backtest' ? (
                <ul id={`${mobileNavId}-backtest`} className="header-mobile-nav-sublist">
                  {BACKTEST_NAV_ITEMS.map((item) => (
                    <li key={item.section}>
                      <button
                        type="button"
                        className="header-nav-link header-mobile-nav-sublink"
                        onClick={() => {
                          handleBacktestSectionClick(item.section)
                          setIsMobileNavOpen(false)
                        }}
                      >
                        <span className="header-nav-dropdown-item-icon">{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
            ) : null}
            {!isNavCompact || !isGraiActive ? (
            <li className={`header-mobile-nav-item${mobileNavExpanded === 'grai' ? ' is-open' : ''}`}>
              <div className="header-mobile-nav-row">
                <HeaderNavPathButton
                  path="/grai"
                  active={isGraiActive}
                  onClick={(event) => {
                    closeMenus()
                    setIsMobileNavOpen(false)
                    if (event.productSwitch) return
                    if (pathname.startsWith('/grai')) {
                      event.preventDefault()
                      navigateToGraiSection('mint')
                    }
                  }}
                >
                  <span className="header-nav-link-stack">
                    <span className="header-nav-link-title">GRAI</span>
                    <span className="header-nav-link-sub">fund share</span>
                  </span>
                </HeaderNavPathButton>
                <button
                  type="button"
                  className={`header-nav-caret-btn header-mobile-nav-caret${mobileNavExpanded === 'grai' ? ' is-open' : ''}`}
                  aria-expanded={mobileNavExpanded === 'grai'}
                  aria-controls={`${mobileNavId}-grai`}
                  aria-label="GRAI sections"
                  onClick={() =>
                    setMobileNavExpanded((cur) => (cur === 'grai' ? null : 'grai'))
                  }
                >
                  <GraiUiCaret className="header-nav-caret" />
                </button>
              </div>
              {mobileNavExpanded === 'grai' ? (
                <ul id={`${mobileNavId}-grai`} className="header-mobile-nav-sublist">
                  {GRAI_NAV_ITEMS.map((item) => (
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
                  ))}
                </ul>
              ) : null}
            </li>
            ) : null}
            {!isNavCompact || !isAffiliatesActive ? (
            <li className={`header-mobile-nav-item${mobileNavExpanded === 'affiliates' ? ' is-open' : ''}`}>
              <div className="header-mobile-nav-row">
                <HeaderNavPathButton
                  path="/affiliate"
                  active={isAffiliatesActive}
                  onClick={() => {
                    closeMenus()
                    setIsMobileNavOpen(false)
                  }}
                >
                  <span className="header-nav-link-stack">
                    <span className="header-nav-link-title">AFFILIATES</span>
                    <span className="header-nav-link-sub">referral program</span>
                  </span>
                </HeaderNavPathButton>
                <button
                  type="button"
                  className={`header-nav-caret-btn header-mobile-nav-caret${mobileNavExpanded === 'affiliates' ? ' is-open' : ''}`}
                  aria-expanded={mobileNavExpanded === 'affiliates'}
                  aria-controls={`${mobileNavId}-affiliates`}
                  aria-label="AFFILIATES sections"
                  onClick={() =>
                    setMobileNavExpanded((cur) => (cur === 'affiliates' ? null : 'affiliates'))
                  }
                >
                  <GraiUiCaret className="header-nav-caret" />
                </button>
              </div>
              {mobileNavExpanded === 'affiliates' ? (
                <ul id={`${mobileNavId}-affiliates`} className="header-mobile-nav-sublist">
                  {AFFILIATES_NAV_ITEMS.map((item) => (
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
                  ))}
                </ul>
              ) : null}
            </li>
            ) : null}
          </ul>
        </nav>
      </div>
      ) : null}

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
