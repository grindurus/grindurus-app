import { useEffect, useId, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { ConnectWalletButton } from './ConnectWalletButton'
import { HeaderSettingsPopover } from './HeaderSettingsPopover'
import { assetUrl } from '../utils/appPaths'
import './Header.css'

function Header() {
  const { pathname } = useLocation()
  const isBacktestActive = pathname.startsWith('/backtest')
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const mobileNavId = useId()

  useEffect(() => {
    setIsMobileNavOpen(false)
  }, [pathname])

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

  return (
    <header className={`header${isMobileNavOpen ? ' is-nav-open' : ''}`}>
      <div className="header-container">
        <div className="header-left">
          <Link to="/" className="header-logo" onClick={() => setIsMobileNavOpen(false)}>
            <img src={assetUrl('logo.png')} alt="" className="header-logo-img" />
            <span className="header-logo-text">GrindURUS</span>
          </Link>
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
              <li>
                <NavLink
                  to="/grai"
                  className={({ isActive }) => `header-nav-link${isActive ? ' is-current' : ''}`}
                >
                  GRAI
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
