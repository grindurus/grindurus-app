import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { PublicKey } from '@solana/web3.js'
import type { GraiAsset } from '../grai/knownMints'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { fetchGraiStateFixedFields } from '../grai/graiStateCache'
import { decodeSeniorVaultYieldSplit, fetchMintDecimals, formatTokenBalance, normalizeDecimalInput, parseTokenAmount } from '../grai/onchain'
import { formatVaultBalanceDisplay } from '../grai/formatVaultBalance'
import { seniorVaultPda } from '../grai/pdas'
import { KNOWN_GRINDERS, grinderCustodyAddress } from '../grai/grinders'
import type { GrinderCustodyState } from '../hooks/useGrindersCustodyBalances'
import type { CustodyNetwork } from '../grai/custodyHoldings'
import { USD_SCALE, yieldSplit } from '../grai/tokenomics'
import { useGraiAllocate } from '../hooks/useGraiAllocate'
import { useGraiAssets } from '../hooks/useGraiAssets'
import { useGraiDistribute } from '../hooks/useGraiDistribute'
import { useGraiVaultBalances } from '../hooks/useGraiVaultBalances'
import { useCustodyWalletBalances } from '../hooks/useCustodyWalletBalances'
import { useGrindersCustodyBalances } from '../hooks/useGrindersCustodyBalances'
import { useSolanaWallet } from '../hooks/useSolanaWallet'
import { WalletIcon } from '../components/WalletIcon'
import './GraiPage.css'
import './GraiManagePage.css'

const PROTOCOL_AUTHORITY_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)

const TREASURY_WALLET_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 10h18" />
    <path d="M5 10V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4" />
    <path d="M3 10v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8" />
    <path d="M16 14h.01" />
  </svg>
)

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

const SENIOR_VAULT_FIELD_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l7 4v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V7l7-4z" />
  </svg>
)

const DISTRIBUTION_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4v7" />
    <path d="M12 11 5 20" />
    <path d="M12 11 19 20" />
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

type CustodyHeldAssetRow = {
  asset: GraiAsset
  balance: string
  yield: string
  network: CustodyNetwork
}

function grinderHeldAssets(grinder: Pick<GrinderCustodyState, 'holdings'>): CustodyHeldAssetRow[] {
  return grinder.holdings.map((holding) => ({
    asset: holding.asset,
    balance: formatVaultBalanceDisplay(holding.balanceRaw, holding.decimals),
    yield: formatVaultBalanceDisplay(holding.yieldRaw, holding.decimals),
    network: holding.network,
  }))
}

function findSelectedGrinder(
  grinders: GrinderCustodyState[],
  grinderId: string,
  wallet: string,
): GrinderCustodyState | undefined {
  if (grinderId) {
    const match = grinders.find((grinder) => grinder.id === grinderId)
    if (match) return match
  }
  const trimmed = wallet.trim()
  if (!trimmed) return undefined
  return grinders.find(
    (grinder) =>
      grinder.custodyWalletAddress === trimmed || grinder.custodyWallet?.toBase58() === trimmed,
  )
}

function GraiGrinderName({
  grinder,
  copied,
  onCopy,
}: {
  grinder: Pick<GrinderCustodyState, 'id' | 'name' | 'custodyWalletAddress'>
  copied: boolean
  onCopy: (wallet: string, grinderId: string) => void
}) {
  const wallet = grinder.custodyWalletAddress || null

  return (
    <span className="grai-grinder-name">
      <span className="grai-grinder-active-dot" aria-hidden="true" />
      {wallet ? (
        <span className="grai-mint-asset-short-address-wrap">
          <span className="grai-mint-asset-full-address">{wallet}</span>
          <button
            type="button"
            className={`grai-grinder-name-copy${copied ? ' is-copied' : ''}`}
            onClick={(event) => {
              event.stopPropagation()
              onCopy(wallet, grinder.id)
            }}
            title={copied ? 'Copied to clipboard' : `Copy ${grinder.name} address`}
            aria-label={copied ? 'Copied to clipboard' : `Copy ${grinder.name} address`}
          >
            {copied ? 'Copied!' : grinder.name}
          </button>
        </span>
      ) : (
        grinder.name
      )}
    </span>
  )
}

function GraiFieldLabel({ children, icon }: { children: string; icon?: ReactNode }) {
  return (
    <span className="grai-field-label grai-field-label--with-icon">
      {icon && <span className="grai-field-label-icon">{icon}</span>}
      {children}
    </span>
  )
}

type GraiManageAssetSelectorProps = {
  assets: GraiAsset[]
  selectedAsset: GraiAsset | undefined
  isLoading: boolean
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
  onSelect: (mint: string) => void
  solscanTokenUrl: (mint: string) => string
  listId: string
  listEmptyMessage?: string
  emptyTriggerLabel?: string
}

function GraiManageAssetSelector({
  assets,
  selectedAsset,
  isLoading,
  menuOpen,
  onMenuOpenChange,
  onSelect,
  solscanTokenUrl,
  listId,
  listEmptyMessage,
  emptyTriggerLabel,
}: GraiManageAssetSelectorProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  return (
    <div className="grai-mint-asset-dropdown" ref={dropdownRef}>
      <div className="grai-mint-asset-value">
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
            {isLoading
              ? 'Loading…'
              : selectedAsset?.symbol ??
                (assets.length === 0 ? (emptyTriggerLabel ?? listEmptyMessage ?? '—') : '—')}
          </span>
          {selectedAsset?.mint && (
            <a
              href={solscanTokenUrl(selectedAsset.mint)}
              target="_blank"
              rel="noreferrer"
              className="grai-mint-asset-value-solscan"
              aria-label={`View ${selectedAsset.symbol} on Solscan`}
              title={`View ${selectedAsset.symbol} on Solscan`}
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
            >
              {MINT_ASSET_SOLSCAN_ICON}
            </a>
          )}
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
      {menuOpen && (
        <div className="grai-mint-asset-list" id={listId} role="listbox" aria-label="Asset list">
          {assets.length === 0 ? (
            <div className="grai-manage-custody-empty" role="presentation">
              {listEmptyMessage ?? 'No assets available'}
            </div>
          ) : (
            assets.map((asset) => (
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
            ))
          )}
        </div>
      )}
    </div>
  )
}

type GraiManageCustodyFieldProps = {
  id: string
  grinders: GrinderCustodyState[]
  selectedWallet: string
  selectedGrinderId: string
  onChange: (wallet: string) => void
  onSelectGrinder: (grinder: GrinderCustodyState) => void
  onFocus?: () => void
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
  solscanAccountUrl: (address: string) => string
  listId: string
}

