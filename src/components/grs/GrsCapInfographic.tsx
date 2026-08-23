import { useMemo, useState } from 'react'
import { GraiFieldInfoButton } from '../grai/GraiFieldInfo'
import { GATE_LABELS, GRS_DECIMALS } from '../../grs/constants'
import {
  GRS_CAP_GROUPS,
  GRS_CAP_SUPPLY_MILLIONS,
  GRS_TGE_SPLIT,
  formatGrsCompact,
  formatUsedPercent,
  millionsToRaw,
  type GrsCapBucketSpec,
  type GrsCapGroupSpec,
} from '../../grs/capTable'
import type { GrsAllocation, GrsSnapshot } from '../../grs/evm/readProtocol'
import { navigateToGrsSection } from '../../utils/grsNavigation'

type Props = {
  snapshot: GrsSnapshot | null
  isLoading: boolean
}

type Focus = {
  group: GrsCapGroupSpec
  bucket?: GrsCapBucketSpec
}

function allocationRow(
  allocations: GrsAllocation[] | null | undefined,
  bucket: number,
): GrsAllocation | undefined {
  return allocations?.find((item) => item.bucket === bucket)
}

function usageCap(
  allocations: GrsAllocation[] | null | undefined,
  bucket: number,
  millions: number,
  decimals: number,
  salesRemaining: bigint | null,
): { spent: bigint; cap: bigint } {
  const row = allocationRow(allocations, bucket)
  if (row) {
    const cap =
      bucket === 0 ? (row.cap > millionsToRaw(millions, decimals) ? millionsToRaw(millions, decimals) : row.cap) : row.cap
    return { spent: row.spent, cap: cap > 0n ? cap : millionsToRaw(millions, decimals) }
  }
  const cap = millionsToRaw(millions, decimals)
  if (bucket === 0 && salesRemaining != null) {
    return { spent: cap > salesRemaining ? cap - salesRemaining : 0n, cap }
  }
  return { spent: 0n, cap }
}

