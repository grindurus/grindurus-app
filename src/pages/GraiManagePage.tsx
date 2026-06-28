import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { PublicKey } from '@solana/web3.js'
import type { GraiAsset } from '../grai/knownMints'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { fetchGraiStateFixedFields } from '../grai/graiStateCache'
import { fetchMintDecimals, formatTokenBalance, normalizeDecimalInput } from '../grai/onchain'
import { formatVaultBalanceDisplay } from '../grai/formatVaultBalance'
import { KNOWN_GRINDERS } from '../grai/grinders'
import { USD_SCALE } from '../grai/tokenomics'
import { useGraiAllocate } from '../hooks/useGraiAllocate'
import { useGraiAssets } from '../hooks/useGraiAssets'
import { useGraiDistribute } from '../hooks/useGraiDistribute'
import { useGraiVaultBalances } from '../hooks/useGraiVaultBalances'
import { useCustodyWalletBalances } from '../hooks/useCustodyWalletBalances'
import { useGrindersCustodyBalances } from '../hooks/useGrindersCustodyBalances'
import { useSolanaWallet } from '../hooks/useSolanaWallet'
import { navigateTo } from '../utils/navigate'
import './GraiPage.css'
import './GraiManagePage.css'

const ASSET_FIELD_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <ellipse cx="12" cy="7" rx="8" ry="3" />
    <path d="M4 7v4c0 1.7 3.6 3 8 3s8-1.3 8-3V7" />
    <path d="M4 11v4c0 1.7 3.6 3 8 3s8-1.3 8-3v-4" />
  </svg>
)

const MINT_ASSET_SOLSCAN_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
)

const AMOUNT_FIELD_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v8" />
    <path d="M9.5 10.5h3a2 2 0 1 1 0 4h-3" />
  </svg>
)

const CUSTODY_FIELD_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
    <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
  </svg>
)

const YIELD_AMOUNT_FIELD_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M14 7h7v7" />
  </svg>
)

const JUNIOR_VAULT_TABLE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 12l10 5 10-5" />
  </svg>
)

const ALLOCATED_TABLE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="6" cy="6" r="2" />
    <circle cx="18" cy="6" r="2" />
    <circle cx="12" cy="18" r="2" />
    <path d="M8 6h8" />
    <path d="M7.3 7.7l5.4 9.6" />
    <path d="M16.7 7.7l-5.4 9.6" />
  </svg>
)

function shortenAddress(value: string, head = 6, tail = 6) {
  if (value.length <= head + tail + 3) return value
  return `${value.slice(0, head)}...${value.slice(-tail)}`
}

function GraiFieldLabel({ children, icon }: { children: string; icon?: ReactNode }) {
  return (
    <span className="grai-field-label grai-field-label--with-icon">
      {icon && <span className="grai-field-label-icon">{icon}</span>}
      {children}
    </span>
  )
}

const INFO_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
)

function GraiManageCardTitle({
  id,
  title,
  info,
  icon,
}: {
  id: string
  title: string
  info: string
  icon?: ReactNode
}) {
  return (
    <div className="grai-manage-card-title-row">
      <h2 id={id} className="grai-manage-card-title">
        {icon && <span className="grai-manage-card-title-icon">{icon}</span>}
        {title}
      </h2>
      <span className="grai-manage-info-wrap">
        <button
          type="button"
          className="grai-manage-info-btn"
          aria-label={`About ${title}`}
          aria-describedby={`${id}-info`}
        >
          {INFO_ICON}
        </button>
        <span id={`${id}-info`} role="tooltip" className="grai-manage-info-tooltip">
          {info}
        </span>
      </span>
    </div>
  )
}

type GraiManageAssetFieldProps = {
  assets: GraiAsset[]
  selectedAsset: GraiAsset | undefined
  isLoading: boolean
  error: string | null
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
  onSelect: (mint: string) => void
  solscanTokenUrl: (mint: string) => string
  listId: string
}

