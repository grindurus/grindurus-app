import { useState, type ReactNode } from 'react'
import { isGrinderStatusLive, type GrinderTableRow } from '../../toreador/grinderTable'
import type { GrinderLastTxEntry } from '../../hooks/useGrinderLastTx'
import { formatTxHashShort } from '../../grinder/formatTxHash'
import {
  resolveGrinderAccountExplorerUrl,
  resolveGrinderOpenSeaUrl,
} from '../../grinder/fetchLastWalletTx'
import { shortenAddress } from '../../utils/shortenAddress'
import {
  formatGrinderTooltipAmount,
  formatGrinderUsdExact,
  formatGrinderUsdTotal,
  type GrinderTvlBreakdownRow,
  type GrinderYieldBreakdownRow,
} from '../../grai/formatGrinderUsd'
import { GraiFieldInfoButton } from './GraiFieldInfo'
import { MINT_ASSET_SOLSCAN_ICON } from './graiPageIcons'

function splitBossGrinderName(name: string): { boss: string; grinder: string } {
  const idx = name.indexOf(' / ')
  if (idx < 0) return { boss: '', grinder: name }
  return { boss: name.slice(0, idx).trim(), grinder: name.slice(idx + 3).trim() || name }
}

function GraiGrinderCustodianChip({
  custodianAddress,
  image,
  nftName,
  custodianId,
  grindersAddress,
  terminal,
  network,
}: {
  custodianAddress?: string
  image?: string
  nftName?: string
  custodianId?: number
  grindersAddress?: string
  terminal?: string
  network?: string
}) {
  const [copied, setCopied] = useState(false)
  if (!custodianAddress && !image) return null
  const label =
    nftName?.trim() ||
    (custodianId != null ? `Custodian #${custodianId}` : 'Custodian')
  const explorerHref = custodianAddress
    ? resolveGrinderAccountExplorerUrl({
        address: custodianAddress,
        terminal,
        network,
      })
    : null
  const openSeaHref = resolveGrinderOpenSeaUrl({
    grindersAddress,
    custodianId,
    terminal,
    network,
  })
  const nftImg = image ? (
    <img
      className="grai-grinder-custodian-nft"
      src={image}
      alt=""
      width={22}
      height={22}
      loading="lazy"
      decoding="async"
    />
  ) : (
    <span className="grai-grinder-custodian-nft is-placeholder" aria-hidden="true" />
  )
  return (
    <span
      className="grai-grinder-custodian"
      title={custodianAddress ? `${label} · ${custodianAddress}` : label}
    >
      {openSeaHref ? (
        <a
          href={openSeaHref}
          target="_blank"
          rel="noreferrer"
          className="grai-grinder-custodian-nft-link"
          aria-label={`View ${label} on OpenSea`}
          title="View on OpenSea"
          onClick={(event) => event.stopPropagation()}
        >
          {nftImg}
        </a>
      ) : (
        nftImg
      )}
      {custodianAddress ? (
        <button
          type="button"
          className={`grai-grinder-custodian-addr${copied ? ' is-copied' : ''}`}
          title={copied ? 'Copied!' : `Copy ${custodianAddress}`}
          aria-label={copied ? 'Copied to clipboard' : `Copy custodian ${custodianAddress}`}
          onClick={(event) => {
            event.stopPropagation()
            void navigator.clipboard.writeText(custodianAddress).then(() => {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1000)
            }).catch(() => {
              // ignore clipboard errors
            })
          }}
        >
          {copied ? 'Copied!' : shortenAddress(custodianAddress)}
        </button>
      ) : null}
      {explorerHref ? (
        <a
          href={explorerHref}
          target="_blank"
          rel="noreferrer"
          className="grai-grinder-custodian-explorer"
          aria-label="View custodian on block explorer"
          title="View on block explorer"
          onClick={(event) => event.stopPropagation()}
        >
          {MINT_ASSET_SOLSCAN_ICON}
        </a>
      ) : null}
    </span>
  )
}

