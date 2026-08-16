import { useEffect, useState, type ReactNode } from 'react'
import { GrsBridgePanel } from '../components/grs/GrsBridgePanel'
import { GrsCapInfographic } from '../components/grs/GrsCapInfographic'
import { GrsSalesPanel } from '../components/grs/GrsSalesPanel'
import { GrsVestingPanel } from '../components/grs/GrsVestingPanel'
import { GraiFieldInfoButton } from '../components/grai/GraiFieldInfo'
import { useGrsSnapshot } from '../hooks/useGrsSnapshot'
import { isGrsConfiguredAnywhere } from '../grs/deployments'
import {
  GRS_OPS_ID,
  GRS_SECTION_LABELS,
  GRS_SECTIONS,
  navigateToGrsSection,
  readGrsSectionFromHash,
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
  sales: <>Public TGE float is instant {GRS_TERM} — buy on home, then bridge.</>,
  vesting: <>Release unlocked grants after cliff. Anyone may call release.</>,
  vest: <>Lock your own {GRS_TERM} into a cliff + linear schedule.</>,
}

const OPS_ICONS: Record<GrsSection, ReactNode> = {
  bridge: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </svg>
  ),
  sales: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 1.95-1.55L21 8H7" />
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
        <div className="grai-action-card grai-mint grs-ops-form">
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
  const { config, snapshot, isLoading, error, refresh, configuredChains } = useGrsSnapshot()
  const configured = Boolean(config) || isGrsConfiguredAnywhere()
  const [opsView, setOpsView] = useState<GrsSection>(() => readGrsSectionFromHash() ?? 'bridge')

  useEffect(() => {
    const applySection = (section: GrsSection) => {
      if (GRS_SECTIONS.includes(section)) setOpsView(section)
    }
    const onHash = () => {
      const section = readGrsSectionFromHash()
      if (section) applySection(section)
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
      <div className="grai-content-row">
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

        <div className="grai-actions-block grs-ops-block" id={GRS_OPS_ID}>
          <div className="grai-liquidation-ops-layout">
            <aside className="grai-liquidation-ops-tabs grs-ops-tabs">
              <h3 className="grai-liquidation-ops-heading">GRS operations</h3>
              <div
                className={`grai-action-switch grai-action-switch--ops is-${opsView}-active`}
                role="tablist"
                aria-label="GRS operations"
              >
                {GRS_SECTIONS.map((section) => (
                  <button
                    key={section}
                    type="button"
                    role="tab"
                    aria-selected={opsView === section}
                    className={`grai-action-switch-btn is-${section}${opsView === section ? ' is-active' : ''}`}
                    onClick={() => navigateToGrsSection(section)}
                  >
                    <span className="grai-action-switch-icon" aria-hidden="true">
                      {OPS_ICONS[section]}
                    </span>
                    <span className="grai-action-switch-label">{GRS_SECTION_LABELS[section]}</span>
                  </button>
                ))}
              </div>
            </aside>

            <div className="grai-liquidation-ops-main">
              {opsView === 'bridge' ? (
                <GrsOpsPanel section="bridge">
                  <GrsBridgePanel config={config} snapshot={snapshot} isLoading={isLoading} refresh={refresh} />
                </GrsOpsPanel>
              ) : null}

              {opsView === 'sales' ? (
                <GrsOpsPanel section="sales" form={false}>
                  <GrsSalesPanel
                    config={config}
                    snapshot={snapshot}
                    isLoading={isLoading}
                    refresh={refresh}
                    note={NOTES.sales}
                  />
                </GrsOpsPanel>
              ) : null}

              {opsView === 'vesting' || opsView === 'vest' ? (
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

        <GrsCapInfographic snapshot={snapshot} isLoading={isLoading} />
      </div>
    </div>
  )
}

export default GrsPage
