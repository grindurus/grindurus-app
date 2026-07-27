import { useCallback, useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { Settings } from 'lucide-react'
import { WalletNetworkSelect } from '../WalletNetworkSelect'
import { useActiveWallet } from '../../hooks/useActiveWallet'
import { useBossGrinderTable } from '../../hooks/useBossGrinderTable'
import { useBossEndpointUrls } from '../../hooks/useBossEndpointUrls'
import { useGrinderLastTx } from '../../hooks/useGrinderLastTx'
import { useWalletContext } from '../../providers/AppWalletProvider'
import { summarizeGrinderTableRows } from '../../boss/grinderTable'
import { grinderRowMatchesCaip2Network } from '../../wallet/caip2Network'
import { toAppPath } from '../../utils/appPaths'
import { navigateToGraiSection } from '../../utils/graiNavigation'
import {
  GraiGrinderCountValue,
  GraiGrinderLastTxCell,
  GraiGrinderTableName,
  GraiGrinderTvlValue,
  GraiGrinderYieldValue,
  GraiGrindersSummaryConnectButton,
} from './GraiGrinderCells'
import { GraiFieldInfoButton, GraiGrindersTotalLabel } from './GraiFieldInfo'
import {
  GRINDERS_COLUMN_ICONS,
  GRINDER_TVL_INFO_HINT,
  GRINDER_UPTIME_INFO_HINT,
  GRINDER_YIELD_INFO_HINT,
} from './graiPageIcons'

const BossEndpointsTable = lazy(() =>
  import('../BossEndpointsTable').then((m) => ({ default: m.BossEndpointsTable })),
)

const GRINDERS_TABLE_PAGE_SIZE = 10

export function GraiGrindersSection() {
  const { openChainSelector } = useWalletContext()
  const activeWallet = useActiveWallet()
  const [isGrindersTableHidden, setIsGrindersTableHidden] = useState(true)
  const [isGrindersFilterEnabled, setIsGrindersFilterEnabled] = useState(false)
  const [isBossEndpointsOpen, setIsBossEndpointsOpen] = useState(false)
  const [shouldMountBossEndpoints, setShouldMountBossEndpoints] = useState(false)
  const [copiedGrinderId, setCopiedGrinderId] = useState<string | null>(null)
  const [grindersTablePage, setGrindersTablePage] = useState(0)
  const bossEndpoints = useBossEndpointUrls()
  const {
    rows: grinderRows,
    isLive: isBossGrinderLive,
    isBootstrapped: isBossGrinderBootstrapped,
    isBossUnavailable,
  } = useBossGrinderTable(bossEndpoints.activeUrls, bossEndpoints.isMetadataReady)
  const walletNetworkCaip2 = activeWallet.networkCaip2
  const isGrindersNetworkFilterActive =
    activeWallet.isConnected && isGrindersFilterEnabled && Boolean(walletNetworkCaip2)
  const displayGrinderRows = useMemo(() => {
    if (!isGrindersNetworkFilterActive || !walletNetworkCaip2) return grinderRows
    return grinderRows.filter((row) => grinderRowMatchesCaip2Network(row, walletNetworkCaip2))
  }, [grinderRows, isGrindersNetworkFilterActive, walletNetworkCaip2])
  const grindersTablePageCount = Math.max(1, Math.ceil(displayGrinderRows.length / GRINDERS_TABLE_PAGE_SIZE))
  const paginatedGrinderRows = useMemo(() => {
    const start = grindersTablePage * GRINDERS_TABLE_PAGE_SIZE
    return displayGrinderRows.slice(start, start + GRINDERS_TABLE_PAGE_SIZE)
  }, [displayGrinderRows, grindersTablePage])
  const grindersTableRangeStart =
    displayGrinderRows.length === 0 ? 0 : grindersTablePage * GRINDERS_TABLE_PAGE_SIZE + 1
  const grindersTableRangeEnd = Math.min(
    (grindersTablePage + 1) * GRINDERS_TABLE_PAGE_SIZE,
    displayGrinderRows.length,
  )
  const showGrindersTablePagination = displayGrinderRows.length > GRINDERS_TABLE_PAGE_SIZE
  const displayGrinderSummary = useMemo(
    () => summarizeGrinderTableRows(displayGrinderRows),
    [displayGrinderRows],
  )
  const grinderLastTx = useGrinderLastTx(displayGrinderRows, isBossGrinderLive)
  const isBossGrinderLoading = !isBossGrinderBootstrapped
  const grinderTotalCount = displayGrinderSummary.totalCount
  const grinderActiveCount = displayGrinderSummary.activeCount
  const grinderTvlUsd = displayGrinderSummary.tvlUsd
  const grinderYieldUsd = displayGrinderSummary.yieldUsd
  const isGrinderNetworkConnected = activeWallet.isConnected && Boolean(walletNetworkCaip2)
  const grinderUptimeLabel = isBossGrinderLive ? '99.999%' : '—'
  const toggleGrindersFilter = useCallback(() => {
    if (!activeWallet.isConnected) return
    setIsGrindersFilterEnabled((enabled) => !enabled)
  }, [activeWallet.isConnected])
  const toggleBossEndpoints = useCallback(() => {
    setIsBossEndpointsOpen((open) => {
      const nextOpen = !open
      if (nextOpen) setShouldMountBossEndpoints(true)
      return nextOpen
    })
  }, [])
  const showGrindersTotalLabels = !isGrindersFilterEnabled
  const copyGrinderTableAddress = useCallback(async (address: string, grinderId: string) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopiedGrinderId(grinderId)
      window.setTimeout(() => setCopiedGrinderId(null), 1500)
    } catch {
      // ignore clipboard errors
    }
  }, [])

  const [isCompactGrindersLayout, setIsCompactGrindersLayout] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px)').matches,
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1024px)')
    const onChange = () => setIsCompactGrindersLayout(mediaQuery.matches)
    mediaQuery.addEventListener('change', onChange)
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!activeWallet.isConnected) {
      setIsGrindersFilterEnabled(false)
    }
  }, [activeWallet.isConnected])

  useEffect(() => {
    setGrindersTablePage(0)
  }, [isGrindersNetworkFilterActive, walletNetworkCaip2])

  useEffect(() => {
    setGrindersTablePage((page) => Math.min(page, grindersTablePageCount - 1))
  }, [displayGrinderRows.length, grindersTablePageCount])

  const grindersNetworkFilterToggle = (
    <button
      type="button"
      role="switch"
      className={`grai-grinders-filter-toggle${isGrindersFilterEnabled ? ' is-active' : ''}${activeWallet.isConnected ? '' : ' is-disabled'}`}
      onClick={toggleGrindersFilter}
      aria-checked={isGrindersFilterEnabled}
      aria-disabled={!activeWallet.isConnected}
      disabled={!activeWallet.isConnected}
      aria-label={
        isGrindersFilterEnabled ? 'Disable grinder network filter' : 'Enable grinder network filter'
      }
    >
      <span className="grai-grinders-filter-toggle-stack" aria-hidden="true">
        <span className="grai-grinders-filter-toggle-caption grai-grinders-filter-toggle-caption--all">
          TOTAL
        </span>
        <span className="grai-grinders-filter-toggle-track">
          <span className="grai-grinders-filter-toggle-thumb" />
        </span>
        <span className="grai-grinders-filter-toggle-caption grai-grinders-filter-toggle-caption--network">
          BY NETWORK
        </span>
      </span>
    </button>
  )

  const compactToolbarNetworkAction = isGrinderNetworkConnected ? (
    <WalletNetworkSelect variant="compact" ariaLabel="Select wallet network" />
  ) : null
  const grindersSummaryFilterRow = isCompactGrindersLayout ? (
    <div className="grai-grinders-summary-filter-wrap grai-grinders-summary-filter-wrap--compact-row">
      {grindersNetworkFilterToggle}
      {compactToolbarNetworkAction ? (
        <span className="grai-grinders-summary-toolbar-network">
          <span className="grai-grinders-network-action">{compactToolbarNetworkAction}</span>
        </span>
      ) : null}
    </div>
  ) : null

  const desktopNetworkAction = isGrinderNetworkConnected ? (
    <>
      {grindersNetworkFilterToggle}
      <WalletNetworkSelect variant="compact" ariaLabel="Selected wallet network" />
    </>
  ) : (
    <GraiGrindersSummaryConnectButton onConnect={openChainSelector} />
  )

  const bossEndpointsToggle = (
    <div className="grai-grinders-summary-toggle grai-grinders-endpoints-toggle-wrap">
      <button
        type="button"
        className={`grai-donut-legend-toggle grai-grinders-endpoints-toggle is-icon${isBossEndpointsOpen ? '' : ' is-collapsed'}`}
        onClick={(event) => {
          event.stopPropagation()
          toggleBossEndpoints()
        }}
        aria-expanded={isBossEndpointsOpen}
        aria-controls="grai-boss-endpoints-panel"
        aria-label={isBossEndpointsOpen ? 'Hide endpoints' : 'View endpoints'}
        title={isBossEndpointsOpen ? 'Hide endpoints' : 'View endpoints'}
      >
        <Settings
          className="grai-grinders-endpoints-gear-icon"
          size={16}
          strokeWidth={2.2}
          aria-hidden="true"
        />
      </button>
    </div>
  )

  return (
    <div className="grai-bottom-row">
      <div className="grai-grinders-summary-shell" id="grai-grinders-summary">
        {grindersSummaryFilterRow}
        <div className="grai-grinders-row grai-grinders-row--group grai-grinders-row--summary" role="row">
          {!isCompactGrindersLayout ? (
          <span
            role="columnheader"
            className="grai-grinders-group-title is-network is-stacked grai-grinders-network-slot--desktop"
          >
            <span className="grai-grinders-network-main">
              <span className="grai-grinders-network-action">{desktopNetworkAction}</span>
            </span>
          </span>
          ) : null}
          <span role="columnheader" className="grai-grinders-group-general is-stacked grai-grinders-summary-general">
            <span className="grai-grinders-group-general-top">
              <span
                className={`grai-grinder-active-dot${isBossGrinderLive ? '' : ' is-inactive'}`}
                aria-hidden="true"
              />
              <span className="grai-grinders-live-label grai-grinders-summary-mini-label">LIVE</span>
            </span>
            {isBossGrinderLoading || isBossUnavailable ? (
              <span className="grai-grinders-group-general-value grai-grinders-group-general-value--placeholder">
                {isBossGrinderLoading ? '…' : '—'}
              </span>
            ) : (
              <GraiGrinderCountValue
                active={grinderActiveCount}
                total={grinderTotalCount}
                isLive={isBossGrinderLive}
                isBossUnavailable={isBossUnavailable}
              />
            )}
          </span>
          <span role="columnheader" className="grai-grinders-group-title is-uptime is-stacked" style={{ gridColumn: 3 }}>
            <GraiFieldInfoButton
              className="grai-grinders-group-title-label"
              hint={GRINDER_UPTIME_INFO_HINT}
              ariaLabel="What grinder uptime means"
              structured
            >
              <span className="grai-grinders-group-title-icon" aria-hidden="true">
                {GRINDERS_COLUMN_ICONS.lastActionTime}
              </span>
              UPTIME
            </GraiFieldInfoButton>
            {isBossGrinderLoading || isBossUnavailable ? (
              <span className="grai-grinders-group-title-value grai-grinders-group-title-value--placeholder">
                {isBossGrinderLoading ? '…' : '—'}
              </span>
            ) : (
              <span className="grai-grinders-group-title-value">{grinderUptimeLabel}</span>
            )}
          </span>
          <span role="columnheader" className="grai-grinders-group-title is-tvl is-stacked" style={{ gridColumn: '4 / span 2' }}>
            <GraiFieldInfoButton
              className="grai-grinders-group-title-label"
              hint={GRINDER_TVL_INFO_HINT}
              ariaLabel="How value locked is calculated"
              structured
            >
              <span className="grai-grinders-group-title-icon" aria-hidden="true">
                {GRINDERS_COLUMN_ICONS.quote}
              </span>
              <GraiGrindersTotalLabel showTotal={showGrindersTotalLabels} rest="VALUE LOCKED" />
            </GraiFieldInfoButton>
            {isBossGrinderLoading || isBossUnavailable ? (
              <span className="grai-grinders-group-title-value grai-grinders-group-title-value--placeholder">
                {isBossGrinderLoading ? '…' : '—'}
              </span>
            ) : (
              <GraiGrinderTvlValue totalUsd={grinderTvlUsd} rows={isBossGrinderLive ? displayGrinderRows : []} />
            )}
          </span>
          <span role="columnheader" className="grai-grinders-group-title is-yield is-stacked" style={{ gridColumn: '6 / span 2' }}>
            <GraiFieldInfoButton
              className="grai-grinders-group-title-label"
              hint={GRINDER_YIELD_INFO_HINT}
              ariaLabel="How yield is calculated"
              structured
            >
              <span className="grai-grinders-group-title-icon" aria-hidden="true">
                {GRINDERS_COLUMN_ICONS.yieldQuote}
              </span>
              <GraiGrindersTotalLabel showTotal={showGrindersTotalLabels} rest="YIELD" />
            </GraiFieldInfoButton>
            {isBossGrinderLoading || isBossUnavailable ? (
              <span className="grai-grinders-group-title-value grai-grinders-group-title-value--placeholder">
                {isBossGrinderLoading ? '…' : '—'}
              </span>
            ) : (
              <GraiGrinderYieldValue totalUsd={grinderYieldUsd} rows={isBossGrinderLive ? displayGrinderRows : []} />
            )}
          </span>
        </div>
        <div className="grai-grinders-summary-table-row">
          <div className="grai-grinders-grinders-panel-slot">
        <section
          className={`grai-bottom-card grai-bottom-card--table grai-grinders-table-panel${isGrindersTableHidden ? '' : ' is-open'}`}
          aria-hidden={isGrindersTableHidden}
          aria-label="Grinders in system"
        >
          <div className="grai-grinders-table-panel-inner">
            {isBossGrinderLoading ? (
              <p className="grai-grinders-boss-status" role="status">
                Loading grinder data from Boss…
              </p>
            ) : isBossUnavailable ? (
              <p className="grai-grinders-boss-status is-unavailable" role="status">
                Boss API is unreachable. Grinders data is unavailable. Funds is saved by Custodies
              </p>
            ) : (
              <div
                className="grai-grinders-table"
                id="grai-grinders-table"
                role="table"
                aria-label="Grinders table"
              >
                <div className="grai-grinders-row grai-grinders-row--head" role="row">
                  <span role="columnheader" className="grai-grinders-col-head is-last-action-kind">
                    <span className="grai-grinders-col-head-inner">
                      <span className="grai-grinders-col-icon">{GRINDERS_COLUMN_ICONS.lastAction}</span>
                      <span className="grai-grinders-col-head-label">Last tx</span>
                    </span>
                  </span>
                  <span role="columnheader" className="grai-grinders-col-grinder" aria-label="Grinders">
                    <a
                      href={`${toAppPath('/grinders')}#allocate`}
                      className="grai-grinders-col-grinder-link"
                      title="Grinder management"
                      onClick={(event) => {
                        event.preventDefault()
                        navigateToGraiSection('allocate')
                      }}
                    >
                      <span className="grai-grinders-col-head-label">GRINDERS</span>
                    </a>
                  </span>
                  <span role="columnheader" className="grai-grinders-col-head is-last-action">
                    <span className="grai-grinders-col-head-inner">
                      <span className="grai-grinders-col-icon">{GRINDERS_COLUMN_ICONS.lastActionTime}</span>
                      <span className="grai-grinders-col-head-label">Last action time</span>
                    </span>
                  </span>
                  <span role="columnheader" className="grai-grinders-col-head is-base">
                    <span className="grai-grinders-col-head-inner">
                      <span className="grai-grinders-col-icon">{GRINDERS_COLUMN_ICONS.base}</span>
                      <span className="grai-grinders-col-head-label">Base</span>
                    </span>
                  </span>
                  <span role="columnheader" className="grai-grinders-col-head is-quote">
                    <span className="grai-grinders-col-head-inner">
                      <span className="grai-grinders-col-icon">{GRINDERS_COLUMN_ICONS.quote}</span>
                      <span className="grai-grinders-col-head-label">Quote</span>
                    </span>
                  </span>
                  <span role="columnheader" className="grai-grinders-col-head is-yield-base">
                    <span className="grai-grinders-col-head-inner">
                      <span className="grai-grinders-col-icon">{GRINDERS_COLUMN_ICONS.yieldBase}</span>
                      <span className="grai-grinders-col-head-label">Yield base</span>
                    </span>
                  </span>
                  <span role="columnheader" className="grai-grinders-col-head is-yield-quote">
                    <span className="grai-grinders-col-head-inner">
                      <span className="grai-grinders-col-icon">{GRINDERS_COLUMN_ICONS.yieldQuote}</span>
                      <span className="grai-grinders-col-head-label">Yield quote</span>
                    </span>
                  </span>
                </div>
                {displayGrinderRows.length === 0 ? (
                  <p className="grai-grinders-boss-status is-empty" role="status">
                    {isGrindersNetworkFilterActive
                      ? `No grinders on ${walletNetworkCaip2}.`
                      : 'No grinders in the Boss fleet.'}
                  </p>
                ) : (
                  paginatedGrinderRows.map((row) => (
                    <div className="grai-grinders-row" role="row" key={row.id}>
                      <GraiGrinderLastTxCell
                        lastActionLabel={row.lastActionLabel}
                        txState={grinderLastTx[row.id]}
                      />
                      <GraiGrinderTableName
                        row={row}
                        copied={copiedGrinderId === row.id}
                        onCopy={copyGrinderTableAddress}
                      />
                      <span role="cell">{row.lastAction}</span>
                      <span role="cell">{row.base}</span>
                      <span role="cell">{row.quote}</span>
                      <span
                        role="cell"
                        className={row.yieldBase.startsWith('+') ? 'is-positive' : row.yieldBase.startsWith('−') || row.yieldBase.startsWith('-') ? 'is-negative' : undefined}
                      >
                        {row.yieldBase}
                      </span>
                      <span
                        role="cell"
                        className={row.yieldQuote.startsWith('+') ? 'is-positive' : row.yieldQuote.startsWith('−') || row.yieldQuote.startsWith('-') ? 'is-negative' : undefined}
                      >
                        {row.yieldQuote}
                      </span>
                    </div>
                  ))
                )}
                {showGrindersTablePagination ? (
                  <div
                    className="grai-grinders-table-pagination"
                    role="navigation"
                    aria-label="Grinders table pagination"
                  >
                    <button
                      type="button"
                      className="grai-grinders-table-pagination-btn"
                      onClick={() => setGrindersTablePage((page) => Math.max(0, page - 1))}
                      disabled={grindersTablePage === 0}
                      aria-label="Previous grinders page"
                    >
                      Prev
                    </button>
                    <span className="grai-grinders-table-pagination-status" aria-live="polite">
                      {grindersTableRangeStart}–{grindersTableRangeEnd} of {displayGrinderRows.length}
                    </span>
                    <button
                      type="button"
                      className="grai-grinders-table-pagination-btn"
                      onClick={() =>
                        setGrindersTablePage((page) => Math.min(grindersTablePageCount - 1, page + 1))
                      }
                      disabled={grindersTablePage >= grindersTablePageCount - 1}
                      aria-label="Next grinders page"
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>
          </div>
        </div>
        <div className="grai-grinders-summary-toggles-row">
          <div className="grai-grinders-summary-toggle grai-grinders-show-all-toggle-wrap">
            <button
              type="button"
              className={`grai-donut-legend-toggle grai-grinders-show-all-toggle ${isGrindersTableHidden ? 'is-collapsed' : ''}`}
              onClick={() => setIsGrindersTableHidden((hidden) => !hidden)}
              aria-expanded={!isGrindersTableHidden}
              aria-controls="grai-grinders-table"
              aria-label={
                isGrindersTableHidden
                  ? `View grinders (${grinderTotalCount})`
                  : 'Hide grinders table'
              }
            >
              <span className="grai-grinders-section-toggle-inner">
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
                <span className="grai-grinders-section-toggle-label" aria-hidden="true">
                  {isGrindersTableHidden ? 'VIEW GRINDERS' : 'HIDE GRINDERS'}
                  <span className="grai-grinders-section-toggle-count">{grinderTotalCount}</span>
                </span>
              </span>
            </button>
            {bossEndpointsToggle}
          </div>
        </div>
        <div className="grai-grinders-summary-endpoints-panel-row">
          <div
            id="grai-boss-endpoints-panel"
            className={`grai-boss-endpoints-panel${isBossEndpointsOpen ? ' is-open' : ''}`}
            aria-hidden={!isBossEndpointsOpen}
          >
            <div className="grai-boss-endpoints-panel-inner">
              {shouldMountBossEndpoints ? (
                <Suspense fallback={<span className="grai-boss-endpoints-status">Loading endpoints…</span>}>
                  <BossEndpointsTable endpoints={bossEndpoints} />
                </Suspense>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
