import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToreadorGrinderTable } from '../../hooks/useToreadorGrinderTable'
import { useGrinderLastTx } from '../../hooks/useGrinderLastTx'
import {
  summarizeGrinderTableRows,
  sumGrinderRowYieldUsd,
} from '../../toreador/grinderTable'
import { summaryForCaip2Network } from '../../toreador/toreadorApi'
import {
  formatGrinderTokenAmount,
  tickerFromGrinderAmount,
} from '../../grai/formatGrinderUsd'
import { caip2NetworksMatch } from '../../wallets/caip2Network'
import {
  GraiGrinderAmountCell,
  GraiGrinderCountValue,
  GraiGrinderLastTxCell,
  GraiGrinderTableName,
  GraiGrinderTvlValue,
  GraiGrinderYieldValue,
} from './GraiGrinderCells'
import { GraiFieldInfoButton } from './GraiFieldInfo'
import { GraiGrindersNetworkSelect } from './GraiGrindersNetworkSelect'
import {
  GRINDERS_COLUMN_ICONS,
  GRINDER_TVL_INFO_HINT,
  GRINDER_YIELD_INFO_HINT,
} from './graiPageIcons'

const GRINDERS_TABLE_PAGE_SIZE = 10

type GraiGrindersSectionProps = {
  /** When false, hide VIEW GRINDERS toggle + table (landing summary plaque). Default true. */
  showTableToggle?: boolean
  /** When false, hide network filter (landing always shows TOTAL). Default true. */
  showNetworkFilter?: boolean
  /** Override TVL column label (e.g. landing mobile hero). */
  tvlLabel?: string
}

