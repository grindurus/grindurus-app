import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { normalizeDecimalInput } from '../grai/onchain'
import { formatVaultBalanceDisplay } from '../grai/formatVaultBalance'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import type { GraiAsset } from '../grai/knownMints'
import type { GraiAssetVaultBalances } from '../grai/fetchVaultBalances'
import { USD_SCALE } from '../grai/tokenomics'
import { useGraiAssets } from '../hooks/useGraiAssets'
import { useGraiBurn } from '../hooks/useGraiBurn'
import { useGraiBurnEstimate } from '../hooks/useGraiBurnEstimate'
import { useGraiMintEstimate } from '../hooks/useGraiMintEstimate'
import { useGraiMint } from '../hooks/useGraiMint'
import { useGraiTotalSupply } from '../hooks/useGraiTotalSupply'
import { useGraiVaultBalances } from '../hooks/useGraiVaultBalances'
import { useWalletAssetBalance } from '../hooks/useWalletAssetBalance'
import { useSolanaWallet } from '../hooks/useSolanaWallet'
import { GraiNavDonut } from '../components/GraiNavDonut'
import { GraiTokenFlowDiagram } from '../components/GraiTokenFlowDiagram'
import { ChainSelectorModal } from '../components/ChainSelectorModal'
import { WalletIcon } from '../components/WalletIcon'
import { playBullSound, primeBullSound } from '../utils/playBullSound'
import { navigateTo } from '../utils/navigate'
import { KNOWN_GRINDERS } from '../grai/grinders'
import './GraiPage.css'

const BALANCE_COLUMN_ICONS = {
  assets: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="7" rx="8" ry="3" />
      <path d="M4 7v4c0 1.7 3.6 3 8 3s8-1.3 8-3V7" />
      <path d="M4 11v4c0 1.7 3.6 3 8 3s8-1.3 8-3v-4" />
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

const GRINDERS_COLUMN_ICONS = {
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
} as const

const BURN_TOTAL_SIGMA_ICON = (
  <span className="grai-burn-estimate-sigma" aria-hidden="true">
    Σ
  </span>
)

const BALANCE_FIELD_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
    <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
  </svg>
)

function GraiBalanceFieldLabel() {
  return (
    <span className="grai-field-label grai-field-label--with-icon">
      <span className="grai-field-label-icon">{BALANCE_FIELD_ICON}</span>
      Balance
    </span>
  )
}

const ASSET_CHART_COLORS = ['#ff69b4', '#7dffb2', '#7dd3fc', '#ffb347', '#c084fc', '#f472b6', '#34d399'] as const

function navSharePct(assetNavUsdRaw: bigint, totalNavUsdRaw: bigint): number {
  if (totalNavUsdRaw <= 0n || assetNavUsdRaw <= 0n) return 0
  return Number((assetNavUsdRaw * 10000n) / totalNavUsdRaw) / 100
}

function buildVaultCompositionRows(
  mintAssets: GraiAsset[],
  vaultBalances: Record<string, GraiAssetVaultBalances>,
  valueKey: 'seniorUsdRaw' | 'juniorUsdRaw',
) {
  if (mintAssets.length === 0) return []

  const rows = mintAssets.map((asset, index) => {
    const vault = vaultBalances[asset.mint]
    return {
      asset,
      color: ASSET_CHART_COLORS[index % ASSET_CHART_COLORS.length],
      senior: vault ? formatVaultBalanceDisplay(vault.seniorRaw, vault.decimals) : '—',
      junior: vault ? formatVaultBalanceDisplay(vault.juniorRaw, vault.decimals) : '—',
      allocated: vault ? formatVaultBalanceDisplay(vault.allocatedRaw, vault.decimals) : '—',
      valueUsdRaw: vault?.[valueKey] ?? 0n,
    }
  })
  const totalUsdRaw = rows.reduce((sum, row) => sum + row.valueUsdRaw, 0n)

  return rows.map((row) => ({
    ...row,
    pct: navSharePct(row.valueUsdRaw, totalUsdRaw),
    navUsdRaw: row.valueUsdRaw,
  }))
}

function shortenMintAddress(mint: string, head = 6, tail = 6) {
  if (mint.length <= head + tail + 3) return mint
  return `${mint.slice(0, head)}...${mint.slice(-tail)}`
}

const MINT_ASSET_SOLSCAN_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
)

