export const BALANCE_COLUMN_ICONS = {
  assets: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 20 7v10l-8 5-8-5V7l8-5z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  ),
  seniorVault: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l7 4v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V7l7-4z" />
    </svg>
  ),
  juniorVault: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  ),
  allocated: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="12" cy="18" r="2" />
      <path d="M8 6h8" />
      <path d="M7.3 7.7l5.4 9.6" />
      <path d="M16.7 7.7l-5.4 9.6" />
    </svg>
  ),
} as const

export const GRINDERS_COLUMN_ICONS = {
  lastAction: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  ),
  lastActionTime: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  base: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8" />
      <path d="M9.5 10.5h3a2 2 0 1 1 0 4h-3" />
    </svg>
  ),
  quote: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2v20" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  yieldBase: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </svg>
  ),
  yieldQuote: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19h16" />
      <path d="M7 15l3-3 3 3 5-6" />
    </svg>
  ),
  network: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
} as const

export const ENDPOINTS_TABLE_COLUMN_ICONS = {
  uri: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  name: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
      <rect x="4" y="7" width="16" height="13" rx="2" />
    </svg>
  ),
  grindersMax: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h10" />
      <path d="M18 16v4" />
      <path d="M16 18h4" />
    </svg>
  ),
  auth: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="16" r="1" />
    </svg>
  ),
} as const

export const ENDPOINTS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="3" width="20" height="7" rx="2" />
    <rect x="2" y="14" width="20" height="7" rx="2" />
    <path d="M6 6.5h.01" />
    <path d="M6 17.5h.01" />
    <path d="M10 6.5h8" />
    <path d="M10 17.5h8" />
  </svg>
)

export const ENDPOINTS_RESET_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
)

export const BALANCE_FIELD_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <ellipse cx="12" cy="7" rx="8" ry="3" />
    <path d="M4 7v4c0 1.7 3.6 3 8 3s8-1.3 8-3V7" />
    <path d="M4 11v4c0 1.7 3.6 3 8 3s8-1.3 8-3v-4" />
  </svg>
)

export const SENIOR_VAULT_FIELD_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l7 4v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V7l7-4z" />
  </svg>
)

export const JUNIOR_VAULT_FIELD_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 12l10 5 10-5" />
  </svg>
)

export const AMOUNT_PREFIX_PLUS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 12h8" />
    <path d="M12 8v8" />
  </svg>
)

export const VAULT_AMOUNT_PLUS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const FIELD_INFO_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
)

export const MINT_ASSET_SOLSCAN_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
)

export const ACTION_SWITCH_ICONS = {
  mint: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </svg>
  ),
  burn: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  ),
} as const

export const GRINDER_TVL_INFO_HINT = (
  <>
    <span className="grai-field-info-tooltip-title">Total Value Locked</span>
    <span className="grai-field-info-tooltip-section">
      <span className="grai-field-info-tooltip-section-label">Formula</span>
      Per grinder: <code>balance_quote + balance_base × spot_price</code>
      <span className="grai-field-info-tooltip-formula-note">
        Value locked is the sum of this value across all grinders.
      </span>
    </span>
    <span className="grai-field-info-tooltip-section">
      <span className="grai-field-info-tooltip-section-label">Data source</span>
      <ul className="grai-field-info-tooltip-list">
        <li>
          <strong>Live</strong> — Boss logs stream
        </li>
        <li>
          <strong>Demo</strong> — placeholder when disconnected
        </li>
      </ul>
    </span>
    <p className="grai-field-info-tooltip-note">
      <code>spot_price</code> is quote per base unit from Boss logs. Displayed as USD when quote is USDC/USDT.
    </p>
  </>
)

export const GRINDER_YIELD_INFO_HINT = (
  <>
    <span className="grai-field-info-tooltip-title">Yield</span>
    <span className="grai-field-info-tooltip-section">
      <span className="grai-field-info-tooltip-section-label">Formula</span>
      Per grinder: <code>yield_quote + yield_base × spot_price</code>
      <span className="grai-field-info-tooltip-formula-note">
        Yield is the sum of this value across all grinders.
      </span>
    </span>
    <span className="grai-field-info-tooltip-section">
      <span className="grai-field-info-tooltip-section-label">Data source</span>
      <ul className="grai-field-info-tooltip-list">
        <li>
          <strong>Live</strong> — Boss logs stream
        </li>
        <li>
          <strong>Demo</strong> — placeholder when disconnected
        </li>
      </ul>
    </span>
    <p className="grai-field-info-tooltip-note">
      <code>spot_price</code> is quote per base unit from Boss logs. Displayed as USD when quote is USDC/USDT.
    </p>
  </>
)

export const GRINDER_UPTIME_INFO_HINT = (
  <>
    <span className="grai-field-info-tooltip-title">Uptime</span>
    <span className="grai-field-info-tooltip-section">
      <span className="grai-field-info-tooltip-section-label">Definition</span>
      Share of time grinders stay operational — grinding, allocating, or distributing — rather than halted or disabled, measured over the last 90 days.
    </span>
    <span className="grai-field-info-tooltip-section">
      <span className="grai-field-info-tooltip-section-label">Data source</span>
      <ul className="grai-field-info-tooltip-list">
        <li>
          <strong>Live</strong> — rolling 90-day window from Boss grinder status history
        </li>
      </ul>
    </span>
    <p className="grai-field-info-tooltip-note">
      Shown as a percentage of the last 90 days when Boss data is available.
    </p>
  </>
)
