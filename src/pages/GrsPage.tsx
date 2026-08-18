import { useEffect, useState, type ReactNode } from 'react'
import { GrsBridgePanel } from '../components/grs/GrsBridgePanel'
import { GrsCapInfographic } from '../components/grs/GrsCapInfographic'
import { GrsListSalePanel } from '../components/grs/GrsListSalePanel'
import { GrsSalesPanel } from '../components/grs/GrsSalesPanel'
import { GrsVestingPanel } from '../components/grs/GrsVestingPanel'
import { GraiFieldInfoButton } from '../components/grai/GraiFieldInfo'
import { useEvmWallet } from '../hooks/useEvmWallet'
import { useGrsSnapshot } from '../hooks/useGrsSnapshot'
import { isGrsConfiguredAnywhere, resolveGrsHomeChain } from '../grs/deployments'
import { useWalletContext, type EvmChain } from '../providers/AppWalletProvider'
import {
  GRS_OPS_ID,
  GRS_OPS_TABS,
  GRS_SALES_ID,
  GRS_SECTION_LABELS,
  navigateToGrsSection,
  readGrsSectionFromHash,
  type GrsOpsTab,
  type GrsSection,
} from '../utils/grsNavigation'
import './GraiPage.css'
import './GrsPage.css'

const GRS_TERM = (
  <GraiFieldInfoButton
    className="grai-action-deposit-term"
    tooltipClassName="grai-action-deposit-term-tooltip"
    ariaLabel="About GRS"
    hint="Grindurus Token: 1B fixed supply. Home holds genesis inventory; spokes mint and burn through the OFT bridge."
  >
    <span className="grai-action-deposit-term-label">GRS</span>
  </GraiFieldInfoButton>
)

const NOTES: Record<GrsSection, ReactNode> = {
  bridge: <>Move {GRS_TERM} to the chain where you trade, via LayerZero OFT.</>,
  sales: (
    <>
      Home <code>sale()</code>: quote asset, amounts, proceeds recipient, dstEid. TokenSales inventory
      only.
    </>
  ),
  vesting: <>Release unlocked grants after cliff. Anyone may call release.</>,
  vest: <>Lock your own {GRS_TERM} into a cliff + linear schedule.</>,
}

const BUY_NOTE = <>You buy {GRS_TERM} on token sale</>

const OPS_ICONS: Record<GrsOpsTab, ReactNode> = {
  bridge: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </svg>
  ),
  vesting: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  ),
  vest: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
}

const SALE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="20" r="1.4" />
    <circle cx="18" cy="20" r="1.4" />
    <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 1.95-1.55L21 8H7" />
  </svg>
)

function chainIdToEvmChain(chainId: number): EvmChain | null {
  if (chainId === 1) return 'ethereum'
  if (chainId === 42161) return 'arbitrum'
  if (chainId === 11155111) return 'sepolia'
  return null
}

function opsTabFromHash(section: GrsSection | null): GrsOpsTab {
  if (section && section !== 'sales') return section
  return 'bridge'
}

function GrsOpsPanel({
  section,
  children,
  form = true,
}: {
  section: GrsSection
  children: ReactNode
  form?: boolean
}) {
  return (
    <section className="grai-liquidation-distribute-screen grs-ops-panel" id={`grs-${section}`}>
      <h3 className="grai-liquidation-distribute-title">{GRS_SECTION_LABELS[section]}</h3>
      {form ? (
        <div className={`grai-action-card grai-mint grs-ops-form${section === 'vesting' ? ' is-wide' : ''}`}>
          <div className="grai-action-content">
            {children}
            <div className="grai-action-deposit-notes">
              <p className="grai-action-deposit-note">{NOTES[section]}</p>
            </div>
          </div>
        </div>
      ) : (
        children
      )}
    </section>
  )
}