function GraiManageAssetField({
  assets,
  selectedAsset,
  isLoading,
  error,
  menuOpen,
  onMenuOpenChange,
  onSelect,
  solscanTokenUrl,
  listId,
}: GraiManageAssetFieldProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [addressCopied, setAddressCopied] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        onMenuOpenChange(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [menuOpen, onMenuOpenChange])

  const copyMintAddress = async () => {
    if (!selectedAsset?.mint) return
    try {
      await navigator.clipboard.writeText(selectedAsset.mint)
      setAddressCopied(true)
      window.setTimeout(() => setAddressCopied(false), 1500)
    } catch {
      // ignore clipboard errors
    }
  }

  return (
    <div className="grai-mint-asset-field">
      <div className="grai-mint-asset-dropdown" ref={dropdownRef}>
        <div className={`grai-mint-asset-trigger ${menuOpen ? 'is-open' : ''}`}>
          <div className="grai-mint-asset-value grai-mint-asset-value--combined">
            <div className={`grai-mint-asset-label-row ${selectedAsset?.mint ? 'has-mint-address' : ''}`}>
              <span className="grai-mint-asset-label-text">
                <span className="grai-field-label grai-field-label--with-icon">
                  <span className="grai-field-label-icon">{ASSET_FIELD_ICON}</span>
                  Asset
                </span>
                {selectedAsset?.mint && (
                  <span className="grai-mint-asset-address-actions">
                    <span className="grai-mint-asset-short-address-wrap">
                      <span className="grai-mint-asset-full-address">{selectedAsset.mint}</span>
                      <button
                        type="button"
                        className={`grai-mint-asset-short-address ${addressCopied ? 'is-copied' : ''}`}
                        onClick={() => {
                          void copyMintAddress()
                        }}
                        title={addressCopied ? 'Copied to clipboard' : 'Copy mint address'}
                        aria-label={`Copy ${selectedAsset.symbol} mint address`}
                      >
                        {addressCopied ? 'Copied!' : shortenAddress(selectedAsset.mint)}
                      </button>
                    </span>
                    <a
                      href={solscanTokenUrl(selectedAsset.mint)}
                      target="_blank"
                      rel="noreferrer"
                      className="grai-mint-asset-trigger-solscan"
                      aria-label={`View ${selectedAsset.symbol} on Solscan`}
                      title={`View ${selectedAsset.symbol} on Solscan`}
                    >
                      {MINT_ASSET_SOLSCAN_ICON}
                    </a>
                  </span>
                )}
              </span>
            </div>
            <div className="grai-mint-asset-value-main">
              <button
                type="button"
                className="grai-mint-asset-value-select"
                onClick={() => onMenuOpenChange(!menuOpen)}
                aria-haspopup="listbox"
                aria-expanded={menuOpen}
                aria-controls={listId}
                aria-label="Select asset"
                disabled={isLoading || assets.length === 0}
              >
                {selectedAsset && (
                  <span className="grai-mint-asset-item-icon" aria-hidden="true">
                    <img
                      src={selectedAsset.icon.src}
                      alt={selectedAsset.icon.alt}
                      width={16}
                      height={16}
                      loading="lazy"
                      decoding="async"
                    />
                  </span>
                )}
                <span className="grai-mint-asset-symbol">
                  {isLoading ? 'Loading…' : selectedAsset?.symbol ?? (error ? 'Unavailable' : '—')}
                </span>
              </button>
              <button
                type="button"
                className="grai-mint-asset-caret-btn"
                onClick={() => onMenuOpenChange(!menuOpen)}
                aria-label="Open asset list"
                disabled={isLoading || assets.length === 0}
              >
                <span className="grai-mint-asset-caret" aria-hidden="true">
                  ▾
                </span>
              </button>
            </div>
          </div>
        </div>
        {menuOpen && assets.length > 0 && (
          <div className="grai-mint-asset-list" id={listId} role="listbox" aria-label="Asset list">
            {assets.map((asset) => (
              <div
                key={asset.mint}
                role="option"
                aria-selected={selectedAsset?.mint === asset.mint}
                className={`grai-mint-asset-item ${selectedAsset?.mint === asset.mint ? 'active' : ''}`}
                onClick={() => {
                  onSelect(asset.mint)
                  onMenuOpenChange(false)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(asset.mint)
                    onMenuOpenChange(false)
                  }
                }}
                tabIndex={0}
              >
                <span className="grai-mint-asset-item-icon" aria-hidden="true">
                  <img
                    src={asset.icon.src}
                    alt={asset.icon.alt}
                    width={16}
                    height={16}
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <span className="grai-mint-asset-item-symbol">{asset.symbol}</span>
                <a
                  href={solscanTokenUrl(asset.mint)}
                  target="_blank"
                  rel="noreferrer"
                  className="grai-mint-asset-item-solscan"
                  aria-label={`View ${asset.symbol} on Solscan`}
                  title={`View ${asset.symbol} on Solscan`}
                  onClick={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  {MINT_ASSET_SOLSCAN_ICON}
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
      {error && <p className="grai-registry-hint is-error">{error}</p>}
    </div>
  )
}

type GraiManageInputFieldProps = {
  id: string
  label?: string
  labelIcon?: ReactNode
  value: string
  onChange: (value: string) => void
  placeholder?: string
  inputMode?: 'text' | 'decimal'
  suffix?: string
  maxAmount?: string
  labelPosition?: 'above' | 'below'
}

function GraiManageInputField({
  id,
  label,
  labelIcon,
  value,
  onChange,
  placeholder = '0',
  inputMode = 'text',
  suffix,
  maxAmount,
  labelPosition = 'below',
}: GraiManageInputFieldProps) {
  const hasSuffix = Boolean(suffix)
  const hasMax = maxAmount !== undefined
  const labelNode = label ? (
    <div className={`grai-mint-amount-header${labelPosition === 'above' ? ' is-above' : ''}`}>
      <GraiFieldLabel icon={labelIcon}>{label}</GraiFieldLabel>
    </div>
  ) : null

  return (
    <div className="grai-mint-amount-field">
      {labelPosition === 'above' && labelNode}
      <div className={`grai-input-with-suffix${hasSuffix || hasMax ? ' has-max' : ''}`}>
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          className="grai-input"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        {suffix && <span className="grai-input-suffix">{suffix}</span>}
        {hasMax && (
          <button
            type="button"
            className="grai-input-max-btn"
            onClick={() => {
              if (maxAmount) onChange(maxAmount)
            }}
            disabled={!maxAmount}
          >
            MAX
          </button>
        )}
      </div>
      {labelPosition === 'below' && labelNode}
    </div>
  )
}

function GraiManagePage() {
  const { connection, solana, solscanTokenUrl, solscanTxUrl, solscanAccountUrl, isConfigured } =
    useGraiDeployment()
  const { assets, isLoading: assetsLoading, error: assetsError } = useGraiAssets()
  const { vaultBalances, isLoading: vaultBalancesLoading, error: vaultBalancesError, refresh: refreshVaultBalances } =
    useGraiVaultBalances()
  const solanaWallet = useSolanaWallet()

  const [selectedAssetMint, setSelectedAssetMint] = useState('')
  const [allocateAssetMenuOpen, setAllocateAssetMenuOpen] = useState(false)
  const [distributeAssetMenuOpen, setDistributeAssetMenuOpen] = useState(false)
  const [custodyWallet, setCustodyWallet] = useState('')
  const [allocateAmount, setAllocateAmount] = useState('')
  const [distributeAmount, setDistributeAmount] = useState('')
  const [assetDecimals, setAssetDecimals] = useState(9)
  const [protocolAuthority, setProtocolAuthority] = useState<string | null>(null)
  const [protocolAuthorityError, setProtocolAuthorityError] = useState<string | null>(null)
  const [protocolAuthorityCopied, setProtocolAuthorityCopied] = useState(false)

  const copyProtocolAuthority = useCallback(async () => {
    if (!protocolAuthority) return
    try {
      await navigator.clipboard.writeText(protocolAuthority)
      setProtocolAuthorityCopied(true)
      window.setTimeout(() => setProtocolAuthorityCopied(false), 1500)
    } catch {
      // ignore clipboard errors
    }
  }, [protocolAuthority])

  const {
    allocate,
    reset: resetAllocate,
    status: allocateStatus,
    error: allocateError,
    lastSignature: allocateSignature,
    isAllocating,
  } = useGraiAllocate()

  const {
    distribute,
    reset: resetDistribute,
    status: distributeStatus,
    error: distributeError,
    lastSignature: distributeSignature,
    isDistributing,
  } = useGraiDistribute()

  const selectedAsset = assets.find((asset) => asset.mint === selectedAssetMint) ?? assets[0]

  const allocateMaxAmount = useMemo(() => {
    if (!selectedAsset?.mint) return ''
    const vault = vaultBalances[selectedAsset.mint]
    if (!vault || vault.juniorRaw <= 0n) return ''
    return formatTokenBalance(vault.juniorRaw, vault.decimals)
  }, [selectedAsset?.mint, vaultBalances])

  const juniorVaultRows = useMemo(
    () =>
      assets.map((asset) => {
        const vault = vaultBalances[asset.mint]
        return {
          asset,
          idle: vault ? formatVaultBalanceDisplay(vault.juniorRaw, vault.decimals) : '—',
          allocated: vault ? formatVaultBalanceDisplay(vault.allocatedRaw, vault.decimals) : '—',
          juniorUsdRaw: vault?.juniorUsdRaw ?? 0n,
        }
      }),
    [assets, vaultBalances],
  )

  const totalJuniorNavLabel = useMemo(() => {
    if (vaultBalancesLoading || assetsLoading) return '…'
    const totalJuniorUsdRaw = juniorVaultRows.reduce((sum, row) => sum + row.juniorUsdRaw, 0n)
    if (totalJuniorUsdRaw <= 0n) return '—'
    return `$${formatVaultBalanceDisplay(totalJuniorUsdRaw, USD_SCALE, 2)}`
  }, [assetsLoading, juniorVaultRows, vaultBalancesLoading])

  useEffect(() => {
    if (!selectedAssetMint && assets.length > 0) {
      setSelectedAssetMint(assets[0]!.mint)
    }
  }, [assets, selectedAssetMint])

  useEffect(() => {
    if (!connection || !selectedAsset?.mint) {
      setAssetDecimals(9)
      return
    }

    let cancelled = false
    void fetchMintDecimals(connection, new PublicKey(selectedAsset.mint))
      .then((decimals) => {
        if (!cancelled) setAssetDecimals(decimals)
      })
      .catch(() => {
        if (!cancelled) setAssetDecimals(9)
      })

    return () => {
      cancelled = true
    }
  }, [connection, selectedAsset?.mint])

  useEffect(() => {
    if (!connection || !solana) {
      setProtocolAuthority(null)
      return
    }

    let cancelled = false
    void fetchGraiStateFixedFields(connection, solana)
      .then((fields) => {
        if (!cancelled) {
          setProtocolAuthority(fields.authority.toBase58())
          setProtocolAuthorityError(null)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setProtocolAuthority(null)
          setProtocolAuthorityError(
            error instanceof Error ? error.message : 'Failed to load protocol authority',
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [connection, solana])

  const connectedWallet = solanaWallet.publicKey?.toBase58() ?? null
  const {
    error: custodyBalancesError,
    refresh: refreshCustodyBalances,
  } = useCustodyWalletBalances(custodyWallet, connectedWallet)

  const {
    rows: grinderCustodyRows,
    isLoading: grinderCustodyLoading,
    error: grinderCustodyError,
    refresh: refreshGrinderCustodyBalances,
  } = useGrindersCustodyBalances(KNOWN_GRINDERS)

  const custodyAssetRows = useMemo(
    () =>
      grinderCustodyRows.flatMap((grinder) => {
        if (assets.length === 0) {
          return [
            {
              key: grinder.id,
              grinder,
              asset: null as GraiAsset | null,
              balance: '—',
              yield: '—',
            },
          ]
        }

        return assets.map((asset) => {
          const entry = grinder.balances[asset.mint]
          return {
            key: `${grinder.id}-${asset.mint}`,
            grinder,
            asset,
            balance: entry
              ? formatVaultBalanceDisplay(entry.balanceRaw, entry.decimals)
              : '—',
            yield: entry ? formatVaultBalanceDisplay(entry.yieldRaw, entry.decimals) : '—',
          }
        })
      }),
    [assets, grinderCustodyRows],
  )

  const authorityMatches =
    protocolAuthority && connectedWallet ? protocolAuthority === connectedWallet : false

  const handleAssetSelect = (mint: string) => {
    setSelectedAssetMint(mint)
    resetAllocate()
    resetDistribute()
  }

  const handleAllocate = async () => {
    if (!selectedAsset?.mint) return
    resetAllocate()
    try {
      await allocate({
        assetMint: selectedAsset.mint,
        custodyWallet,
        amountInput: allocateAmount,
      })
      void refreshVaultBalances()
      void refreshCustodyBalances()
      void refreshGrinderCustodyBalances()
    } catch {
      // Error state handled in hook
    }
  }

  const handleDistribute = async () => {
    if (!selectedAsset?.mint) return
    resetDistribute()
    try {
      await distribute({
        assetMint: selectedAsset.mint,
        amountInput: distributeAmount,
      })
      void refreshVaultBalances()
      void refreshCustodyBalances()
      void refreshGrinderCustodyBalances()
    } catch {
      // Error state handled in hook
    }
  }

  const handleGrinderSelect = (wallet: string | null) => {
    if (!wallet) return
    setCustodyWallet(wallet)
    resetAllocate()
  }

  return (
    <div className="grai-manage-page">
      <header className="grai-manage-header">
        <button type="button" className="grai-manage-back" onClick={() => navigateTo('/grai')}>
          <span className="grai-manage-back-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </span>
          <span className="grai-manage-back-text">Back to GRAI</span>
        </button>
      </header>

      {!isConfigured && (
        <p className="grai-manage-feedback is-error">GRAI is not configured for this network.</p>
      )}

      {protocolAuthority && (
        <p className="grai-manage-protocol-info">
          Protocol authority:{' '}
          <a
            href={solscanAccountUrl(protocolAuthority)}
            target="_blank"
            rel="noreferrer"
            className="grai-manage-protocol-link"
            title={protocolAuthority}
          >
            <code
              className={protocolAuthorityCopied ? 'is-copied' : ''}
              role="button"
              tabIndex={0}
              title={protocolAuthorityCopied ? 'Copied to clipboard' : 'Copy address'}
              aria-label={protocolAuthorityCopied ? 'Copied to clipboard' : 'Copy protocol authority address'}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void copyProtocolAuthority()
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  event.stopPropagation()
                  void copyProtocolAuthority()
                }
              }}
            >
              {protocolAuthorityCopied ? 'Copied!' : protocolAuthority}
            </code>
            <span className="grai-manage-protocol-link-icon" aria-hidden="true">
              {MINT_ASSET_SOLSCAN_ICON}
            </span>
          </a>
        </p>
      )}
      {protocolAuthorityError && (
        <p className="grai-manage-feedback is-error">{protocolAuthorityError}</p>
      )}

      <div className="grai-manage-cards">
        <section className="grai-manage-card" aria-labelledby="grai-allocate-title">
          <GraiManageCardTitle
            id="grai-allocate-title"
            title="Allocate"
            icon={ALLOCATED_TABLE_ICON}
            info="Move tokens from the junior vault to a grinder custody wallet. Must be signed by the protocol authority."
          />

          <GraiManageAssetField
            assets={assets}
            selectedAsset={selectedAsset}
            isLoading={assetsLoading}
            error={assetsError}
            menuOpen={allocateAssetMenuOpen}
            onMenuOpenChange={setAllocateAssetMenuOpen}
            onSelect={handleAssetSelect}
            solscanTokenUrl={solscanTokenUrl}
            listId="grai-allocate-asset-list"
          />

          <GraiManageInputField
            id="grai-allocate-amount"
            label="Amount"
            labelIcon={AMOUNT_FIELD_ICON}
            labelPosition="above"
            value={allocateAmount}
            inputMode="decimal"
            suffix={selectedAsset?.symbol ?? '—'}
            maxAmount={allocateMaxAmount}
            onChange={(value) => {
              setAllocateAmount(normalizeDecimalInput(value, assetDecimals))
              resetAllocate()
            }}
          />

          <GraiManageInputField
            id="grai-allocate-custody"
            label="Custody"
            labelIcon={CUSTODY_FIELD_ICON}
            labelPosition="above"
            value={custodyWallet}
            placeholder="Grinder wallet pubkey"
            onChange={(value) => {
              setCustodyWallet(value)
              resetAllocate()
            }}
          />

          <p className="grai-manage-hint">
            Connected wallet:{' '}
            {connectedWallet ? (
              authorityMatches ? (
                <code>{shortenAddress(connectedWallet)}</code>
              ) : (
                <>
                  <code>{shortenAddress(connectedWallet)}</code> — must match protocol authority
                </>
              )
            ) : (
              'not connected'
            )}
          </p>

          {isAllocating ? (
            <p className="grai-manage-feedback is-pending">Confirming transaction…</p>
          ) : allocateError ? (
            <p className="grai-manage-feedback is-error">{allocateError}</p>
          ) : allocateSignature && allocateStatus === 'success' ? (
            <p className="grai-manage-feedback is-success">
              Allocate confirmed:{' '}
              <a href={solscanTxUrl(allocateSignature)} target="_blank" rel="noreferrer">
                {shortenAddress(allocateSignature)}
              </a>
            </p>
          ) : null}

          <button
            type="button"
            className="grai-manage-btn"
            disabled={
              isAllocating ||
              !selectedAsset?.mint ||
              !custodyWallet.trim() ||
              !allocateAmount.trim() ||
              !authorityMatches
            }
            onClick={() => {
              void handleAllocate()
            }}
          >
            Allocate
          </button>
        </section>

        <section className="grai-manage-card" aria-labelledby="grai-distribute-title">
          <GraiManageCardTitle
            id="grai-distribute-title"
            title="Distribute"
            icon={YIELD_AMOUNT_FIELD_ICON}
            info="Send yield from the custody wallet to senior vault and treasury. Must be signed by the custody wallet."
          />

          <GraiManageInputField
            id="grai-distribute-custody"
            label="Custody"
            labelIcon={CUSTODY_FIELD_ICON}
            labelPosition="above"
            value={custodyWallet}
            placeholder="Grinder wallet pubkey"
            onChange={(value) => {
              setCustodyWallet(value)
              resetDistribute()
            }}
          />

          <GraiManageAssetField
            assets={assets}
            selectedAsset={selectedAsset}
            isLoading={assetsLoading}
            error={null}
            menuOpen={distributeAssetMenuOpen}
            onMenuOpenChange={setDistributeAssetMenuOpen}
            onSelect={handleAssetSelect}
            solscanTokenUrl={solscanTokenUrl}
            listId="grai-distribute-asset-list"
          />

          <GraiManageInputField
            id="grai-distribute-amount"
            label="Yield amount"
            labelIcon={YIELD_AMOUNT_FIELD_ICON}
            labelPosition="above"
            value={distributeAmount}
            inputMode="decimal"
            suffix={selectedAsset?.symbol ?? '—'}
            onChange={(value) => {
              setDistributeAmount(normalizeDecimalInput(value, assetDecimals))
              resetDistribute()
            }}
          />

          <p className="grai-manage-hint">
            Connected wallet:{' '}
            {connectedWallet ? (
              custodyWallet.trim() && connectedWallet !== custodyWallet.trim() ? (
                <>
                  <code>{shortenAddress(connectedWallet)}</code> — must match custody wallet
                </>
              ) : (
                <code>{shortenAddress(connectedWallet)}</code>
              )
            ) : (
              'connect the custody wallet'
            )}
          </p>

          {isDistributing ? (
            <p className="grai-manage-feedback is-pending">Confirming transaction…</p>
          ) : distributeError ? (
            <p className="grai-manage-feedback is-error">{distributeError}</p>
          ) : distributeSignature && distributeStatus === 'success' ? (
            <p className="grai-manage-feedback is-success">
              Distribute confirmed:{' '}
              <a href={solscanTxUrl(distributeSignature)} target="_blank" rel="noreferrer">
                {shortenAddress(distributeSignature)}
              </a>
            </p>
          ) : null}

          <button
            type="button"
            className="grai-manage-btn is-distribute"
            disabled={
              isDistributing ||
              !selectedAsset?.mint ||
              !custodyWallet.trim() ||
              !distributeAmount.trim() ||
              !connectedWallet ||
              connectedWallet !== custodyWallet.trim()
            }
            onClick={() => {
              void handleDistribute()
            }}
          >
            Distribute
          </button>
        </section>
      </div>

      <div className="grai-manage-vaults-row">
        <section className="grai-manage-junior-vault" aria-label="Junior vault balances">
          <div className="grai-manage-junior-vault-header">
            <h2 className="grai-manage-junior-vault-title">Junior Vault</h2>
            <span className="grai-manage-junior-vault-nav">
              NAV: <strong>{totalJuniorNavLabel}</strong>
            </span>
          </div>
          <div className="grai-balance-table grai-manage-junior-vault-table" role="table">
            <div className="grai-balance-table-row grai-balance-table-row--head" role="row">
              <div className="grai-balance-table-cell grai-balance-table-cell--head grai-balance-table-cell--asset is-asset" role="columnheader">
                <span className="grai-balance-table-col-icon">{ASSET_FIELD_ICON}</span>
                Asset
              </div>
              <div className="grai-balance-table-cell grai-balance-table-cell--head is-junior" role="columnheader">
                <span className="grai-balance-table-col-icon">{JUNIOR_VAULT_TABLE_ICON}</span>
                Balance
              </div>
              <div className="grai-balance-table-cell grai-balance-table-cell--head is-allocated" role="columnheader">
                <span className="grai-balance-table-col-icon">{ALLOCATED_TABLE_ICON}</span>
                Allocated
              </div>
            </div>
            {assetsLoading || vaultBalancesLoading ? (
              <div className="grai-balance-table-row" role="row">
                <div className="grai-balance-table-cell grai-balance-table-cell--asset grai-asset-cell" role="cell">
                  Loading…
                </div>
                <div className="grai-balance-table-cell grai-balance-table-value" role="cell">—</div>
                <div className="grai-balance-table-cell grai-balance-table-value" role="cell">—</div>
              </div>
            ) : juniorVaultRows.length === 0 ? (
              <div className="grai-balance-table-row" role="row">
                <div className="grai-balance-table-cell grai-balance-table-cell--asset grai-asset-cell" role="cell">
                  No registry assets
                </div>
                <div className="grai-balance-table-cell grai-balance-table-value" role="cell">—</div>
                <div className="grai-balance-table-cell grai-balance-table-value" role="cell">—</div>
              </div>
            ) : (
              juniorVaultRows.map((row) => (
                <div className="grai-balance-table-row" role="row" key={row.asset.mint}>
                  <div className="grai-balance-table-cell grai-balance-table-cell--asset grai-asset-cell" role="cell">
                    <span className="grai-asset-cell-token">
                      <span className="grai-asset-cell-icon" aria-hidden="true">
                        <img src={row.asset.icon.src} alt={row.asset.icon.alt} />
                      </span>
                      {row.asset.symbol}
                    </span>
                  </div>
                  <div className="grai-balance-table-cell grai-balance-table-value" role="cell">
                    {row.idle}
                  </div>
                  <div className="grai-balance-table-cell grai-balance-table-value" role="cell">
                    {row.allocated}
                  </div>
                </div>
              ))
            )}
          </div>
          {vaultBalancesError && (
            <p className="grai-manage-feedback is-error">{vaultBalancesError}</p>
          )}
        </section>

        <section className="grai-manage-custody-vault" aria-label="Custody balances">
          <div className="grai-manage-junior-vault-header">
            <h2 className="grai-manage-junior-vault-title">Custodies</h2>
            <span className="grai-manage-custody-wallet-link">{KNOWN_GRINDERS.length} grinders</span>
          </div>
          <div className="grai-balance-table grai-manage-custody-vault-table" role="table">
            <div className="grai-balance-table-row grai-balance-table-row--head" role="row">
              <div className="grai-balance-table-cell grai-balance-table-cell--head grai-balance-table-cell--asset is-asset" role="columnheader">
                <span className="grai-balance-table-col-icon">{CUSTODY_FIELD_ICON}</span>
                Custody
              </div>
              <div className="grai-balance-table-cell grai-balance-table-cell--head is-asset" role="columnheader">
                <span className="grai-balance-table-col-icon">{ASSET_FIELD_ICON}</span>
                Asset
              </div>
              <div className="grai-balance-table-cell grai-balance-table-cell--head is-junior" role="columnheader">
                <span className="grai-balance-table-col-icon">{JUNIOR_VAULT_TABLE_ICON}</span>
                Balance
              </div>
              <div className="grai-balance-table-cell grai-balance-table-cell--head is-yield" role="columnheader">
                <span className="grai-balance-table-col-icon">{YIELD_AMOUNT_FIELD_ICON}</span>
                Yield
              </div>
            </div>
            {assetsLoading || grinderCustodyLoading ? (
              custodyAssetRows.map((row) => (
                <div className="grai-balance-table-row" role="row" key={row.key}>
                  <div className="grai-balance-table-cell grai-balance-table-cell--asset grai-asset-cell" role="cell">
                    <span className="grai-grinder-name">
                      <span className="grai-grinder-active-dot" aria-hidden="true" />
                      {row.grinder.name}
                    </span>
                  </div>
                  <div className="grai-balance-table-cell grai-balance-table-cell--asset grai-asset-cell" role="cell">
                    {row.asset ? row.asset.symbol : '…'}
                  </div>
                  <div className="grai-balance-table-cell grai-balance-table-value" role="cell">…</div>
                  <div className="grai-balance-table-cell grai-balance-table-value" role="cell">…</div>
                </div>
              ))
            ) : custodyAssetRows.length === 0 ? (
              <div className="grai-balance-table-row" role="row">
                <div className="grai-balance-table-cell grai-balance-table-cell--asset grai-asset-cell" role="cell">
                  No grinders
                </div>
                <div className="grai-balance-table-cell grai-balance-table-cell--asset grai-asset-cell" role="cell">—</div>
                <div className="grai-balance-table-cell grai-balance-table-value" role="cell">—</div>
                <div className="grai-balance-table-cell grai-balance-table-value" role="cell">—</div>
              </div>
            ) : (
              custodyAssetRows.map((row) => {
                const wallet = row.grinder.custodyWallet?.toBase58() ?? null
                const isSelected = wallet !== null && custodyWallet.trim() === wallet

                return (
                  <div
                    className={`grai-balance-table-row grai-manage-custody-grinder-row${isSelected ? ' is-selected' : ''}${wallet ? ' is-clickable' : ''}`}
                    role="row"
                    key={row.key}
                    onClick={wallet ? () => handleGrinderSelect(wallet) : undefined}
                    onKeyDown={
                      wallet
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              handleGrinderSelect(wallet)
                            }
                          }
                        : undefined
                    }
                    tabIndex={wallet ? 0 : undefined}
                    aria-selected={isSelected}
                  >
                    <div className="grai-balance-table-cell grai-balance-table-cell--asset grai-asset-cell" role="cell">
                      <span className="grai-grinder-name">
                        <span className="grai-grinder-active-dot" aria-hidden="true" />
                        {row.grinder.name}
                      </span>
                    </div>
                    <div className="grai-balance-table-cell grai-balance-table-cell--asset grai-asset-cell" role="cell">
                      {row.asset ? (
                        <span className="grai-asset-cell-token">
                          <span className="grai-asset-cell-icon" aria-hidden="true">
                            <img src={row.asset.icon.src} alt={row.asset.icon.alt} />
                          </span>
                          {row.asset.symbol}
                        </span>
                      ) : (
                        '—'
                      )}
                    </div>
                    <div className="grai-balance-table-cell grai-balance-table-value" role="cell">
                      {row.balance}
                    </div>
                    <div className="grai-balance-table-cell grai-balance-table-value" role="cell">
                      {row.yield}
                    </div>
                  </div>
                )
              })
            )}
          </div>
          {(grinderCustodyError || custodyBalancesError) && (
            <p className="grai-manage-feedback is-error">{grinderCustodyError ?? custodyBalancesError}</p>
          )}
        </section>
      </div>
    </div>
  )
}

export default GraiManagePage