export function GraiGrinderTableName({
  row,
  copied,
  onCopy,
}: {
  row: Pick<GrinderTableRow, 'id' | 'name' | 'grinderAddress' | 'status'>
  copied: boolean
  onCopy: (address: string, grinderId: string) => void
}) {
  const isLive = isGrinderStatusLive(row.status)
  const { boss, grinder } = splitBossGrinderName(row.name)
  const label = (
    <span className="grai-grinder-name-stack">
      {boss ? <span className="grai-grinder-name-boss">{boss}</span> : null}
      <span className="grai-grinder-name-grinder">{grinder}</span>
    </span>
  )

  return (
    <span role="cell" className="grai-grinder-name">
      <span
        className={`grai-grinder-active-dot${isLive ? '' : ' is-inactive'}`}
        aria-hidden="true"
      />
      {row.grinderAddress ? (
        <button
          type="button"
          className={`grai-grinder-name-copy${copied ? ' is-copied' : ''}`}
          onClick={(event) => {
            event.stopPropagation()
            onCopy(row.grinderAddress!, row.id)
          }}
          title={copied ? 'Copied to clipboard' : row.grinderAddress}
          aria-label={copied ? 'Copied to clipboard' : `Copy ${row.name} address`}
        >
          {copied ? 'Copied!' : label}
        </button>
      ) : (
        label
      )}
    </span>
  )
}

export function GraiGrinderLastTxCell({
  lastActionLabel,
  terminal,
  network,
  txState,
  custodianAddress,
  image,
  nftName,
  custodianId,
  grindersAddress,
}: {
  lastActionLabel: string
  terminal?: string
  network?: string
  txState?: GrinderLastTxEntry
  custodianAddress?: string
  image?: string
  nftName?: string
  custodianId?: number
  grindersAddress?: string
}) {
  const terminalKind = resolveGrinderTerminalKind(terminal)
  const hash =
    txState?.status === 'ready' || txState?.status === 'hashOnly' ? txState.hash.trim() : ''
  const hasHash = Boolean(hash) && hash.toLowerCase() !== '0x'
  const hashLabel = hasHash ? formatTxHashShort(hash) : '—'
  const terminalHint = terminalKind ? ` · ${terminalKind}` : ''
  const title = hasHash
    ? `${lastActionLabel}${terminalHint} · ${hash}`
    : txState?.status === 'empty'
      ? `${lastActionLabel}${terminalHint} · no last transaction from Toreador`
      : `${lastActionLabel}${terminalHint} · no last transaction`

  const icon =
    terminalKind === 'binance' ? (
      <img
        className="grai-grinder-last-tx-terminal-icon"
        src="https://assets.coingecko.com/markets/images/52/small/binance.jpg"
        alt=""
        width={16}
        height={16}
        loading="lazy"
        decoding="async"
      />
    ) : terminalKind === 'cow' ? (
      <img
        className="grai-grinder-last-tx-terminal-icon"
        src="https://raw.githubusercontent.com/cowprotocol/token-lists/main/src/public/images/cow-token.svg"
        alt=""
        width={16}
        height={16}
        loading="lazy"
        decoding="async"
      />
    ) : terminalKind === 'swap' ? (
      <svg
        className="grai-grinder-last-tx-terminal-icon grai-grinder-last-tx-terminal-icon--swap"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M16 3h5v5" />
        <path d="M8 21H3v-5" />
        <path d="M21 3 14 10" />
        <path d="m3 21 7-7" />
      </svg>
    ) : terminalKind === 'path' || terminalKind === 'lifi' ? (
      <svg
        className="grai-grinder-last-tx-terminal-icon grai-grinder-last-tx-terminal-icon--path"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="18" cy="18" r="2.5" />
        <path d="M8.5 7.5 15.5 16.5" />
      </svg>
    ) : null

  const content = (
    <>
      {icon}
      <span className="grai-grinder-last-tx-hash">{hashLabel}</span>
    </>
  )

  const txRow =
    txState?.status === 'ready' && hasHash ? (
      <a
        href={txState.explorerUrl}
        target="_blank"
        rel="noreferrer"
        className="grai-grinder-last-tx-link"
        title={title}
      >
        {content}
      </a>
    ) : (
      <span
        className={`grai-grinder-last-tx-main${!hasHash ? ' is-fallback is-placeholder' : ''}`}
        title={title}
      >
        {content}
      </span>
    )

  return (
    <span role="cell" className="grai-grinder-last-tx">
      <span className="grai-grinder-last-tx-stack">
        {txRow}
        <GraiGrinderCustodianChip
          custodianAddress={custodianAddress}
          terminal={terminal}
          network={network}
          image={image}
          nftName={nftName}
          custodianId={custodianId}
          grindersAddress={grindersAddress}
        />
      </span>
    </span>
  )
}