function GrsPage() {
  const evmWallet = useEvmWallet()
  const { setSelectedChainType, setEvmChain } = useWalletContext()
  const { config, snapshot, isLoading, error, refresh, configuredChains } = useGrsSnapshot()
  const configured = Boolean(config) || isGrsConfiguredAnywhere()
  const [opsView, setOpsView] = useState<GrsOpsTab>(() => opsTabFromHash(readGrsSectionFromHash()))
  const [salesActive, setSalesActive] = useState(() => readGrsSectionFromHash() === 'sales')
  const [isOpsCollapsed, setIsOpsCollapsed] = useState(false)

  const goToHomeSale = async () => {
    const home = resolveGrsHomeChain(snapshot, config, configuredChains)
    setSelectedChainType('evm')
    if (home) {
      const nextEvmChain = chainIdToEvmChain(home.chainId)
      if (nextEvmChain) setEvmChain(nextEvmChain)
      if (evmWallet.isConnected && evmWallet.chainId !== home.chainId) {
        try {
          await evmWallet.switchToChainAsync(home.chainId)
        } catch {
          /* user rejected */
        }
      }
    }
    navigateToGrsSection('sales')
  }

  useEffect(() => {
    const applySection = (section: GrsSection) => {
      setIsOpsCollapsed(false)
      setSalesActive(section === 'sales')
      if (section === 'sales') return
      setOpsView(section)
    }
    const onHash = () => {
      const section = readGrsSectionFromHash()
      if (section) {
        applySection(section)
        return
      }
      setSalesActive(false)
      setOpsView('bridge')
    }
    const onNav = (event: Event) => {
      applySection((event as CustomEvent<GrsSection>).detail)
    }
    onHash()
    window.addEventListener('hashchange', onHash)
    window.addEventListener('grs-section-nav', onNav)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('grs-section-nav', onNav)
    }
  }, [])

  return (
    <div className="grai-page grs-page">
      <p className="grai-page-dev-banner" role="status">
        TESTNET DEVELOPMENT
      </p>
      <div className="grai-content-row">
        <section className="grs-sales-section" id={GRS_SALES_ID}>
          <GrsSalesPanel
            config={config}
            snapshot={snapshot}
            isLoading={isLoading}
            refresh={refresh}
            note={BUY_NOTE}
          />
        </section>

        {(error || !configured || (configured && !config)) && (
          <div className="grai-page-meta">
            {!configured ? (
              <p className="grai-page-network-warning" role="status">
                GRS is not configured for this network. Set VITE_GRS_*_TOKEN env vars.
              </p>
            ) : null}
            {configured && !config ? (
              <p className="grai-page-network-warning" role="status">
                No GRS OFT on this chain
                {configuredChains.length > 0
                  ? `. Configured: ${configuredChains.map((item) => item.chainName).join(', ')}.`
                  : '.'}
              </p>
            ) : null}
            {error ? (
              <p className="grai-page-network-warning" role="status">
                {error}
              </p>
            ) : null}
          </div>
        )}

        <div className="grai-actions-block grai-liquidation-ops-block grs-ops-block" id={GRS_OPS_ID}>
          <h3 className="grai-liquidation-ops-heading">
            <button
              type="button"
              className={`grai-referral-dash-collapse${isOpsCollapsed ? ' is-collapsed' : ''}`}
              onClick={() => setIsOpsCollapsed((collapsed) => !collapsed)}
              aria-expanded={!isOpsCollapsed}
              aria-controls="grs-liquidation-ops-layout"
              aria-label={isOpsCollapsed ? 'Show GRS operations' : 'Hide GRS operations'}
            >
              <svg
                className="grai-donut-legend-toggle-icon"
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
            </button>
            GRS operations
          </h3>
          <div
            className={`grai-liquidation-ops-body${isOpsCollapsed ? '' : ' is-open'}`}
            id="grs-liquidation-ops-layout"
            aria-hidden={isOpsCollapsed}
          >
            <div className="grai-liquidation-ops-body-inner">
          <div className="grai-liquidation-ops-layout">
            <aside className="grai-liquidation-ops-tabs grs-ops-tabs">
              <div
                className={`grai-action-switch grai-action-switch--ops is-${opsView}-active`}
                role="tablist"
                aria-label="GRS operations"
              >
                {GRS_OPS_TABS.map((section) => {
                  const tab = (
                    <button
                      key={section}
                      type="button"
                      role="tab"
                      aria-selected={opsView === section && !salesActive}
                      className={`grai-action-switch-btn is-${section}${opsView === section && !salesActive ? ' is-active' : ''}`}
                      onClick={() => navigateToGrsSection(section)}
                    >
                      <span className="grai-action-switch-icon" aria-hidden="true">
                        {OPS_ICONS[section]}
                      </span>
                      <span className="grai-action-switch-label">{GRS_SECTION_LABELS[section]}</span>
                    </button>
                  )

                  if (section !== 'bridge') return tab

                  return [
                    tab,
                    <button
                      key="sales"
                      type="button"
                      role="tab"
                      aria-selected={salesActive}
                      className={`grai-action-switch-btn is-sales${salesActive ? ' is-active' : ''}`}
                      onClick={() => {
                        void goToHomeSale()
                      }}
                    >
                      <span className="grai-action-switch-icon" aria-hidden="true">
                        {SALE_ICON}
                      </span>
                      <span className="grai-action-switch-label">{GRS_SECTION_LABELS.sales}</span>
                    </button>,
                  ]
                })}
              </div>
            </aside>

            <div className="grai-liquidation-ops-main">
              {salesActive ? (
                <GrsOpsPanel section="sales">
                  <GrsListSalePanel config={config} snapshot={snapshot} refresh={refresh} />
                </GrsOpsPanel>
              ) : null}

              {!salesActive && opsView === 'bridge' ? (
                <GrsOpsPanel section="bridge">
                  <GrsBridgePanel config={config} snapshot={snapshot} isLoading={isLoading} refresh={refresh} />
                </GrsOpsPanel>
              ) : null}

              {!salesActive && (opsView === 'vesting' || opsView === 'vest') ? (
                <GrsOpsPanel section={opsView}>
                  <GrsVestingPanel
                    config={config}
                    snapshot={snapshot}
                    isLoading={isLoading}
                    refresh={refresh}
                    view={opsView === 'vest' ? 'lock' : 'claim'}
                  />
                </GrsOpsPanel>
              ) : null}
            </div>
          </div>
            </div>
          </div>
        </div>

        <GrsCapInfographic snapshot={snapshot} isLoading={isLoading} />
      </div>
    </div>
  )
}

export default GrsPage