export function GraiGrindersSection({
  showTableToggle = true,
  showNetworkFilter = true,
  tvlLabel,
}: GraiGrindersSectionProps) {
  const navigate = useNavigate()
  const [isGrindersTableHidden, setIsGrindersTableHidden] = useState(true)
  /** ``null`` = TOTAL; CAIP-2 when a network is selected (wallet not required). */
  const [grindersNetworkCaip2, setGrindersNetworkCaip2] = useState<string | null>(null)
  const [copiedGrinderId, setCopiedGrinderId] = useState<string | null>(null)
  const [grindersTablePage, setGrindersTablePage] = useState(0)
  const {
    rows: grinderRows,
    groups: grinderGroups,
    summary: grinderTableSummary,
    nextDistributeYieldAt,
    isLive: isGrinderLive,
    isBootstrapped: isGrinderBootstrapped,
    isToreadorUnavailable,
  } = useToreadorGrinderTable()
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    if (!nextDistributeYieldAt) return
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [nextDistributeYieldAt])
  const nextDistributeYieldLabel = useMemo(() => {
    if (!nextDistributeYieldAt) return null
    const target = Date.parse(nextDistributeYieldAt)
    if (!Number.isFinite(target)) return null
    const sec = Math.max(0, Math.ceil((target - nowMs) / 1000))
    if (sec < 60) return `${sec}s`
    if (sec < 3600) {
      const m = Math.floor(sec / 60)
      const s = sec % 60
      return s > 0 ? `${m}m ${s}s` : `${m}m`
    }
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }, [nextDistributeYieldAt, nowMs])
  // TOTAL → all toreador groups + orphans. Network → that toreador’s ``rows`` only.
  const displayGrinderRows = useMemo(() => {
    if (!grindersNetworkCaip2) return grinderRows
    const group = grinderGroups.find((entry) =>
      caip2NetworksMatch(entry.toreadorId, grindersNetworkCaip2),
    )
    return group?.rows ?? []
  }, [grinderGroups, grinderRows, grindersNetworkCaip2])
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
  const grinderLastTx = useGrinderLastTx(displayGrinderRows, isGrinderLive)
  const isGrinderLoading = !isGrinderBootstrapped
  const networkSummary = useMemo(() => {
    if (!grindersNetworkCaip2) return null
    return summaryForCaip2Network(grinderTableSummary, grindersNetworkCaip2) ?? null
  }, [grinderTableSummary, grindersNetworkCaip2])
  const grinderTotalCount = displayGrinderSummary.totalCount
  const grinderActiveCount = displayGrinderSummary.activeCount
  // TOTAL → aggregate summary; network filter → that toreador’s TVL / indexed yield.
  const grinderTvlUsd = grindersNetworkCaip2
    ? (networkSummary?.totalValueLocked ?? displayGrinderSummary.totalValueLocked)
    : (grinderTableSummary.totalValueLocked || displayGrinderSummary.totalValueLocked)
  const scopedIndexedYield = grindersNetworkCaip2
    ? networkSummary?.totalIndexedYield
    : grinderTableSummary.totalIndexedYield
  const hasOnchainIndexedYield = typeof scopedIndexedYield === 'number'
  const grinderYieldUsd = hasOnchainIndexedYield
    ? scopedIndexedYield
    : sumGrinderRowYieldUsd(displayGrinderRows)
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
    setGrindersTablePage(0)
  }, [grindersNetworkCaip2])

  useEffect(() => {
    setGrindersTablePage((page) => Math.min(page, grindersTablePageCount - 1))
  }, [displayGrinderRows.length, grindersTablePageCount])

  const grindersSummaryNetworkRow =
    showNetworkFilter && isCompactGrindersLayout ? (
      <div className="grai-grinders-summary-filter-wrap grai-grinders-summary-filter-wrap--compact-row grai-grinders-summary-filter-wrap--network-only">
        <span className="grai-grinders-summary-toolbar-network">
          <span className="grai-grinders-network-action">
            <GraiGrindersNetworkSelect
              networkCaip2={grindersNetworkCaip2}
              onNetworkChange={setGrindersNetworkCaip2}
              ariaLabel="Filter grinders by network"
              variant="inline"
            />
          </span>
        </span>
      </div>
    ) : null

  const networkGridCols = showNetworkFilter
  const fieldHints = showTableToggle
  const shellClassName = [
    'grai-grinders-summary-shell',
    !showNetworkFilter ? 'grai-grinders-summary-shell--total-only' : '',
    !showTableToggle ? 'grai-grinders-summary-shell--landing' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="grai-bottom-row">
      <div className={shellClassName} id="grai-grinders-summary">
        {grindersSummaryNetworkRow}
        <div className="grai-grinders-row grai-grinders-row--group grai-grinders-row--summary" role="row">
          {showNetworkFilter && !isCompactGrindersLayout ? (
          <span
            role="columnheader"
            className="grai-grinders-group-title is-network is-stacked grai-grinders-network-slot--desktop"
          >
            <GraiGrindersNetworkSelect
              networkCaip2={grindersNetworkCaip2}
              onNetworkChange={setGrindersNetworkCaip2}
              ariaLabel="Filter grinders by network"
              variant="stacked"
            />
          </span>
          ) : null}
          <span role="columnheader" className="grai-grinders-group-general is-stacked grai-grinders-summary-general">
            <span className="grai-grinders-group-general-top">
              <span
                className={`grai-grinder-active-dot${isGrinderLive ? '' : ' is-inactive'}`}
                aria-hidden="true"
              />
              <span className="grai-grinders-live-label grai-grinders-summary-mini-label">LIVE</span>
            </span>
            {isGrinderLoading || isToreadorUnavailable ? (
              <span className="grai-grinders-group-general-value grai-grinders-group-general-value--placeholder">
                {isGrinderLoading ? '…' : '—'}
              </span>
            ) : (
              <GraiGrinderCountValue
                active={grinderActiveCount}
                total={grinderTotalCount}
                isLive={isGrinderLive}
                isToreadorUnavailable={isToreadorUnavailable}
                interactive={fieldHints}
              />
            )}
          </span>
          <span
            role="columnheader"
            className="grai-grinders-group-title is-tvl is-stacked"
            style={networkGridCols ? { gridColumn: '3 / span 2' } : undefined}
          >
            <GraiFieldInfoButton
              className="grai-grinders-group-title-label"
              hint={GRINDER_TVL_INFO_HINT}
              ariaLabel="Total Value Locked"
              structured
              interactive={fieldHints}
            >
              <span className="grai-grinders-group-title-icon" aria-hidden="true">
                {GRINDERS_COLUMN_ICONS.quote}
              </span>
              {tvlLabel ?? 'TVL'}
            </GraiFieldInfoButton>
            {isGrinderLoading || isToreadorUnavailable ? (
              <span className="grai-grinders-group-title-value grai-grinders-group-title-value--placeholder">
                {isGrinderLoading ? '…' : '—'}
              </span>
            ) : (
              <GraiGrinderTvlValue
                totalUsd={grinderTvlUsd}
                rows={isGrinderLive ? displayGrinderRows : []}
                interactive={fieldHints}
              />
            )}
          </span>
          <span
            role="columnheader"
            className="grai-grinders-group-title is-yield is-stacked"
            style={networkGridCols ? { gridColumn: '5 / span 2' } : undefined}
          >
            <GraiFieldInfoButton
              className="grai-grinders-group-title-label"
              hint={GRINDER_YIELD_INFO_HINT}
              ariaLabel="How indexed yield is calculated"
              structured
              interactive={fieldHints}
            >
              <span className="grai-grinders-group-title-icon" aria-hidden="true">
                {GRINDERS_COLUMN_ICONS.yieldQuote}
              </span>
              INDEXED YIELD
            </GraiFieldInfoButton>
            {isGrinderLoading || isToreadorUnavailable ? (
              <span className="grai-grinders-group-title-value grai-grinders-group-title-value--placeholder">
                {isGrinderLoading ? '…' : '—'}
              </span>
            ) : (
              <GraiGrinderYieldValue
                totalUsd={grinderYieldUsd}
                rows={isGrinderLive ? displayGrinderRows : []}
                onChain={hasOnchainIndexedYield}
                interactive={fieldHints}
              />
            )}
          </span>
        </div>
        {showTableToggle ? (
        <div className="grai-grinders-summary-table-row">
          <div className="grai-grinders-grinders-panel-slot">
        <section
          className={`grai-bottom-card grai-bottom-card--table grai-grinders-table-panel${isGrindersTableHidden ? '' : ' is-open'}`}
          aria-hidden={isGrindersTableHidden}
          aria-label="Grinders in system"
        >
          <div className="grai-grinders-table-panel-inner">
            {isGrinderLoading ? (
              <p className="grai-grinders-status is-loading" role="status">
                <span className="grai-grinders-status-spinner" aria-hidden />
                <span className="grai-grinders-status-copy">
                  Loading grinder data from Toreador…
                </span>
              </p>
            ) : isToreadorUnavailable ? (
              <p className="grai-grinders-status is-unavailable" role="status">
                Toreador API is unreachable. Grinders data is unavailable. Funds are held by custodians.
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
                    <span className="grai-grinders-col-head-label">Last tx</span>
                  </span>
                  <span role="columnheader" className="grai-grinders-col-grinder" aria-label="Grinders">
                    <button
                      type="button"
                      className="grai-grinders-col-grinder-link"
                      title="Open Grinders"
                      aria-label="Open Grinders page"
                      onClick={() => navigate('/grinders')}
                    >
                      <span className="grai-grinders-col-head-label">GRINDERS</span>
                    </button>
                  </span>
                  <span role="columnheader" className="grai-grinders-col-head is-base">
                    <span className="grai-grinders-col-head-label">Base</span>
                  </span>
                  <span role="columnheader" className="grai-grinders-col-head is-quote">
                    <span className="grai-grinders-col-head-label">Quote</span>
                  </span>
                  <span role="columnheader" className="grai-grinders-col-head is-yield-base">
                    <span className="grai-grinders-col-head-label">Yield base</span>
                  </span>
                  <span role="columnheader" className="grai-grinders-col-head is-yield-quote">
                    <span className="grai-grinders-col-head-label">Yield quote</span>
                  </span>
                </div>
                {displayGrinderRows.length === 0 ? (
                  <p className="grai-grinders-status is-empty" role="status">
                    {grindersNetworkCaip2
                      ? `No grinders on ${grindersNetworkCaip2}.`
                      : 'No grinders reported by Toreador.'}
                  </p>
                ) : (
                  paginatedGrinderRows.map((row) => (
                    <div className="grai-grinders-row" role="row" key={row.id}>
                      <GraiGrinderLastTxCell
                        lastActionLabel={row.lastActionLabel}
                        terminal={row.terminal}
                        toreador={row.toreador}
                        txState={grinderLastTx[row.id]}
                        custodianAddress={row.custodianAddress}
                        image={row.image}
                        nftName={row.nftName}
                        custodianId={row.custodianId}
                        grindersAddress={row.grindersAddress}
                      />
                      <GraiGrinderTableName
                        row={row}
                        copied={copiedGrinderId === row.id}
                        onCopy={copyGrinderTableAddress}
                      />
                      <GraiGrinderAmountCell
                        value={row.base}
                        usdValue={row.balanceBase * row.spotPrice}
                      />
                      <GraiGrinderAmountCell value={row.quote} usdValue={row.balanceQuote} />
                      <GraiGrinderAmountCell
                        value={formatGrinderTokenAmount(
                          row.yieldBase,
                          row.baseSymbol || tickerFromGrinderAmount(row.base),
                          { signed: true },
                        )}
                        yieldNumeric={row.yieldBase}
                        className={
                          row.yieldBase > 0
                            ? 'is-positive'
                            : row.yieldBase < 0
                              ? 'is-negative'
                              : undefined
                        }
                      />
                      <GraiGrinderAmountCell
                        value={formatGrinderTokenAmount(
                          row.yieldQuote,
                          row.quoteSymbol || tickerFromGrinderAmount(row.quote),
                          { signed: true },
                        )}
                        yieldNumeric={row.yieldQuote}
                        className={
                          row.yieldQuote > 0
                            ? 'is-positive'
                            : row.yieldQuote < 0
                              ? 'is-negative'
                              : undefined
                        }
                      />
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
        ) : null}
        {showTableToggle ? (
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
              {nextDistributeYieldLabel ? (
                <span className="grai-grinders-next-distribute" aria-live="polite">
                  next distribute yield: {nextDistributeYieldLabel}
                </span>
              ) : null}
            </button>
          </div>
        </div>
        ) : null}
      </div>
    </div>
  )
}