const GRINDER_ASSET_ICON_URLS: Record<string, string> = {
  ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  WETH: 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
  BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  WBTC: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
  SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  USDC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  ARB: 'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg',
  MATIC: 'https://assets.coingecko.com/coins/images/4713/small/polygon.png',
  POL: 'https://assets.coingecko.com/coins/images/4713/small/polygon.png',
}

function grinderAssetIconUrl(symbol: string): string | null {
  const key = symbol.trim().toUpperCase()
  if (!key) return null
  return GRINDER_ASSET_ICON_URLS[key] ?? null
}

/** Split `"10,000 USDT"` / `"+1.2 ETH"` into amount prefix + ticker. */
function splitGrinderAmountTicker(value: string): { amount: string; ticker: string | null } {
  const trimmed = value.trim()
  if (!trimmed || trimmed === '—') return { amount: trimmed || '—', ticker: null }
  const parts = trimmed.split(/\s+/)
  if (parts.length < 2) return { amount: trimmed, ticker: null }
  const ticker = parts[parts.length - 1]!
  if (!/^[A-Za-z][A-Za-z0-9.-]*$/.test(ticker)) return { amount: trimmed, ticker: null }
  return { amount: parts.slice(0, -1).join(' '), ticker }
}

export function GraiGrinderAmountCell({
  value,
  className,
}: {
  value: string
  className?: string
}) {
  const { amount, ticker } = splitGrinderAmountTicker(value)
  const iconUrl = ticker ? grinderAssetIconUrl(ticker) : null
  return (
    <span role="cell" className={['grai-grinder-amount-cell', className].filter(Boolean).join(' ')}>
      <span className="grai-grinder-amount-value">{amount}</span>
      {ticker ? (
        <span className="grai-grinder-amount-ticker">
          {iconUrl ? (
            <img
              className="grai-grinder-amount-icon"
              src={iconUrl}
              alt=""
              width={14}
              height={14}
              loading="lazy"
              decoding="async"
            />
          ) : null}
          <span>{ticker}</span>
        </span>
      ) : null}
    </span>
  )
}

function resolveGrinderTerminalKind(
  terminal?: string,
): 'binance' | 'cow' | 'swap' | 'path' | 'lifi' | null {
  const value = terminal?.trim().toLowerCase() ?? ''
  if (!value) return null
  const kind = value.split('@')[0]?.trim() || value
  if (kind === 'ccxt:binance' || value.includes('binance')) return 'binance'
  if (
    kind === 'eip155:cow' ||
    kind === 'cow' ||
    kind === 'evm_cow_protocol' ||
    value.includes(':cow') ||
    kind.includes('cow')
  ) {
    return 'cow'
  }
  if (kind === 'swap' || value.startsWith('swap@') || value.includes('.swap')) return 'swap'
  if (kind === 'path' || value.startsWith('path@') || value.includes('.path')) return 'path'
  if (kind === 'lifi' || value.startsWith('lifi@') || value.includes('lifi')) return 'lifi'
  return null
}

function buildGrinderTvlValueHint(totalUsd: number, rows: GrinderTvlBreakdownRow[]): ReactNode {
  return (
    <>
      <span className="grai-field-info-tooltip-title">{formatGrinderUsdExact(totalUsd)}</span>
      <span className="grai-field-info-tooltip-section">
        <span className="grai-field-info-tooltip-section-label">Formula</span>
        <code>balance_quote + balance_base × spot_price</code>
        <span className="grai-field-info-tooltip-formula-note">Summed across all grinders below.</span>
      </span>
      <span className="grai-field-info-tooltip-section">
        <span className="grai-field-info-tooltip-section-label">Breakdown</span>
        <ul className="grai-field-info-tooltip-list grai-field-info-tooltip-list--breakdown">
          {rows.map((row) => (
            <li key={row.id}>
              <strong>{row.name}</strong>
              <span className="grai-field-info-tooltip-breakdown-formula">
                {formatGrinderTooltipAmount(row.balanceQuote)} + {formatGrinderTooltipAmount(row.balanceBase)} ×{' '}
                {formatGrinderTooltipAmount(row.spotPrice)} = {formatGrinderUsdExact(row.tvlUsd)}
              </span>
            </li>
          ))}
        </ul>
      </span>
    </>
  )
}