export function GrsCapInfographic({ snapshot, isLoading }: Props) {
  const [focus, setFocus] = useState<Focus | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const decimals = snapshot?.tokenSalesDecimals ?? snapshot?.decimals ?? GRS_DECIMALS
  const allocations = snapshot?.allocations ?? null
  const salesRemaining = snapshot?.tokenSalesRemaining ?? allocationRow(allocations, 0)?.remaining ?? null

  const granted = useMemo(() => {
    if (allocations && allocations.length > 0) {
      return allocations.reduce((sum, row) => sum + row.spent, 0n)
    }
    if (snapshot?.tokenSalesSpent != null) return snapshot.tokenSalesSpent
    if (salesRemaining == null) return 0n
    const salesCap =
      snapshot?.tokenSalesCap ??
      millionsToRaw(GRS_CAP_GROUPS[0]?.buckets[0]?.millions ?? 0, decimals)
    return salesCap > salesRemaining ? salesCap - salesRemaining : 0n
  }, [allocations, decimals, salesRemaining, snapshot?.tokenSalesCap, snapshot?.tokenSalesSpent])

  const totalRaw = millionsToRaw(GRS_CAP_SUPPLY_MILLIONS, decimals)
  const grantedUsed = formatUsedPercent(granted, totalRaw)

  const detail = (() => {
    if (focus?.bucket) {
      const { spent, cap } = usageCap(
        allocations,
        focus.bucket.bucket,
        focus.bucket.millions,
        decimals,
        salesRemaining,
      )
      const leftover = cap > spent ? formatGrsCompact(cap - spent, decimals) : '0'
      return `${focus.bucket.label} · ${focus.bucket.pct}% cap · ${GATE_LABELS[focus.bucket.gate]} · used ${formatUsedPercent(spent, cap)}% · ${leftover} left`
    }
    if (focus) {
      const usage = focus.group.buckets.reduce(
        (acc, bucket) => {
          const row = usageCap(allocations, bucket.bucket, bucket.millions, decimals, salesRemaining)
          return { spent: acc.spent + row.spent, cap: acc.cap + row.cap }
        },
        { spent: 0n, cap: 0n },
      )
      return `${focus.group.label} · ${focus.group.pct}% · ${focus.group.millions}M · used ${formatUsedPercent(usage.spent, usage.cap)}%`
    }
    if (salesRemaining != null) {
      const sales = GRS_CAP_GROUPS[0]?.buckets[0]
      const usage = usageCap(allocations, 0, sales?.millions ?? 150, decimals, salesRemaining)
      return `Token sales ${formatGrsCompact(salesRemaining, decimals)} of ${sales?.millions ?? 150}M listed · used ${formatUsedPercent(usage.spent, usage.cap)}%`
    }
    return 'TGE float 200M · 400M gated · 400M calendar / vote locked'
  })()

  const handleJump = (jump: GrsCapBucketSpec['jump']) => {
    if (jump === 'sales' || jump === 'vesting') navigateToGrsSection(jump)
  }

  return (
    <aside className="grs-cap-infographic grai-liquidation-ops-block" aria-label="GRS 1 billion token cap table">
      <h3 className="grai-liquidation-ops-heading">
        <button
          type="button"
          className={`grai-referral-dash-collapse${isCollapsed ? ' is-collapsed' : ''}`}
          onClick={() => setIsCollapsed((collapsed) => !collapsed)}
          aria-expanded={!isCollapsed}
          aria-controls="grs-cap-layout"
          aria-label={isCollapsed ? 'Show allocation' : 'Hide allocation'}
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
        Allocation
      </h3>
      <div
        className={`grai-liquidation-ops-body${isCollapsed ? '' : ' is-open'}`}
        id="grs-cap-layout"
        aria-hidden={isCollapsed}
      >
        <div className="grai-liquidation-ops-body-inner">
      <div className="grs-cap-head">
        <div className="grs-cap-head-copy">
          <span className="grs-cap-kicker">
            Supply
            <GraiFieldInfoButton
              className="grai-action-metric-label-info"
              hint="Fixed 1B genesis on home. Five groups of 20%. Spokes only mint and burn via the OFT — they cannot add supply."
            />
          </span>
          <strong className="grs-cap-total">1B GRS</strong>
        </div>
        <div className="grs-cap-head-stat">
          <span className="grs-cap-kicker">{isLoading ? 'Reading' : 'Used'}</span>
          <strong className="grs-cap-total-side">{grantedUsed}%</strong>
        </div>
      </div>

      <div className="grs-cap-map" role="list">
        {GRS_CAP_GROUPS.map((group) => (
          <div
            key={group.id}
            className={`grs-cap-group grs-cap-group--${group.id}`}
            role="listitem"
            onMouseEnter={() => setFocus({ group })}
            onMouseLeave={() => setFocus(null)}
          >
            <div className="grs-cap-group-head">
              <span className="grs-cap-group-name">{group.label}</span>
              <span className="grs-cap-group-amt">
                {group.pct}% / {group.millions}M
              </span>
              <span className="grs-cap-group-used">
                {formatUsedPercent(
                  group.buckets.reduce((sum, bucket) => {
                    return (
                      sum + usageCap(allocations, bucket.bucket, bucket.millions, decimals, salesRemaining).spent
                    )
                  }, 0n),
                  millionsToRaw(group.millions, decimals),
                )}
                % used
              </span>
            </div>
            <div className="grs-cap-buckets">
              {group.buckets.map((bucket) => {
                const { spent, cap } = usageCap(
                  allocations,
                  bucket.bucket,
                  bucket.millions,
                  decimals,
                  salesRemaining,
                )
                const usedLabel = formatUsedPercent(spent, cap)
                return (
                  <button
                    key={bucket.bucket}
                    type="button"
                    className={`grs-cap-bucket${bucket.jump ? ' is-jump' : ''}${
                      focus?.bucket?.bucket === bucket.bucket ? ' is-focus' : ''
                    }`}
                    style={{
                      flexGrow: bucket.millions,
                      ['--spent' as string]: `${usedLabel}%`,
                    }}
                    title={`${bucket.label}: ${bucket.millions}M · used ${usedLabel}%`}
                    onMouseEnter={() => setFocus({ group, bucket })}
                    onFocus={() => setFocus({ group, bucket })}
                    onClick={() => handleJump(bucket.jump)}
                  >
                    <span className="grs-cap-bucket-label">
                      {bucket.short}
                      <span className="grs-cap-bucket-amt">{bucket.millions}M</span>
                      <span className="grs-cap-bucket-used">{usedLabel}%</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="grs-cap-tge" aria-hidden="true">
        {GRS_TGE_SPLIT.map((slice) => (
          <span key={slice.id} className={`grs-cap-tge-slice grs-cap-tge-slice--${slice.id}`}>
            {slice.pct}% · {slice.millions}M
          </span>
        ))}
      </div>
      <ul className="grs-cap-tge-legend">
        {GRS_TGE_SPLIT.map((slice) => (
          <li key={slice.id}>
            <span className={`grs-cap-dot grs-cap-dot--${slice.id}`} />
            {slice.label} {slice.millions}M
          </li>
        ))}
      </ul>

      {granted > 0n ? (
        <div className="grs-cap-granted" aria-hidden="true">
          <span className="grs-cap-granted-fill" style={{ width: `${grantedUsed}%` }} />
        </div>
      ) : null}

      <p className="grs-cap-detail">{detail}</p>
        </div>
      </div>
    </aside>
  )
}