const ACTION_SWITCH_ICONS = {
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

function GraiWalletBalanceSlot({
  label,
  symbol,
  isConnected,
  onConnect,
}: {
  label: string
  symbol?: string
  isConnected: boolean
  onConnect: () => void
}) {
  if (!isConnected) {
    return (
      <button type="button" className="grai-wallet-connect-btn" onClick={onConnect}>
        <WalletIcon size={14} />
        Connect Wallet
      </button>
    )
  }

  const trimmedSymbol = symbol?.trim()
  const symbolSuffix = trimmedSymbol ? ` ${trimmedSymbol}` : ''
  const amount =
    trimmedSymbol && label.endsWith(symbolSuffix) ? label.slice(0, -symbolSuffix.length) : label

  return (
    <span className="grai-wallet-balance">
      {trimmedSymbol ? (
        <>
          {amount}
          {' '}
          <span className="grai-wallet-balance-symbol">{trimmedSymbol}</span>
        </>
      ) : (
        label
      )}
    </span>
  )
}

function GraiPage() {
  const { solana, solscanTokenUrl, solscanTxUrl, clusterMismatch, solanaCluster, isConfigured } = useGraiDeployment()
  const {
    assets: mintAssets,
    isLoading: mintAssetsLoading,
    error: mintAssetsError,
    isRegistryLoaded,
  } = useGraiAssets()
  const { vaultBalances, isLoading: vaultBalancesLoading, refresh: refreshVaultBalances } = useGraiVaultBalances()
  const { totalSupplyLabel, isLoading: totalSupplyLoading, refresh: refreshTotalSupply } = useGraiTotalSupply()
  const { mint: mintGrai, status: mintStatus, error: mintError, lastSignature: mintSignature, isMinting, reset: resetMint } =
    useGraiMint()
  const { burn: burnGrai, status: burnStatus, error: burnError, lastSignature: burnSignature, isBurning, reset: resetBurn } =
    useGraiBurn()
  const { isConnected: isSolanaConnected } = useSolanaWallet()
  const [actionView, setActionView] = useState<'mint' | 'burn'>('mint')
  const [mintAmount, setMintAmount] = useState('')
  const [selectedMint, setSelectedMint] = useState('')
  const [mintAssetMenuOpen, setMintAssetMenuOpen] = useState(false)
  const [mintAddressCopied, setMintAddressCopied] = useState(false)
  const [burnAmount, setBurnAmount] = useState('')
  const [isLegendTableHidden, setIsLegendTableHidden] = useState(false)
  const [isGrindersTableHidden, setIsGrindersTableHidden] = useState(false)
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)
  const [isTokenFlowOpen, setIsTokenFlowOpen] = useState(false)
  const mintAssetMenuRef = useRef<HTMLDivElement>(null)
  const toggleTokenFlow = useCallback(() => {
    setIsTokenFlowOpen((open) => !open)
  }, [])
  const bullSoundPlayedForRef = useRef<string | null>(null)
  const selectedAsset = useMemo(
    () => mintAssets.find((asset) => asset.mint === selectedMint) ?? mintAssets[0],
    [mintAssets, selectedMint],
  )
  const { balanceLabel, maxAmount, decimals: assetDecimals, refresh: refreshWalletBalance } = useWalletAssetBalance(
    selectedAsset?.mint,
    selectedAsset?.symbol,
  )
  const { estimatedGrai, isLoading: isEstimateLoading } = useGraiMintEstimate(
    actionView === 'mint' ? selectedAsset?.mint : undefined,
    mintAmount,
    assetDecimals,
  )
  const { burnOutputs, isLoading: isBurnEstimateLoading } = useGraiBurnEstimate(
    burnAmount,
    actionView === 'burn',
  )
  const burnOutputByMint = useMemo(
    () => new Map(burnOutputs.map((output) => [output.asset.mint, output])),
    [burnOutputs],
  )
  const burnTotalUsdLabel = useMemo(() => {
    if (!burnAmount.trim()) return '—'
    if (isBurnEstimateLoading) return '…'
    const totalUsd = burnOutputs.reduce((sum, output) => sum + output.usdRaw, 0n)
    if (totalUsd <= 0n) return '$0'
    return `$${formatVaultBalanceDisplay(totalUsd, USD_SCALE)}`
  }, [burnAmount, burnOutputs, isBurnEstimateLoading])
  const graiMintAddress = solana?.graiMint.toBase58() ?? '—'
  const {
    balanceLabel: graiBalanceLabel,
    maxAmount: maxBurnAmount,
    decimals: graiDecimals,
    refresh: refreshGraiBalance,
  } = useWalletAssetBalance(actionView === 'burn' ? graiMintAddress : undefined, actionView === 'burn' ? 'GRAI' : undefined)
  const copySelectedMintAddress = useCallback(() => {
    if (!selectedAsset?.mint) return
    void navigator.clipboard.writeText(selectedAsset.mint).then(() => {
      setMintAddressCopied(true)
    })
  }, [selectedAsset?.mint])
  const compositionRows = useMemo(
    () => buildVaultCompositionRows(mintAssets, vaultBalances, 'seniorUsdRaw'),
    [mintAssets, vaultBalances],
  )
  const juniorCompositionRows = useMemo(
    () => buildVaultCompositionRows(mintAssets, vaultBalances, 'juniorUsdRaw'),
    [mintAssets, vaultBalances],
  )
  const totalNavUsdRaw = compositionRows.reduce((sum, row) => sum + row.navUsdRaw, 0n)
  const totalJuniorUsdRaw = juniorCompositionRows.reduce((sum, row) => sum + row.navUsdRaw, 0n)
  const totalNavLabel =
    vaultBalancesLoading || mintAssetsLoading
      ? '…'
      : formatVaultBalanceDisplay(totalNavUsdRaw, USD_SCALE, 2)
  const totalJuniorNavLabel =
    vaultBalancesLoading || mintAssetsLoading
      ? '…'
      : formatVaultBalanceDisplay(totalJuniorUsdRaw, USD_SCALE, 2)
  useEffect(() => {
    if (mintAssets.length === 0) return
    if (!mintAssets.some((asset) => asset.mint === selectedMint)) {
      setSelectedMint(mintAssets[0].mint)
    }
  }, [mintAssets, selectedMint])

  useEffect(() => {
    if (!mintAddressCopied) return
    const timer = window.setTimeout(() => setMintAddressCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [mintAddressCopied])

  useEffect(() => {
    setMintAddressCopied(false)
  }, [selectedMint])

  useEffect(() => {
    resetMint()
    resetBurn()
  }, [selectedMint, actionView, resetMint, resetBurn])

  useEffect(() => {
    setMintAmount('')
  }, [selectedMint])

  useEffect(() => {
    setBurnAmount('')
  }, [actionView])

  useEffect(() => {
    if (mintStatus !== 'success' || !mintSignature) return
    void refreshWalletBalance()
    void refreshVaultBalances()
    void refreshTotalSupply()
    if (bullSoundPlayedForRef.current !== mintSignature) {
      bullSoundPlayedForRef.current = mintSignature
      void playBullSound()
    }
  }, [mintStatus, mintSignature, refreshWalletBalance, refreshVaultBalances, refreshTotalSupply])

  useEffect(() => {
    if (burnStatus !== 'success' || !burnSignature) return
    void refreshGraiBalance()
    void refreshVaultBalances()
    void refreshTotalSupply()
    if (bullSoundPlayedForRef.current !== burnSignature) {
      bullSoundPlayedForRef.current = burnSignature
      void playBullSound()
    }
  }, [burnStatus, burnSignature, refreshGraiBalance, refreshVaultBalances, refreshTotalSupply])

  const handleMint = useCallback(async () => {
    if (!selectedAsset?.mint) return
    primeBullSound()
    try {
      await mintGrai({
        assetMint: selectedAsset.mint,
        amountInput: mintAmount,
      })
    } catch {
      // Error state is handled in useGraiMint.
    }
  }, [mintAmount, mintGrai, selectedAsset?.mint])

  const handleBurn = useCallback(async () => {
    primeBullSound()
    try {
      await burnGrai({ amountInput: burnAmount })
    } catch {
      // Error state is handled in useGraiBurn.
    }
  }, [burnAmount, burnGrai])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!mintAssetMenuRef.current) return
      if (!mintAssetMenuRef.current.contains(event.target as Node)) {
        setMintAssetMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  return (
    <div className="grai-page">
      <div className="grai-page-header">
        <h1>Grinders Artificial Index</h1>
        <button
          type="button"
          className={`grai-page-info-btn${isTokenFlowOpen ? ' is-active' : ' is-collapsed'}`}
          onClick={(event) => {
            event.stopPropagation()
            toggleTokenFlow()
          }}
          aria-expanded={isTokenFlowOpen}
          aria-controls="grai-token-flow-panel"
          aria-label="Flow"
        >
          <svg
            className="grai-page-info-btn-icon"
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
          flow
        </button>
      </div>

      <div
        id="grai-token-flow-panel"
        className="grai-token-flow-panel"
        hidden={!isTokenFlowOpen}
        aria-hidden={!isTokenFlowOpen}
      >
        {isTokenFlowOpen ? <GraiTokenFlowDiagram /> : null}
      </div>

      <div className="grai-page-meta">
        {clusterMismatch && (
          <p className="grai-page-network-warning" role="status">
            Switch your Solana wallet to {solanaCluster === 'mainnet-beta' ? 'Mainnet' : solanaCluster} to mint or burn GRAI.
          </p>
        )}
        {!isConfigured && (
          <p className="grai-page-network-warning" role="status">
            GRAI is not configured for this network. Set deployment env vars before using the app.
          </p>
        )}
        <p className="grai-page-ca">
          <span className="grai-page-ca-label">CA:</span>{' '}
          <a
            href={solscanTokenUrl(graiMintAddress)}
            target="_blank"
            rel="noreferrer"
            className="grai-page-ca-link"
            title={graiMintAddress}
          >
            <span className="grai-page-ca-link-text">{graiMintAddress}</span>
            <span className="grai-page-ca-link-icon">{MINT_ASSET_SOLSCAN_ICON}</span>
          </a>
        </p>
      </div>
      <div className="grai-content-row">
        <div className="grai-actions-block">
          <div className="grai-actions-row grai-actions-row-mint">
            <div className="grai-action-card grai-mint">
              <div className="grai-action-switch" role="tablist" aria-label="Mint or burn GRAI">
                <button
                  type="button"
                  role="tab"
                  aria-selected={actionView === 'mint'}
                  className={`grai-action-switch-btn is-mint ${actionView === 'mint' ? 'is-active' : ''}`}
                  onClick={() => setActionView('mint')}
                >
                  <span className="grai-action-switch-icon">{ACTION_SWITCH_ICONS.mint}</span>
                  MINT
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={actionView === 'burn'}
                  className={`grai-action-switch-btn is-burn ${
                    actionView === 'burn' ? 'is-active' : ''
                  }`}
                  onClick={() => setActionView('burn')}
                >
                  <span className="grai-action-switch-icon">{ACTION_SWITCH_ICONS.burn}</span>
                  BURN
                </button>
              </div>
              <div className="grai-action-content">
                {actionView === 'mint' ? (
                  <>
                    <div className="grai-mint-asset-field">
                      <div
                        className={`grai-mint-asset-label-row ${selectedAsset?.mint ? 'has-mint-address' : ''}`}
                      >
                        <span className="grai-mint-asset-label-text">
                          <span className="grai-field-label grai-field-label--with-icon">
                            <span className="grai-field-label-icon">{BALANCE_COLUMN_ICONS.assets}</span>
                            Asset
                          </span>
                          {selectedAsset?.mint && (
                            <span className="grai-mint-asset-address-actions">
                              <span className="grai-mint-asset-short-address-wrap">
                                <span className="grai-mint-asset-full-address">{selectedAsset.mint}</span>
                                <button
                                  type="button"
                                  className={`grai-mint-asset-short-address ${mintAddressCopied ? 'is-copied' : ''}`}
                                  onClick={copySelectedMintAddress}
                                  title={mintAddressCopied ? 'Copied to clipboard' : 'Copy mint address'}
                                  aria-label={`Copy ${selectedAsset.symbol} mint address`}
                                >
                                  {mintAddressCopied ? 'Copied!' : shortenMintAddress(selectedAsset.mint)}
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
                    </div>
                    <div className="grai-mint-amount-field">
                      <div className="grai-mint-amount-row">
                        <div className="grai-input-with-suffix has-max">
                          <input
                            type="text"
                            inputMode="decimal"
                            className="grai-input"
                            placeholder="0"
                            value={mintAmount}
                            onChange={(e) => {
                              setMintAmount(normalizeDecimalInput(e.target.value, assetDecimals ?? 9))
                            }}
                          />
                          <button
                            type="button"
                            className="grai-input-max-btn"
                            onClick={() => {
                              if (maxAmount) setMintAmount(maxAmount)
                            }}
                            disabled={!maxAmount}
                          >
                            MAX
                          </button>
                        </div>
                        <div className="grai-mint-asset-dropdown" ref={mintAssetMenuRef}>
                          <div className="grai-mint-asset-value">
                            <button
                              type="button"
                              className="grai-mint-asset-value-select"
                              onClick={() => setMintAssetMenuOpen((prev) => !prev)}
                              aria-haspopup="listbox"
                              aria-expanded={mintAssetMenuOpen}
                              aria-label="Select mint asset"
                            >
                              <span className="grai-mint-asset-item-icon" aria-hidden="true">
                                <img
                                  src={selectedAsset?.icon.src}
                                  alt={selectedAsset?.icon.alt ?? 'Asset'}
                                  width={16}
                                  height={16}
                                  loading="lazy"
                                  decoding="async"
                                />
                              </span>
                              <span className="grai-mint-asset-symbol">
                                {mintAssetsLoading
                                  ? 'Loading…'
                                  : selectedAsset?.symbol ?? (mintAssetsError ? 'Unavailable' : '—')}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="grai-mint-asset-caret-btn"
                              onClick={() => setMintAssetMenuOpen((prev) => !prev)}
                              aria-label="Open asset list"
                            >
                              <span className="grai-mint-asset-caret" aria-hidden="true">
                                ▾
                              </span>
                            </button>
                          </div>
                          {mintAssetMenuOpen && mintAssets.length > 0 && (
                            <div className="grai-mint-asset-list" role="listbox" aria-label="Mint asset list">
                              {mintAssets.map((asset) => (
                                <div
                                  key={asset.mint}
                                  role="option"
                                  aria-selected={selectedMint === asset.mint}
                                  className={`grai-mint-asset-item ${selectedMint === asset.mint ? 'active' : ''}`}
                                  onClick={() => {
                                    setSelectedMint(asset.mint)
                                    setMintAssetMenuOpen(false)
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault()
                                      setSelectedMint(asset.mint)
                                      setMintAssetMenuOpen(false)
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
                      </div>
                      <div className="grai-mint-amount-header">
                        <GraiBalanceFieldLabel />
                        <GraiWalletBalanceSlot
                          label={balanceLabel}
                          symbol={selectedAsset?.symbol}
                          isConnected={isSolanaConnected}
                          onConnect={() => setIsWalletModalOpen(true)}
                        />
                      </div>
                    </div>
                    {mintAssetsError && !isRegistryLoaded && (
                      <p className="grai-registry-hint is-error">{mintAssetsError}</p>
                    )}
                    <div className="grai-mint-feedback-slot">
                      {isMinting ? (
                        <p className="grai-mint-feedback is-pending">Confirming transaction…</p>
                      ) : mintError ? (
                        <p className="grai-mint-feedback is-error">{mintError}</p>
                      ) : mintSignature && mintStatus === 'success' ? (
                        <p className="grai-mint-feedback is-success grai-mint-feedback-confirmed">
                          Mint confirmed:{' '}
                          <a
                            href={solscanTxUrl(mintSignature)}
                            target="_blank"
                            rel="noreferrer"
                            title={mintSignature}
                          >
                            {shortenMintAddress(mintSignature)}
                          </a>
                        </p>
                      ) : (
                        mintAmount.trim() &&
                        (isEstimateLoading || estimatedGrai !== null) && (
                          <p className="grai-estimated-amount-label">
                            <span className="grai-estimated-amount-prefix">AMOUNT:</span>{' '}
                            <span className="grai-estimated-amount-value">
                              {isEstimateLoading ? (
                                <span className="grai-estimate-spinner" aria-label="Calculating GRAI estimate" />
                              ) : (
                                estimatedGrai
                              )}
                            </span>{' '}
                            {!isEstimateLoading && (
                              <span className="grai-estimated-amount-suffix">GRAI</span>
                            )}
                          </p>
                        )
                      )}
                    </div>
                    <button
                      type="button"
                      className="grai-mint-btn"
                      disabled={isMinting || !selectedAsset?.mint || !mintAmount.trim()}
                      onClick={() => {
                        void handleMint()
                      }}
                    >
                      {isMinting ? 'MINTING…' : 'MINT'}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="grai-mint-amount-field">
                      <div className="grai-input-with-suffix has-max">
                        <input
                          type="text"
                          inputMode="decimal"
                          className="grai-input"
                          placeholder="0"
                          value={burnAmount}
                          onChange={(e) => {
                            setBurnAmount(normalizeDecimalInput(e.target.value, graiDecimals ?? 9))
                          }}
                        />
                        <span className="grai-input-suffix">GRAI</span>
                        <button
                          type="button"
                          className="grai-input-max-btn"
                          onClick={() => {
                            if (maxBurnAmount) setBurnAmount(maxBurnAmount)
                          }}
                          disabled={!maxBurnAmount}
                        >
                          MAX
                        </button>
                      </div>
                      <div className="grai-mint-amount-header">
                        <GraiBalanceFieldLabel />
                        <GraiWalletBalanceSlot
                          label={graiBalanceLabel}
                          symbol="GRAI"
                          isConnected={isSolanaConnected}
                          onConnect={() => setIsWalletModalOpen(true)}
                        />
                      </div>
                    </div>
                    <div className="grai-burn-assets-hint is-open" aria-label="Burn outputs estimate">
                      <div className="grai-burn-assets-hint-header">
                        <span className="grai-burn-estimate-label">
                          <span className="grai-burn-estimate-label-icon" aria-hidden="true">
                            {BURN_TOTAL_SIGMA_ICON}
                          </span>
                          TOTAL:{' '}
                          {!burnAmount.trim() || burnTotalUsdLabel === '—'
                            ? burnTotalUsdLabel
                            : `~${burnTotalUsdLabel}`}
                        </span>
                      </div>
                      <div className="grai-burn-assets-rows">
                        {mintAssets.map((asset) => {
                          const output = burnOutputByMint.get(asset.mint)
                          return (
                            <div className="grai-burn-assets-row" key={asset.mint}>
                              <span className="grai-burn-assets-token">
                                <span className="grai-burn-assets-token-icon" aria-hidden="true">
                                  <img src={asset.icon.src} alt={asset.icon.alt} />
                                </span>
                                {asset.symbol}
                              </span>
                              <span className="grai-burn-assets-row-end">
                                <span className="grai-burn-assets-amount">
                                  {!burnAmount.trim()
                                    ? '—'
                                    : isBurnEstimateLoading
                                      ? '…'
                                      : (
                                        <>
                                          {output?.amountLabel ?? '0'}
                                          {output?.usdLabel && (
                                            <span className="grai-burn-assets-usd"> ~ {output.usdLabel}</span>
                                          )}
                                        </>
                                      )}
                                </span>
                                <a
                                  href={solscanTokenUrl(asset.mint)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="grai-burn-assets-solscan"
                                  aria-label={`View ${asset.symbol} on Solscan`}
                                  title={`View ${asset.symbol} on Solscan`}
                                >
                                  {MINT_ASSET_SOLSCAN_ICON}
                                </a>
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    <div className="grai-burn-feedback-slot">
                      {isBurning ? (
                        <p className="grai-mint-feedback is-pending">Confirming transaction…</p>
                      ) : burnError ? (
                        <p className="grai-mint-feedback is-error">{burnError}</p>
                      ) : burnSignature && burnStatus === 'success' ? (
                        <p className="grai-mint-feedback is-success grai-burn-feedback-confirmed">
                          Burn confirmed:{' '}
                          <a
                            href={solscanTxUrl(burnSignature)}
                            target="_blank"
                            rel="noreferrer"
                            title={burnSignature}
                          >
                            {shortenMintAddress(burnSignature)}
                          </a>
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="grai-burn-btn"
                      disabled={isBurning || !burnAmount.trim()}
                      onClick={() => {
                        void handleBurn()
                      }}
                    >
                      {isBurning ? 'BURNING…' : 'BURN'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <aside className="grai-assets-chart-card" aria-label="GRAI assets composition">
          <div className="grai-assets-split">
            <div className="grai-assets-overview">
              <div className="grai-donut-slot grai-donut-slot--supply" aria-label="GRAI total supply">
                <span className="grai-assets-supply-label">Total Supply</span>
                <span className="grai-assets-supply-value">
                  {totalSupplyLoading ? '…' : `${totalSupplyLabel} GRAI`}
                </span>
              </div>
              <div className="grai-donut-slot grai-donut-slot--senior">
                <GraiNavDonut
                  slices={compositionRows}
                  totalNavLabel={totalNavLabel}
                  centerLabel="Senior Vault NAV"
                  isLoading={vaultBalancesLoading || mintAssetsLoading}
                />
              </div>
              <div className="grai-donut-slot grai-donut-slot--junior">
                <GraiNavDonut
                  slices={juniorCompositionRows}
                  totalNavLabel={totalJuniorNavLabel}
                  centerLabel="Junior Vault NAV"
                  isLoading={vaultBalancesLoading || mintAssetsLoading}
                />
              </div>
            </div>
            <div className="grai-donut-legend">
              <div
                className={`grai-balance-table ${isLegendTableHidden ? 'is-collapsed' : ''}`}
                id="grai-vault-balance-table"
                aria-label="Asset balances by vault"
              >
                <div className="grai-balance-table-row grai-balance-table-row--head">
                  <div className="grai-balance-table-cell grai-balance-table-cell--head grai-balance-table-cell--asset is-asset">
                    <button
                      type="button"
                      className={`grai-donut-legend-toggle ${isLegendTableHidden ? 'is-collapsed' : ''}`}
                      onClick={() => setIsLegendTableHidden((hidden) => !hidden)}
                      aria-expanded={!isLegendTableHidden}
                      aria-controls="grai-vault-balance-table"
                      aria-label={isLegendTableHidden ? 'Show vault balances table' : 'Hide vault balances table'}
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
                    <span className="grai-balance-table-col-icon">{BALANCE_COLUMN_ICONS.assets}</span>
                    Assets
                  </div>
                  <div className="grai-balance-table-cell grai-balance-table-cell--head is-senior">
                    <span className="grai-balance-table-col-icon">{BALANCE_COLUMN_ICONS.seniorVault}</span>
                    Senior Vault
                  </div>
                  <div className="grai-balance-table-cell grai-balance-table-cell--head is-junior">
                    <span className="grai-balance-table-col-icon">{BALANCE_COLUMN_ICONS.juniorVault}</span>
                    Junior Vault
                  </div>
                  <div className="grai-balance-table-cell grai-balance-table-cell--head is-allocated">
                    <span className="grai-balance-table-col-icon">{BALANCE_COLUMN_ICONS.allocated}</span>
                    Allocated
                  </div>
                </div>
                {!isLegendTableHidden && (
                <>
                {mintAssetsLoading ? (
                  <div className="grai-balance-table-row">
                    <div className="grai-balance-table-cell grai-balance-table-cell--asset grai-asset-cell">
                      Loading assets…
                    </div>
                    <div className="grai-balance-table-cell grai-balance-table-value">—</div>
                    <div className="grai-balance-table-cell grai-balance-table-value">—</div>
                    <div className="grai-balance-table-cell grai-balance-table-value">—</div>
                  </div>
                ) : compositionRows.length === 0 ? (
                  <div className="grai-balance-table-row">
                    <div className="grai-balance-table-cell grai-balance-table-cell--asset grai-asset-cell">
                      No registry assets
                    </div>
                    <div className="grai-balance-table-cell grai-balance-table-value">—</div>
                    <div className="grai-balance-table-cell grai-balance-table-value">—</div>
                    <div className="grai-balance-table-cell grai-balance-table-value">—</div>
                  </div>
                ) : (
                  compositionRows.map((row) => (
                    <div className="grai-balance-table-row" key={row.asset.mint}>
                      <div className="grai-balance-table-cell grai-balance-table-cell--asset grai-asset-cell">
                        <span className="grai-asset-cell-token">
                          <span className="grai-asset-cell-icon" aria-hidden="true">
                            <img src={row.asset.icon.src} alt={row.asset.icon.alt} />
                          </span>
                          {row.asset.symbol}
                        </span>
                      </div>
                      <div className="grai-balance-table-cell grai-balance-table-value">
                        {vaultBalancesLoading ? '…' : row.senior}
                      </div>
                      <div className="grai-balance-table-cell grai-balance-table-value">
                        {vaultBalancesLoading ? '…' : row.junior}
                      </div>
                      <div className="grai-balance-table-cell grai-balance-table-value">
                        {vaultBalancesLoading ? '…' : row.allocated}
                      </div>
                    </div>
                  ))
                )}
                </>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
      <div className="grai-bottom-row">
        <section className="grai-bottom-card grai-bottom-card--table" aria-label="Grinders in system">
          <div
            className={`grai-grinders-table ${isGrindersTableHidden ? 'is-collapsed' : ''}`}
            id="grai-grinders-table"
            role="table"
            aria-label="Grinders table"
          >
            <div className="grai-grinders-row grai-grinders-row--group" role="row">
              <span
                role="columnheader"
                className="grai-grinders-group-general"
                style={{ gridColumn: '1 / span 2' }}
              >
                <button
                  type="button"
                  className={`grai-donut-legend-toggle ${isGrindersTableHidden ? 'is-collapsed' : ''}`}
                  onClick={() => setIsGrindersTableHidden((hidden) => !hidden)}
                  aria-expanded={!isGrindersTableHidden}
                  aria-controls="grai-grinders-table"
                  aria-label={isGrindersTableHidden ? 'Show grinders table' : 'Hide grinders table'}
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
                Grinders
              </span>
              <span role="columnheader" className="grai-grinders-group-title" style={{ gridColumn: '3 / span 2' }}>
                📦 Balances
              </span>
              <span role="columnheader" className="grai-grinders-group-title" style={{ gridColumn: '5 / span 2' }}>
                📈 Yield
              </span>
            </div>
            {!isGrindersTableHidden && (
              <>
            <div className="grai-grinders-row grai-grinders-row--head" role="row">
              <span role="columnheader" className="grai-grinders-col-grinder" aria-label="Grinder">
                <a
                  href="/grai/manage"
                  className="grai-grinders-col-grinder-link"
                  title="Grinder management"
                  onClick={(event) => {
                    event.preventDefault()
                    navigateTo('/grai/manage')
                  }}
                >
                  <span className="grai-grinders-col-logos" aria-hidden="true">
                    {KNOWN_GRINDERS.map((grinder) => (
                      <img
                        key={grinder.id}
                        src="/logo.png"
                        alt=""
                        className="grai-grinders-col-logo"
                      />
                    ))}
                  </span>
                </a>
              </span>
              <span role="columnheader" className="grai-grinders-col-head is-last-action">
                <span className="grai-grinders-col-icon">{GRINDERS_COLUMN_ICONS.lastActionTime}</span>
                Last action time
              </span>
              <span role="columnheader" className="grai-grinders-col-head is-base">
                <span className="grai-grinders-col-icon">{GRINDERS_COLUMN_ICONS.base}</span>
                Base
              </span>
              <span role="columnheader" className="grai-grinders-col-head is-quote">
                <span className="grai-grinders-col-icon">{GRINDERS_COLUMN_ICONS.quote}</span>
                Quote
              </span>
              <span role="columnheader" className="grai-grinders-col-head is-yield-base">
                <span className="grai-grinders-col-icon">{GRINDERS_COLUMN_ICONS.yieldBase}</span>
                Yield base
              </span>
              <span role="columnheader" className="grai-grinders-col-head is-yield-quote">
                <span className="grai-grinders-col-icon">{GRINDERS_COLUMN_ICONS.yieldQuote}</span>
                Yield quote
              </span>
            </div>
            <div className="grai-grinders-row" role="row">
              <span role="cell" className="grai-grinder-name">
                <span className="grai-grinder-active-dot" aria-hidden="true" />
                grinder1
              </span>
              <span role="cell">2m ago</span>
              <span role="cell">12 ETH</span>
              <span role="cell">18,240 USDC</span>
              <span role="cell" className="is-positive">
                +0.82 ETH
              </span>
              <span role="cell" className="is-positive">
                +2,140 USDC
              </span>
            </div>
            <div className="grai-grinders-row" role="row">
              <span role="cell" className="grai-grinder-name">
                <span className="grai-grinder-active-dot" aria-hidden="true" />
                grinder2
              </span>
              <span role="cell">7m ago</span>
              <span role="cell">95 SOL</span>
              <span role="cell">9,870 USDT</span>
              <span role="cell" className="is-positive">
                +10.6 SOL
              </span>
              <span role="cell" className="is-positive">
                +1,180 USDT
              </span>
            </div>
            <div className="grai-grinders-row" role="row">
              <span role="cell" className="grai-grinder-name">
                <span className="grai-grinder-active-dot" aria-hidden="true" />
                grinder3
              </span>
              <span role="cell">19m ago</span>
              <span role="cell">0.18 BTC</span>
              <span role="cell">14,220 USDC</span>
              <span role="cell" className="is-positive">
                +0.009 BTC
              </span>
              <span role="cell" className="is-positive">
                +620 USDC
              </span>
            </div>
            <div className="grai-grinders-row" role="row">
              <span role="cell" className="grai-grinder-name">
                <span className="grai-grinder-active-dot" aria-hidden="true" />
                grinder4
              </span>
              <span role="cell">31m ago</span>
              <span role="cell">2,450 ARB</span>
              <span role="cell">3,410 USDC</span>
              <span role="cell" className="is-positive">
                +380 ARB
              </span>
              <span role="cell" className="is-positive">
                +540 USDC
              </span>
            </div>
              </>
            )}
          </div>
        </section>
      </div>
      <ChainSelectorModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
      />
    </div>
  )
}

export default GraiPage