export function GraiGrinderTvlValue({
  totalUsd,
  rows,
}: {
  totalUsd: number
  rows: GrinderTvlBreakdownRow[]
}) {
  return (
    <GraiFieldInfoButton
      className="grai-grinders-group-title-value"
      hint={buildGrinderTvlValueHint(totalUsd, rows)}
      ariaLabel={`Value locked ${formatGrinderUsdExact(totalUsd)}`}
      structured
      tooltipClassName="is-breakdown"
    >
      {formatGrinderUsdTotal(totalUsd)}
    </GraiFieldInfoButton>
  )
}

function buildGrinderYieldValueHint(totalUsd: number, rows: GrinderYieldBreakdownRow[]): ReactNode {
  return (
    <>
      <span className="grai-field-info-tooltip-title">{formatGrinderUsdExact(totalUsd)}</span>
      <span className="grai-field-info-tooltip-section">
        <span className="grai-field-info-tooltip-section-label">Formula</span>
        <code>yield_quote + yield_base × spot_price</code>
        <span className="grai-field-info-tooltip-formula-note">Summed across all grinders below.</span>
      </span>
      <span className="grai-field-info-tooltip-section">
        <span className="grai-field-info-tooltip-section-label">Breakdown</span>
        <ul className="grai-field-info-tooltip-list grai-field-info-tooltip-list--breakdown">
          {rows.map((row) => (
            <li key={row.id}>
              <strong>{row.name}</strong>
              <span className="grai-field-info-tooltip-breakdown-formula">
                {formatGrinderTooltipAmount(row.yieldQuoteValue)} + {formatGrinderTooltipAmount(row.yieldBaseValue)} ×{' '}
                {formatGrinderTooltipAmount(row.spotPrice)} = {formatGrinderUsdExact(row.yieldUsd)}
              </span>
            </li>
          ))}
        </ul>
      </span>
    </>
  )
}

export function GraiGrinderYieldValue({
  totalUsd,
  rows,
}: {
  totalUsd: number
  rows: GrinderYieldBreakdownRow[]
}) {
  return (
    <GraiFieldInfoButton
      className="grai-grinders-group-title-value is-positive"
      hint={buildGrinderYieldValueHint(totalUsd, rows)}
      ariaLabel={`Yield ${formatGrinderUsdExact(totalUsd)}`}
      structured
      tooltipClassName="is-breakdown"
    >
      {formatGrinderUsdTotal(totalUsd)}
    </GraiFieldInfoButton>
  )
}

function buildGrinderCountHint(active: number, total: number, isLive: boolean, isToreadorUnavailable: boolean): ReactNode {
  return (
    <>
      <span className="grai-field-info-tooltip-title">
        {active}/{total} grinders
      </span>
      <span className="grai-field-info-tooltip-section">
        <span className="grai-field-info-tooltip-section-label">Active</span>
        Grinders in INITIALIZED or GRINDING status.
      </span>
      <span className="grai-field-info-tooltip-section">
        <span className="grai-field-info-tooltip-section-label">Total</span>
        All grinders returned by Toreador (<code>GET /table</code>).
      </span>
      <span className="grai-field-info-tooltip-section">
        <span className="grai-field-info-tooltip-section-label">Data source</span>
        Toreador API.
      </span>
      {isToreadorUnavailable ? (
        <p className="grai-field-info-tooltip-note">Toreador API is currently unreachable.</p>
      ) : !isLive ? (
        <p className="grai-field-info-tooltip-note">Waiting for grinder data from Toreador.</p>
      ) : null}
    </>
  )
}

export function GraiGrinderCountValue({
  active,
  total,
  isLive,
  isToreadorUnavailable,
}: {
  active: number
  total: number
  isLive: boolean
  isToreadorUnavailable: boolean
}) {
  return (
    <GraiFieldInfoButton
      className="grai-grinders-group-general-value"
      hint={buildGrinderCountHint(active, total, isLive, isToreadorUnavailable)}
      ariaLabel={`${active} of ${total} grinders active`}
      structured
    >
      {active}/{total}{' '}
      <span className="grai-grinders-group-general-value-label">GRINDERS</span>
    </GraiFieldInfoButton>
  )
}