function GraiManageCustodyField({
  id,
  grinders,
  selectedWallet,
  selectedGrinderId,
  onChange,
  onSelectGrinder,
  onFocus,
  menuOpen,
  onMenuOpenChange,
  solscanAccountUrl,
  listId,
}: GraiManageCustodyFieldProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const trimmedWallet = selectedWallet.trim()

  const selectedGrinder = useMemo(() => {
    if (selectedGrinderId) {
      const match = grinders.find((grinder) => grinder.id === selectedGrinderId)
      if (match) return match
    }
    if (!trimmedWallet) return undefined
    return grinders.find(
      (grinder) =>
        grinder.custodyWalletAddress === trimmedWallet ||
        grinder.custodyWallet?.toBase58() === trimmedWallet,
    )
  }, [grinders, selectedGrinderId, trimmedWallet])

  const selectGrinder = useCallback(
    (grinder: GrinderCustodyState) => {
      onSelectGrinder(grinder)
      onMenuOpenChange(false)
      window.requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    },
    [onMenuOpenChange, onSelectGrinder],
  )

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

  return (
    <div className="grai-mint-asset-field grai-manage-custody-field" id={id}>
      <div className="grai-mint-asset-dropdown" ref={dropdownRef}>
        <div className={`grai-mint-asset-trigger ${menuOpen ? 'is-open' : ''}`}>
          <div className="grai-mint-amount-field">
            <div className={`grai-mint-amount-header${selectedGrinder ? ' has-custody-selection' : ''}`}>
              <GraiFieldLabel icon={CUSTODY_FIELD_ICON}>Custody</GraiFieldLabel>
              {selectedGrinder && (
                <span className="grai-grinder-name grai-manage-custody-selected-name">
                  <span className="grai-grinder-active-dot" aria-hidden="true" />
                  {selectedGrinder.name}
                </span>
              )}
            </div>
            <div className="grai-mint-amount-row">
              <input
                ref={inputRef}
                id={`${id}-input`}
                type="text"
                className="grai-input grai-manage-custody-input"
                placeholder="Grinder wallet pubkey"
                value={selectedWallet}
                onChange={(event) => onChange(event.target.value)}
                onFocus={() => onFocus?.()}
                spellCheck={false}
                autoComplete="off"
                aria-controls={listId}
                aria-expanded={menuOpen}
                aria-haspopup="listbox"
              />
              <button
                type="button"
                className="grai-mint-asset-caret-btn"
                onClick={() => {
                  onFocus?.()
                  onMenuOpenChange(!menuOpen)
                }}
                aria-label="Open custody list"
              >
                <span className="grai-mint-asset-caret" aria-hidden="true">
                  ▾
                </span>
              </button>
            </div>
          </div>
        </div>
        {menuOpen && (
          <div className="grai-mint-asset-list" id={listId} role="listbox" aria-label="Custody list">
            {grinders.length === 0 ? (
              <div className="grai-manage-custody-empty" role="presentation">
                No grinders in custody list
              </div>
            ) : (
              grinders.map((grinder) => {
                const address = grinder.custodyWalletAddress
                const isSelected =
                  grinder.id === selectedGrinderId ||
                  (address !== '' && trimmedWallet === address)

                return (
                  <div
                    key={grinder.id}
                    role="option"
                    aria-selected={isSelected}
                    className={`grai-mint-asset-item${isSelected ? ' active' : ''}`}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      selectGrinder(grinder)
                    }}
                    onClick={() => {
                      selectGrinder(grinder)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        selectGrinder(grinder)
                      }
                    }}
                    tabIndex={0}
                  >
                    <span className="grai-grinder-name">
                      <span className="grai-grinder-active-dot" aria-hidden="true" />
                      {grinder.name}
                    </span>
                    <span className="grai-manage-custody-item-address">
                      {address ? shortenAddress(address) : 'Not configured'}
                    </span>
                    {address && (
                      <a
                        href={solscanAccountUrl(address)}
                        target="_blank"
                        rel="noreferrer"
                        className="grai-mint-asset-item-solscan"
                        aria-label={`View ${grinder.name} on Solscan`}
                        title={`View ${grinder.name} on Solscan`}
                        onClick={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                      >
                        {MINT_ASSET_SOLSCAN_ICON}
                      </a>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function GraiVaultBalanceSlot({ amount, symbol }: { amount: string; symbol?: string }) {
  return (
    <span className="grai-wallet-action-slot">
      <span className="grai-wallet-balance">
        {amount ? (
          <>
            <span className="grai-wallet-balance-amount">{amount}</span>
            {symbol ? <span className="grai-wallet-balance-symbol"> {symbol}</span> : null}
          </>
        ) : (
          '—'
        )}
      </span>
    </span>
  )
}

type GraiManageInputFieldProps = {
  id: string
  label?: string
  labelIcon?: ReactNode
  header?: ReactNode
  value: string
  onChange: (value: string) => void
  placeholder?: string
  inputMode?: 'text' | 'decimal'
  suffix?: string
  allAmount?: string
  maxLabel?: string
  labelPosition?: 'above' | 'below'
  trailing?: ReactNode
  footer?: ReactNode
}

function GraiManageInputField({
  id,
  label,
  labelIcon,
  header,
  value,
  onChange,
  placeholder = '0',
  inputMode = 'text',
  suffix,
  allAmount,
  maxLabel = 'MAX',
  labelPosition = 'below',
  trailing,
  footer,
}: GraiManageInputFieldProps) {
  const hasSuffix = Boolean(suffix)
  const hasAll = allAmount !== undefined
  const labelNode = label ? (
    <div className={`grai-mint-amount-header${labelPosition === 'above' ? ' is-above' : ''}`}>
      <GraiFieldLabel icon={labelIcon}>{label}</GraiFieldLabel>
    </div>
  ) : null

  const inputBlock = (
    <div className={`grai-input-with-suffix${hasSuffix || hasAll ? ' has-max' : ''}`}>
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
      {hasAll && (
        <button
          type="button"
          className="grai-input-max-btn"
          onClick={() => {
            if (allAmount) onChange(allAmount)
          }}
          disabled={!allAmount}
        >
          {maxLabel}
        </button>
      )}
    </div>
  )

  const amountField = (
    <div className="grai-mint-amount-field">
      {header}
      {labelPosition === 'above' && labelNode}
      {trailing ? (
        <div className="grai-mint-amount-row">
          {inputBlock}
          {trailing}
        </div>
      ) : (
        inputBlock
      )}
      {labelPosition === 'below' && labelNode}
    </div>
  )

  if (header) {
    return (
      <div className="grai-mint-amount-block">
        {amountField}
        {footer}
      </div>
    )
  }

  if (footer) {
    return (
      <>
        {amountField}
        {footer}
      </>
    )
  }

  return amountField
}

export function GraiManageSection() {
  const { connection, solana, solscanTokenUrl, solscanTxUrl, solscanAccountUrl, isConfigured } =
    useGraiDeployment()
  const { assets, isLoading: assetsLoading, error: assetsError } = useGraiAssets()
  const { vaultBalances, isLoading: vaultBalancesLoading, error: vaultBalancesError, refresh: refreshVaultBalances } =
    useGraiVaultBalances()
  const solanaWallet = useSolanaWallet()

  const [allocateAssetMint, setAllocateAssetMint] = useState('')
  const [distributeAssetMint, setDistributeAssetMint] = useState('')
  const [allocateAssetMenuOpen, setAllocateAssetMenuOpen] = useState(false)
  const [distributeAssetMenuOpen, setDistributeAssetMenuOpen] = useState(false)
  const [allocateCustodyMenuOpen, setAllocateCustodyMenuOpen] = useState(false)
  const [distributeCustodyMenuOpen, setDistributeCustodyMenuOpen] = useState(false)
  const [allocateCustodyWallet, setAllocateCustodyWallet] = useState('')
  const [distributeCustodyWallet, setDistributeCustodyWallet] = useState('')
  const [selectedAllocateCustodyGrinderId, setSelectedAllocateCustodyGrinderId] = useState('')
  const [selectedDistributeCustodyGrinderId, setSelectedDistributeCustodyGrinderId] = useState('')
  const [activeCustodyTarget, setActiveCustodyTarget] = useState<'allocate' | 'distribute'>('allocate')
  const [allocateAmount, setAllocateAmount] = useState('')
  const [distributeAmount, setDistributeAmount] = useState('')
  const [allocateAssetDecimals, setAllocateAssetDecimals] = useState(9)
  const [distributeAssetDecimals, setDistributeAssetDecimals] = useState(9)
  const [protocolAuthority, setProtocolAuthority] = useState<string | null>(null)
  const [treasuryWallet, setTreasuryWallet] = useState<string | null>(null)
  const [protocolAuthorityError, setProtocolAuthorityError] = useState<string | null>(null)
  const [protocolAuthorityCopied, setProtocolAuthorityCopied] = useState(false)
  const [treasuryWalletCopied, setTreasuryWalletCopied] = useState(false)
  const [copiedGrinderId, setCopiedGrinderId] = useState<string | null>(null)
  const [isCustodyTableHidden, setIsCustodyTableHidden] = useState(false)
  const [isJuniorVaultTableHidden, setIsJuniorVaultTableHidden] = useState(false)
  const [isDistributeDistributionHidden, setIsDistributeDistributionHidden] = useState(true)
  const [isAllocateAllocationHidden, setIsAllocateAllocationHidden] = useState(true)
  const [distributeYieldSplitBps, setDistributeYieldSplitBps] = useState<number | null>(null)
  const [manageActionView, setManageActionView] = useState<'allocate' | 'distribute'>('allocate')
  const [walletWarningDismissed, setWalletWarningDismissed] = useState(false)

  const handleManageActionViewChange = useCallback((view: 'allocate' | 'distribute') => {
    setManageActionView(view)
    setActiveCustodyTarget(view)
    setAllocateCustodyMenuOpen(false)
    setDistributeCustodyMenuOpen(false)
    setAllocateAssetMenuOpen(false)
    setDistributeAssetMenuOpen(false)
  }, [])

  const copyGrinderAddress = useCallback(async (wallet: string, grinderId: string) => {
    try {
      await navigator.clipboard.writeText(wallet)
      setCopiedGrinderId(grinderId)
      window.setTimeout(() => setCopiedGrinderId(null), 1500)
    } catch {
      // ignore clipboard errors
    }
  }, [])

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

  const copyTreasuryWallet = useCallback(async () => {
    if (!treasuryWallet) return
    try {
      await navigator.clipboard.writeText(treasuryWallet)
      setTreasuryWalletCopied(true)
      window.setTimeout(() => setTreasuryWalletCopied(false), 1500)
    } catch {
      // ignore clipboard errors
    }
  }, [treasuryWallet])

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

  const allocateAsset = assets.find((asset) => asset.mint === allocateAssetMint) ?? assets[0]

  const allocateMaxAmount = useMemo(() => {
    if (!allocateAsset?.mint) return ''
    const vault = vaultBalances[allocateAsset.mint]
    if (!vault || vault.juniorRaw <= 0n) return ''
    return formatTokenBalance(vault.juniorRaw, vault.decimals)
  }, [allocateAsset?.mint, vaultBalances])

  const allocateCustodyReceiveAmount = useMemo(() => {
    const trimmed = allocateAmount.trim()
    return trimmed || '—'
  }, [allocateAmount])

  const allocateCustodyReceiveSymbol = allocateAsset?.symbol?.trim() || '—'

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
    if (assets.length === 0) return
    if (!allocateAssetMint) setAllocateAssetMint(assets[0]!.mint)
  }, [assets, allocateAssetMint])

  useEffect(() => {
    if (!connection) {
      setAllocateAssetDecimals(9)
      setDistributeAssetDecimals(9)
      return
    }

    let cancelled = false

    const loadDecimals = async (mint: string | undefined, setDecimals: (value: number) => void) => {
      if (!mint) {
        setDecimals(9)
        return
      }

      try {
        const decimals = await fetchMintDecimals(connection, new PublicKey(mint))
        if (!cancelled) setDecimals(decimals)
      } catch {
        if (!cancelled) setDecimals(9)
      }
    }

    void loadDecimals(allocateAsset?.mint, setAllocateAssetDecimals)
    void loadDecimals(distributeAssetMint || undefined, setDistributeAssetDecimals)

    return () => {
      cancelled = true
    }
  }, [allocateAsset?.mint, connection, distributeAssetMint])

  useEffect(() => {
    if (!connection || !solana) {
      setProtocolAuthority(null)
      setTreasuryWallet(null)
      return
    }

    let cancelled = false
    void fetchGraiStateFixedFields(connection, solana)
      .then((fields) => {
        if (!cancelled) {
          setProtocolAuthority(fields.authority.toBase58())
          setTreasuryWallet(fields.treasuryWallet.toBase58())
          setProtocolAuthorityError(null)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setProtocolAuthority(null)
          setTreasuryWallet(null)
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
    balances: custodyBalances,
    error: custodyBalancesError,
    refresh: refreshCustodyBalances,
  } = useCustodyWalletBalances(distributeCustodyWallet, connectedWallet)

  const {
    rows: grinderCustodyRows,
    isLoading: grinderCustodyLoading,
    error: grinderCustodyError,
    refresh: refreshGrinderCustodyBalances,
  } = useGrindersCustodyBalances(KNOWN_GRINDERS)

  const selectedDistributeGrinder = useMemo(
    () =>
      findSelectedGrinder(
        grinderCustodyRows,
        selectedDistributeCustodyGrinderId,
        distributeCustodyWallet,
      ),
    [distributeCustodyWallet, grinderCustodyRows, selectedDistributeCustodyGrinderId],
  )

  const distributeGrinderAssets = useMemo(() => {
    if (!selectedDistributeGrinder) return []
    const graiAssetMints = new Set(assets.map((asset) => asset.mint))
    return grinderHeldAssets(selectedDistributeGrinder)
      .filter((row) => graiAssetMints.has(row.asset.mint))
      .map((row) => row.asset)
  }, [assets, selectedDistributeGrinder])

  const distributeAsset =
    distributeGrinderAssets.find((asset) => asset.mint === distributeAssetMint) ?? distributeGrinderAssets[0]

  const distributeAllAmount = useMemo(() => {
    if (!distributeAsset?.mint || !distributeCustodyWallet.trim()) return ''
    const entry = custodyBalances[distributeAsset.mint]
    if (!entry || entry.yieldRaw <= 0n) return ''
    return formatTokenBalance(entry.yieldRaw, entry.decimals)
  }, [distributeAsset?.mint, distributeCustodyWallet, custodyBalances])

  useEffect(() => {
    if (!distributeAsset?.mint || !connection || !solana || !isConfigured) {
      setDistributeYieldSplitBps(null)
      return
    }

    let cancelled = false
    const seniorVault = seniorVaultPda(new PublicKey(distributeAsset.mint), solana.programId)

    void connection.getAccountInfo(seniorVault).then((account) => {
      if (cancelled) return
      if (!account?.data) {
        setDistributeYieldSplitBps(null)
        return
      }
      setDistributeYieldSplitBps(decodeSeniorVaultYieldSplit(Buffer.from(account.data)))
    })

    return () => {
      cancelled = true
    }
  }, [connection, distributeAsset?.mint, isConfigured, solana])

  const distributeSeniorLabel = useMemo(() => {
    if (!distributeAmount.trim() || distributeYieldSplitBps === null) return null
    try {
      const amount = parseTokenAmount(distributeAmount, distributeAssetDecimals)
      const [senior] = yieldSplit(amount, distributeYieldSplitBps)
      return formatTokenBalance(senior, distributeAssetDecimals)
    } catch {
      return null
    }
  }, [distributeAmount, distributeAssetDecimals, distributeYieldSplitBps])

  const distributeTreasuryLabel = useMemo(() => {
    if (!distributeAmount.trim() || distributeYieldSplitBps === null) return null
    try {
      const amount = parseTokenAmount(distributeAmount, distributeAssetDecimals)
      const [, treasury] = yieldSplit(amount, distributeYieldSplitBps)
      return formatTokenBalance(treasury, distributeAssetDecimals)
    } catch {
      return null
    }
  }, [distributeAmount, distributeAssetDecimals, distributeYieldSplitBps])

  useEffect(() => {
    if (distributeGrinderAssets.length === 0) {
      if (distributeAssetMint) {
        setDistributeAssetMint('')
        resetDistribute()
      }
      return
    }

    if (!distributeAssetMint || !distributeGrinderAssets.some((asset) => asset.mint === distributeAssetMint)) {
      setDistributeAssetMint(distributeGrinderAssets[0]!.mint)
      resetDistribute()
    }
  }, [distributeAssetMint, distributeGrinderAssets, resetDistribute])

  const custodyPickerGrinders = useMemo(
    () =>
      KNOWN_GRINDERS.map((config) => {
        const row = grinderCustodyRows.find((entry) => entry.id === config.id)
        const custodyWallet = row?.custodyWallet ?? null
        return {
          id: config.id,
          name: config.name,
          custodyWallet,
          custodyWalletAddress: grinderCustodyAddress(config, custodyWallet),
          balances: row?.balances ?? {},
          holdings: row?.holdings ?? [],
        }
      }),
    [grinderCustodyRows],
  )

  const custodyGrinderRows = useMemo(
    () =>
      grinderCustodyRows.map((grinder) => ({
        key: grinder.id,
        grinder,
        held: grinderHeldAssets(grinder),
      })),
    [grinderCustodyRows],
  )

  const authorityMatches =
    protocolAuthority && connectedWallet ? protocolAuthority === connectedWallet : false

  const distributeConnectedWalletLabel = useMemo(() => {
    if (!connectedWallet) return 'not connected'
    if (distributeCustodyWallet.trim() && connectedWallet === distributeCustodyWallet.trim()) {
      return 'custody wallet'
    }
    if (protocolAuthority && connectedWallet === protocolAuthority) {
      return 'custody manager'
    }
    return 'not custody wallet or manager'
  }, [connectedWallet, distributeCustodyWallet, protocolAuthority])

  const allocateWalletWarning = Boolean(connectedWallet && !authorityMatches)
  const distributeWalletWarning = Boolean(
    connectedWallet &&
      distributeConnectedWalletLabel !== 'custody wallet' &&
      distributeConnectedWalletLabel !== 'custody manager',
  )

  useEffect(() => {
    setWalletWarningDismissed(false)
  }, [connectedWallet, authorityMatches, distributeConnectedWalletLabel])

  const handleAllocateAssetSelect = (mint: string) => {
    setAllocateAssetMint(mint)
    resetAllocate()
  }

  const handleDistributeAssetSelect = (mint: string) => {
    setDistributeAssetMint(mint)
    resetDistribute()
  }

  const handleAllocate = async () => {
    if (!allocateAsset?.mint) return
    resetAllocate()
    try {
      await allocate({
        assetMint: allocateAsset.mint,
        custodyWallet: allocateCustodyWallet,
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
    if (!distributeAsset?.mint) return
    resetDistribute()
    try {
      await distribute({
        assetMint: distributeAsset.mint,
        amountInput: distributeAmount,
      })
      void refreshVaultBalances()
      void refreshCustodyBalances()
      void refreshGrinderCustodyBalances()
    } catch {
      // Error state handled in hook
    }
  }

  const handleAllocateCustodyGrinderSelect = useCallback(
    (grinder: GrinderCustodyState) => {
      setSelectedAllocateCustodyGrinderId(grinder.id)
      if (grinder.custodyWalletAddress) {
        setAllocateCustodyWallet(grinder.custodyWalletAddress)
      }
      resetAllocate()
    },
    [resetAllocate],
  )

  const handleDistributeCustodyGrinderSelect = useCallback(
    (grinder: GrinderCustodyState) => {
      setSelectedDistributeCustodyGrinderId(grinder.id)
      if (grinder.custodyWalletAddress) {
        setDistributeCustodyWallet(grinder.custodyWalletAddress)
      }
      resetDistribute()
    },
    [resetDistribute],
  )

  const handleAllocateCustodyWalletChange = useCallback(
    (wallet: string) => {
      setAllocateCustodyWallet(wallet)
      const trimmed = wallet.trim()
      const matched = custodyPickerGrinders.find(
        (grinder) =>
          grinder.custodyWalletAddress === trimmed ||
          grinder.custodyWallet?.toBase58() === trimmed,
      )
      setSelectedAllocateCustodyGrinderId(matched?.id ?? '')
      resetAllocate()
    },
    [custodyPickerGrinders, resetAllocate],
  )

  const handleDistributeCustodyWalletChange = useCallback(
    (wallet: string) => {
      setDistributeCustodyWallet(wallet)
      const trimmed = wallet.trim()
      const matched = custodyPickerGrinders.find(
        (grinder) =>
          grinder.custodyWalletAddress === trimmed ||
          grinder.custodyWallet?.toBase58() === trimmed,
      )
      setSelectedDistributeCustodyGrinderId(matched?.id ?? '')
      resetDistribute()
    },
    [custodyPickerGrinders, resetDistribute],
  )

  const handleCustodyTableGrinderSelect = useCallback(
    (grinder: GrinderCustodyState) => {
      if (activeCustodyTarget === 'allocate') {
        handleAllocateCustodyGrinderSelect(grinder)
      } else {
        handleDistributeCustodyGrinderSelect(grinder)
      }
    },
    [activeCustodyTarget, handleAllocateCustodyGrinderSelect, handleDistributeCustodyGrinderSelect],
  )

  return (
    <div className="grai-manage-section" id="grai-manage-section">
      {!isConfigured && (
        <p className="grai-manage-feedback is-error">GRAI is not configured for this network.</p>
      )}

      {(protocolAuthority || treasuryWallet) && (
        <div className="grai-manage-protocol-info-block">
          {protocolAuthority && (
            <p className="grai-page-ca grai-manage-protocol-info">
              <span className="grai-page-ca-label grai-page-ca-label--with-icon">
                <span className="grai-field-label-icon" aria-hidden="true">
                  {PROTOCOL_AUTHORITY_ICON}
                </span>
                Protocol authority:
              </span>{' '}
              <a
                href={solscanAccountUrl(protocolAuthority)}
                target="_blank"
                rel="noreferrer"
                className="grai-page-ca-link"
                title={protocolAuthority}
              >
                <span
                  className={`grai-page-ca-link-text${protocolAuthorityCopied ? ' is-copied' : ''}`}
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
                </span>
                <span className="grai-page-ca-link-icon" aria-hidden="true">
                  {MINT_ASSET_SOLSCAN_ICON}
                </span>
              </a>
            </p>
          )}
          {treasuryWallet && (
            <p className="grai-page-ca grai-manage-protocol-info">
              <span className="grai-page-ca-label grai-page-ca-label--with-icon">
                <span className="grai-field-label-icon" aria-hidden="true">
                  {TREASURY_WALLET_ICON}
                </span>
                Treasury wallet:
              </span>{' '}
              <a
                href={solscanAccountUrl(treasuryWallet)}
                target="_blank"
                rel="noreferrer"
                className="grai-page-ca-link"
                title={treasuryWallet}
              >
                <span
                  className={`grai-page-ca-link-text${treasuryWalletCopied ? ' is-copied' : ''}`}
                  role="button"
                  tabIndex={0}
                  title={treasuryWalletCopied ? 'Copied to clipboard' : 'Copy address'}
                  aria-label={treasuryWalletCopied ? 'Copied to clipboard' : 'Copy treasury wallet address'}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    void copyTreasuryWallet()
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      event.stopPropagation()
                      void copyTreasuryWallet()
                    }
                  }}
                >
                  {treasuryWalletCopied ? 'Copied!' : treasuryWallet}
                </span>
                <span className="grai-page-ca-link-icon" aria-hidden="true">
                  {MINT_ASSET_SOLSCAN_ICON}
                </span>
              </a>
            </p>
          )}
        </div>
      )}
      {protocolAuthorityError && (
        <p className="grai-manage-feedback is-error">{protocolAuthorityError}</p>
      )}

      <div className="grai-manage-cards">
        <section className="grai-manage-card grai-manage-action-card" aria-label="Allocate or distribute capital">
          <div className="grai-action-switch" role="tablist" aria-label="Allocate or distribute">
            <button
              type="button"
              role="tab"
              aria-selected={manageActionView === 'allocate'}
              className={`grai-action-switch-btn is-allocate ${manageActionView === 'allocate' ? 'is-active' : ''}`}
              onClick={() => handleManageActionViewChange('allocate')}
            >
              <span className="grai-action-switch-icon">{ALLOCATED_TABLE_ICON}</span>
              Allocate
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={manageActionView === 'distribute'}
              className={`grai-action-switch-btn is-distribute ${manageActionView === 'distribute' ? 'is-active' : ''}`}
              onClick={() => handleManageActionViewChange('distribute')}
            >
              <span className="grai-action-switch-icon">{YIELD_AMOUNT_FIELD_ICON}</span>
              Distribute
            </button>
          </div>

          <div className="grai-action-content">
            {manageActionView === 'allocate' ? (
              <>
          <p
            className={`grai-manage-hint${allocateWalletWarning ? ' is-wallet-warning' : ''}${
              allocateWalletWarning && walletWarningDismissed ? ' is-wallet-warning-acknowledged' : ''
            }`}
          >
            <span className="grai-manage-hint-label">
              <span className="grai-manage-hint-icon" aria-hidden="true">
                <WalletIcon size={16} />
              </span>
              Wallet:{' '}
              {!connectedWallet ? (
                'not connected'
              ) : (
                <span className="grai-manage-hint-wallet">
                  <code>{shortenAddress(connectedWallet)}</code>
                  {' — '}
                  <span className="grai-manage-hint-status">
                    {authorityMatches ? 'protocol authority' : 'not protocol authority'}
                  </span>
                </span>
              )}
            </span>
            {allocateWalletWarning && !walletWarningDismissed ? (
              <button
                type="button"
                className="grai-manage-hint-ok"
                onClick={() => setWalletWarningDismissed(true)}
                aria-label="Dismiss wallet warning"
              >
                OK
              </button>
            ) : null}
          </p>

          <GraiManageCustodyField
            id="grai-allocate-custody"
            grinders={custodyPickerGrinders}
            selectedWallet={allocateCustodyWallet}
            selectedGrinderId={selectedAllocateCustodyGrinderId}
            onChange={handleAllocateCustodyWalletChange}
            onSelectGrinder={handleAllocateCustodyGrinderSelect}
            onFocus={() => setActiveCustodyTarget('allocate')}
            menuOpen={allocateCustodyMenuOpen}
            onMenuOpenChange={setAllocateCustodyMenuOpen}
            solscanAccountUrl={solscanAccountUrl}
            listId="grai-allocate-custody-list"
          />

          <GraiManageInputField
            id="grai-allocate-amount"
            header={
              <div className="grai-mint-amount-header">
                <GraiFieldLabel icon={ASSET_FIELD_ICON}>Junior vault balance</GraiFieldLabel>
                <GraiVaultBalanceSlot amount={allocateMaxAmount} symbol={allocateAsset?.symbol} />
              </div>
            }
            value={allocateAmount}
            inputMode="decimal"
            allAmount={allocateMaxAmount}
            onChange={(value) => {
              setAllocateAmount(normalizeDecimalInput(value, allocateAssetDecimals))
              resetAllocate()
            }}
            trailing={
              <GraiManageAssetSelector
                assets={assets}
                selectedAsset={allocateAsset}
                isLoading={assetsLoading}
                menuOpen={allocateAssetMenuOpen}
                onMenuOpenChange={setAllocateAssetMenuOpen}
                onSelect={handleAllocateAssetSelect}
                solscanTokenUrl={solscanTokenUrl}
                listId="grai-allocate-asset-list"
              />
            }
            footer={
              <div className="grai-mint-split-shares-hint is-open" aria-label="Allocate custody estimate">
                <div className="grai-burn-assets-section-title">
                  <span className="grai-burn-assets-section-title-icon" aria-hidden="true">
                    {ALLOCATED_TABLE_ICON}
                  </span>
                  <span className="grai-burn-assets-section-title-label">Allocation:</span>
                  <button
                    type="button"
                    className={`grai-donut-legend-toggle ${isAllocateAllocationHidden ? 'is-collapsed' : ''}`}
                    onClick={() => setIsAllocateAllocationHidden((hidden) => !hidden)}
                    aria-expanded={!isAllocateAllocationHidden}
                    aria-controls="grai-allocate-allocation"
                    aria-label={
                      isAllocateAllocationHidden
                        ? 'Show allocation estimate'
                        : 'Hide allocation estimate'
                    }
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
                </div>
                {!isAllocateAllocationHidden && (
                  <div id="grai-allocate-allocation" className="grai-burn-assets-rows" aria-live="polite">
                    <div className="grai-burn-assets-row">
                      <span className="grai-burn-assets-amount">
                        <span className="grai-mint-split-vault-prefix">
                          <span className="grai-mint-split-vault-prefix-icon" aria-hidden="true">
                            {CUSTODY_FIELD_ICON}
                          </span>
                          Custody:
                        </span>
                        <span className="grai-burn-assets-amount-value">{allocateCustodyReceiveAmount}</span>
                      </span>
                      <span className="grai-burn-assets-token">
                        <span className="grai-burn-assets-token-icon" aria-hidden="true">
                          {allocateAsset && (
                            <img src={allocateAsset.icon.src} alt={allocateAsset.icon.alt} />
                          )}
                        </span>
                        {allocateCustodyReceiveSymbol}
                        {allocateAsset?.mint && (
                          <a
                            href={solscanTokenUrl(allocateAsset.mint)}
                            target="_blank"
                            rel="noreferrer"
                            className="grai-burn-assets-solscan"
                            aria-label={`View ${allocateAsset.symbol} on Solscan`}
                            title={`View ${allocateAsset.symbol} on Solscan`}
                          >
                            {MINT_ASSET_SOLSCAN_ICON}
                          </a>
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            }
          />
          {assetsError && <p className="grai-registry-hint is-error">{assetsError}</p>}

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
              !allocateAsset?.mint ||
              !allocateCustodyWallet.trim() ||
              !allocateAmount.trim() ||
              !authorityMatches
            }
            onClick={() => {
              void handleAllocate()
            }}
          >
            Allocate
          </button>
              </>
            ) : (
              <>
          <p
            className={`grai-manage-hint${distributeWalletWarning ? ' is-wallet-warning' : ''}${
              distributeWalletWarning && walletWarningDismissed ? ' is-wallet-warning-acknowledged' : ''
            }`}
          >
            <span className="grai-manage-hint-label">
              <span className="grai-manage-hint-icon" aria-hidden="true">
                <WalletIcon size={16} />
              </span>
              Wallet:{' '}
              {!connectedWallet ? (
                distributeConnectedWalletLabel
              ) : (
                <span className="grai-manage-hint-wallet">
                  <code>{shortenAddress(connectedWallet)}</code>
                  {' — '}
                  <span className="grai-manage-hint-status">{distributeConnectedWalletLabel}</span>
                </span>
              )}
            </span>
            {distributeWalletWarning && !walletWarningDismissed ? (
              <button
                type="button"
                className="grai-manage-hint-ok"
                onClick={() => setWalletWarningDismissed(true)}
                aria-label="Dismiss wallet warning"
              >
                OK
              </button>
            ) : null}
          </p>

          <GraiManageCustodyField
            id="grai-distribute-custody"
            grinders={custodyPickerGrinders}
            selectedWallet={distributeCustodyWallet}
            selectedGrinderId={selectedDistributeCustodyGrinderId}
            onChange={handleDistributeCustodyWalletChange}
            onSelectGrinder={handleDistributeCustodyGrinderSelect}
            onFocus={() => setActiveCustodyTarget('distribute')}
            menuOpen={distributeCustodyMenuOpen}
            onMenuOpenChange={setDistributeCustodyMenuOpen}
            solscanAccountUrl={solscanAccountUrl}
            listId="grai-distribute-custody-list"
          />

          <GraiManageInputField
            id="grai-distribute-amount"
            header={
              <div className="grai-mint-amount-header">
                <GraiFieldLabel icon={ASSET_FIELD_ICON}>Custody balance</GraiFieldLabel>
                <GraiVaultBalanceSlot amount={distributeAllAmount} symbol={distributeAsset?.symbol} />
              </div>
            }
            value={distributeAmount}
            inputMode="decimal"
            allAmount={distributeAllAmount}
            onChange={(value) => {
              setDistributeAmount(normalizeDecimalInput(value, distributeAssetDecimals))
              resetDistribute()
            }}
            trailing={
              <GraiManageAssetSelector
                assets={distributeGrinderAssets}
                selectedAsset={distributeAsset}
                isLoading={assetsLoading || grinderCustodyLoading}
                menuOpen={distributeAssetMenuOpen}
                onMenuOpenChange={setDistributeAssetMenuOpen}
                onSelect={handleDistributeAssetSelect}
                solscanTokenUrl={solscanTokenUrl}
                listId="grai-distribute-asset-list"
                emptyTriggerLabel={
                  selectedDistributeGrinder ? 'No assets' : 'Select custody'
                }
                listEmptyMessage={
                  selectedDistributeGrinder
                    ? `No assets on ${selectedDistributeGrinder.name}`
                    : 'Select custody first'
                }
              />
            }
            footer={
              <div className="grai-mint-split-shares-hint is-open" aria-label="Distribute yield split estimate">
                <div className="grai-burn-assets-section-title">
                  <span className="grai-burn-assets-section-title-icon" aria-hidden="true">
                    {DISTRIBUTION_ICON}
                  </span>
                  <span className="grai-burn-assets-section-title-label">Distribution:</span>
                  <button
                    type="button"
                    className={`grai-donut-legend-toggle ${isDistributeDistributionHidden ? 'is-collapsed' : ''}`}
                    onClick={() => setIsDistributeDistributionHidden((hidden) => !hidden)}
                    aria-expanded={!isDistributeDistributionHidden}
                    aria-controls="grai-distribute-distribution"
                    aria-label={
                      isDistributeDistributionHidden
                        ? 'Show distribution estimate'
                        : 'Hide distribution estimate'
                    }
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
                </div>
                {!isDistributeDistributionHidden && (
                  <div id="grai-distribute-distribution" className="grai-burn-assets-rows">
                    {(
                      [
                        {
                          key: 'senior',
                          label: 'Senior Vault:',
                          icon: SENIOR_VAULT_FIELD_ICON,
                          shareLabel: distributeSeniorLabel,
                        },
                        {
                          key: 'treasury',
                          label: 'Treasury:',
                          icon: TREASURY_WALLET_ICON,
                          shareLabel: distributeTreasuryLabel,
                        },
                      ] as const
                    ).map((row) => (
                      <div className="grai-burn-assets-row" key={row.key}>
                        <span className="grai-burn-assets-amount">
                          <span className="grai-mint-split-vault-prefix">
                            <span className="grai-mint-split-vault-prefix-icon" aria-hidden="true">
                              {row.icon}
                            </span>
                            {row.label}
                          </span>
                          <span className="grai-burn-assets-amount-value">
                            {!distributeAmount.trim() ? '—' : (row.shareLabel ?? '…')}
                          </span>
                        </span>
                        <span className="grai-burn-assets-token">
                          <span className="grai-burn-assets-token-icon" aria-hidden="true">
                            {distributeAsset && (
                              <img src={distributeAsset.icon.src} alt={distributeAsset.icon.alt} />
                            )}
                          </span>
                          {distributeAsset?.symbol ?? '—'}
                          {distributeAsset?.mint && (
                            <a
                              href={solscanTokenUrl(distributeAsset.mint)}
                              target="_blank"
                              rel="noreferrer"
                              className="grai-burn-assets-solscan"
                              aria-label={`View ${distributeAsset.symbol} on Solscan`}
                              title={`View ${distributeAsset.symbol} on Solscan`}
                            >
                              {MINT_ASSET_SOLSCAN_ICON}
                            </a>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            }
          />

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
              !distributeAsset?.mint ||
              !distributeCustodyWallet.trim() ||
              !distributeAmount.trim() ||
              !connectedWallet ||
              connectedWallet !== distributeCustodyWallet.trim()
            }
            onClick={() => {
              void handleDistribute()
            }}
          >
            Distribute
          </button>
              </>
            )}
          </div>
        </section>
      </div>

      <div className="grai-manage-vaults-row">
        <section className="grai-manage-junior-vault" aria-label="Junior vault balances">
          <div className="grai-manage-junior-vault-header">
            <div className="grai-manage-vault-title-row">
              <h2 className="grai-manage-junior-vault-title">
                <span className="grai-manage-junior-vault-title-icon" aria-hidden="true">
                  {JUNIOR_VAULT_TABLE_ICON}
                </span>
                Junior Vault
              </h2>
            </div>
            <span className="grai-manage-junior-vault-nav">
              NAV: <strong>{totalJuniorNavLabel}</strong>
            </span>
          </div>
          <div className="grai-manage-vault-table-shell">
            <div className="grai-manage-vault-table-scroll">
            <div
              className="grai-balance-table grai-manage-junior-vault-table"
              id="grai-manage-junior-vault-table"
              role="table"
            >
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
              <div
                className={`grai-vault-balance-body-panel${isJuniorVaultTableHidden ? '' : ' is-open'}`}
                aria-hidden={isJuniorVaultTableHidden}
              >
                <div className="grai-vault-balance-body-panel-inner">
                  <div className="grai-manage-junior-vault-body-grid">
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
                </div>
              </div>
            </div>
            </div>
            <div className="grai-vault-balance-toggle">
              <button
                type="button"
                className={`grai-donut-legend-toggle grai-vault-balance-show-toggle ${isJuniorVaultTableHidden ? 'is-collapsed' : ''}`}
                onClick={() => setIsJuniorVaultTableHidden((hidden) => !hidden)}
                aria-expanded={!isJuniorVaultTableHidden}
                aria-controls="grai-manage-junior-vault-table"
                aria-label={isJuniorVaultTableHidden ? 'Show junior vault table' : 'Hide junior vault table'}
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
            </div>
          </div>
          {vaultBalancesError && (
            <p className="grai-manage-feedback is-error">{vaultBalancesError}</p>
          )}
        </section>

        <section className="grai-manage-custody-vault" aria-label="Custody balances">
          <div className="grai-manage-junior-vault-header">
            <div className="grai-manage-vault-title-row">
              <h2 className="grai-manage-junior-vault-title">
                <span className="grai-manage-junior-vault-title-icon" aria-hidden="true">
                  {CUSTODY_FIELD_ICON}
                </span>
                Custodies
              </h2>
            </div>
            <span className="grai-manage-custody-wallet-link">{KNOWN_GRINDERS.length} grinders</span>
          </div>
          <div className="grai-manage-vault-table-shell">
            <div className="grai-manage-vault-table-scroll">
            <div
              className="grai-balance-table grai-manage-custody-vault-table"
              id="grai-manage-custody-table"
              role="table"
            >
              <div className="grai-balance-table-row grai-balance-table-row--head" role="row">
                <div className="grai-balance-table-cell grai-balance-table-cell--head grai-balance-table-cell--asset is-asset" role="columnheader">
                  <span className="grai-balance-table-col-icon">{CUSTODY_FIELD_ICON}</span>
                  Custody
                </div>
                <div className="grai-balance-table-cell grai-balance-table-cell--head is-asset" role="columnheader">
                  <span className="grai-balance-table-col-icon">{ASSET_FIELD_ICON}</span>
                  Assets
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
              <div
                className={`grai-vault-balance-body-panel${isCustodyTableHidden ? '' : ' is-open'}`}
                aria-hidden={isCustodyTableHidden}
              >
                <div className="grai-vault-balance-body-panel-inner">
                  <div className="grai-manage-custody-vault-body-grid">
                    {assetsLoading || grinderCustodyLoading ? (
                      custodyGrinderRows.map((row) => (
                        <div className="grai-balance-table-row" role="row" key={row.key}>
                          <div className="grai-balance-table-cell grai-balance-table-cell--asset grai-asset-cell" role="cell">
                            <GraiGrinderName
                              grinder={row.grinder}
                              copied={copiedGrinderId === row.grinder.id}
                              onCopy={(wallet, grinderId) => {
                                void copyGrinderAddress(wallet, grinderId)
                              }}
                            />
                          </div>
                          <div className="grai-balance-table-cell grai-balance-table-cell--asset grai-asset-cell" role="cell">
                            …
                          </div>
                          <div className="grai-balance-table-cell grai-balance-table-value" role="cell">…</div>
                          <div className="grai-balance-table-cell grai-balance-table-value" role="cell">…</div>
                        </div>
                      ))
                    ) : custodyGrinderRows.length === 0 ? (
                      <div className="grai-balance-table-row" role="row">
                        <div className="grai-balance-table-cell grai-balance-table-cell--asset grai-asset-cell" role="cell">
                          No grinders
                        </div>
                        <div className="grai-balance-table-cell grai-balance-table-cell--asset grai-asset-cell" role="cell">—</div>
                        <div className="grai-balance-table-cell grai-balance-table-value" role="cell">—</div>
                        <div className="grai-balance-table-cell grai-balance-table-value" role="cell">—</div>
                      </div>
                    ) : (
                      custodyGrinderRows.map((row) => {
                        const wallet = row.grinder.custodyWalletAddress || null
                        const matchesAllocate =
                          row.grinder.id === selectedAllocateCustodyGrinderId ||
                          (wallet !== null && allocateCustodyWallet.trim() === wallet)
                        const matchesDistribute =
                          row.grinder.id === selectedDistributeCustodyGrinderId ||
                          (wallet !== null && distributeCustodyWallet.trim() === wallet)

                        return (
                          <div
                            className={`grai-balance-table-row grai-manage-custody-grinder-row is-clickable${matchesAllocate ? ' is-selected-allocate' : ''}${matchesDistribute ? ' is-selected-distribute' : ''}`}
                            role="row"
                            key={row.key}
                            onClick={() => {
                              const pickerGrinder = custodyPickerGrinders.find(
                                (grinder) => grinder.id === row.grinder.id,
                              )
                              if (pickerGrinder) handleCustodyTableGrinderSelect(pickerGrinder)
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                const pickerGrinder = custodyPickerGrinders.find(
                                  (grinder) => grinder.id === row.grinder.id,
                                )
                                if (pickerGrinder) handleCustodyTableGrinderSelect(pickerGrinder)
                              }
                            }}
                            tabIndex={0}
                            aria-selected={matchesAllocate || matchesDistribute}
                          >
                            <div className="grai-balance-table-cell grai-balance-table-cell--asset grai-asset-cell" role="cell">
                              <GraiGrinderName
                                grinder={row.grinder}
                                copied={copiedGrinderId === row.grinder.id}
                                onCopy={(wallet, grinderId) => {
                                  void copyGrinderAddress(wallet, grinderId)
                                }}
                              />
                            </div>
                            <div className="grai-balance-table-cell grai-balance-table-cell--asset grai-asset-cell" role="cell">
                              {row.held.length === 0 ? (
                                '—'
                              ) : (
                                <div className="grai-manage-custody-held-assets">
                                  {row.held.map(({ asset, network }) => (
                                    <span className="grai-manage-custody-held-asset" key={`${network}-${asset.mint}`}>
                                      <span className="grai-asset-cell-token">
                                        <span className="grai-asset-cell-icon" aria-hidden="true">
                                          <img src={asset.icon.src} alt={asset.icon.alt} />
                                        </span>
                                        {asset.symbol}
                                      </span>
                                      <span className="grai-manage-custody-held-network">{network}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="grai-balance-table-cell grai-balance-table-value" role="cell">
                              {row.held.length === 0 ? (
                                '—'
                              ) : (
                                <div className="grai-manage-custody-held-values">
                                  {row.held.map(({ asset, network, balance }) => (
                                    <span key={`${network}-${asset.mint}-balance`}>{balance}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="grai-balance-table-cell grai-balance-table-value" role="cell">
                              {row.held.length === 0 ? (
                                '—'
                              ) : (
                                <div className="grai-manage-custody-held-values">
                                  {row.held.map(({ asset, network, yield: yieldAmount }) => (
                                    <span key={`${network}-${asset.mint}-yield`}>{yieldAmount}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
            </div>
            <div className="grai-vault-balance-toggle">
              <button
                type="button"
                className={`grai-donut-legend-toggle grai-vault-balance-show-toggle ${isCustodyTableHidden ? 'is-collapsed' : ''}`}
                onClick={() => setIsCustodyTableHidden((hidden) => !hidden)}
                aria-expanded={!isCustodyTableHidden}
                aria-controls="grai-manage-custody-table"
                aria-label={isCustodyTableHidden ? 'Show custodies table' : 'Hide custodies table'}
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
            </div>
          </div>
          {(grinderCustodyError || custodyBalancesError) && (
            <p className="grai-manage-feedback is-error">{grinderCustodyError ?? custodyBalancesError}</p>
          )}
        </section>
      </div>
    </div>
  )
}

export default GraiManageSection
