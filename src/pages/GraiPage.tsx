import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { normalizeDecimalInput } from '../grai/onchain'
import { VaultBalanceTableValue } from '../components/VaultBalanceTableValue'
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
import { FloatingTokenBackground, STABLE_FLOATING_TOKENS } from '../components/FloatingTokenBackground'
import { GraiNavDonut } from '../components/GraiNavDonut'
import { GraiTokenFlowDiagram } from '../components/GraiTokenFlowDiagram'
import { ChainSelectorModal } from '../components/ChainSelectorModal'
import { WalletIcon } from '../components/WalletIcon'
import { playBullSound, primeBullSound } from '../utils/playBullSound'
import { assetUrl, toAppPath } from '../utils/appPaths'
import { type GraiSection, navigateToGraiSection } from '../utils/graiNavigation'
import { KNOWN_GRINDERS } from '../grai/grinders'
import { useDocumentChartTheme } from '../chart/useDocumentChartTheme'
import type { DocumentChartTheme } from '../chart/grindurusChartTheme'
import { ACTION_TX_ICON } from '../grai/graiActionIcons'
import { GraiManageSection } from './GraiManagePage'
import './GraiManagePage.css'
import './GraiPage.css'

const BALANCE_COLUMN_ICONS = {
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

const GRINDERS_COLUMN_ICONS = {
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
} as const

type GrinderDemoRow = {
  name: string
  lastActionLabel: string
  lastAction: string
  base: string
  quote: string
  quoteUsd: number
  yieldBase: string
  yieldQuote: string
  yieldQuoteUsd: number
}

const GRINDER_DEMO_ROWS: GrinderDemoRow[] = [
  {
    name: 'grinder1',
    lastActionLabel: 'Allocate',
    lastAction: '2m ago',
    base: '12 ETH',
    quote: '18,240 USDC',
    quoteUsd: 18_240,
    yieldBase: '+0.82 ETH',
    yieldQuote: '+2,140 USDC',
    yieldQuoteUsd: 2_140,
  },
  {
    name: 'grinder2',
    lastActionLabel: 'Distribute',
    lastAction: '7m ago',
    base: '95 SOL',
    quote: '9,870 USDT',
    quoteUsd: 9_870,
    yieldBase: '+10.6 SOL',
    yieldQuote: '+1,180 USDT',
    yieldQuoteUsd: 1_180,
  },
  {
    name: 'grinder3',
    lastActionLabel: 'Allocate',
    lastAction: '19m ago',
    base: '0.18 BTC',
    quote: '14,220 USDC',
    quoteUsd: 14_220,
    yieldBase: '+0.009 BTC',
    yieldQuote: '+620 USDC',
    yieldQuoteUsd: 620,
  },
  {
    name: 'grinder4',
    lastActionLabel: 'Distribute',
    lastAction: '31m ago',
    base: '2,450 ARB',
    quote: '3,410 USDC',
    quoteUsd: 3_410,
    yieldBase: '+380 ARB',
    yieldQuote: '+540 USDC',
    yieldQuoteUsd: 540,
  },
]

const GRINDER_DEMO_TVL_USD = GRINDER_DEMO_ROWS.reduce((sum, row) => sum + row.quoteUsd, 0)
const GRINDER_DEMO_YIELD_USD = GRINDER_DEMO_ROWS.reduce((sum, row) => sum + row.yieldQuoteUsd, 0)
const GRINDER_DEMO_UPTIME_LABEL = '99.999%'

function formatGrinderUsdCompactPart(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)
}

function formatGrinderUsdTotal(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '$0'

  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)

  if (abs >= 1_000_000_000) {
    return `${sign}$${formatGrinderUsdCompactPart(abs / 1_000_000_000)}B`
  }
  if (abs >= 1_000_000) {
    return `${sign}$${formatGrinderUsdCompactPart(abs / 1_000_000)}M`
  }
  if (abs >= 1_000) {
    return `${sign}$${formatGrinderUsdCompactPart(abs / 1_000)}K`
  }

  return `${sign}$${abs.toLocaleString('en-US')}`
}

const CONTRACT_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 3h8l4 4v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h3" />
    <path d="M16 3v5h5" />
    <path d="M8 13h8" />
    <path d="M8 17h6" />
  </svg>
)

const BALANCE_FIELD_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <ellipse cx="12" cy="7" rx="8" ry="3" />
    <path d="M4 7v4c0 1.7 3.6 3 8 3s8-1.3 8-3V7" />
    <path d="M4 11v4c0 1.7 3.6 3 8 3s8-1.3 8-3v-4" />
  </svg>
)

const FIELD_INFO_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
)

function GraiFieldInfoButton({ hint }: { hint: string }) {
  return (
    <span className="grai-field-info-wrap">
      <button type="button" className="grai-field-info-btn" aria-label={hint}>
        {FIELD_INFO_ICON}
      </button>
      <span className="grai-field-info-tooltip" role="tooltip">
        {hint}
      </span>
    </span>
  )
}

function GraiBalanceFieldLabel({ hint }: { hint: string }) {
  return (
    <span className="grai-balance-field-label-wrap">
      <span className="grai-field-label grai-field-label--with-icon">
        <span className="grai-field-label-icon">{BALANCE_FIELD_ICON}</span>
        Balance
      </span>
      <GraiFieldInfoButton hint={hint} />
    </span>
  )
}

const ASSET_CHART_COLORS: Record<DocumentChartTheme, readonly string[]> = {
  dark: ['#ff69b4', '#7dffb2', '#7dd3fc', '#ffb347', '#c084fc', '#f472b6', '#34d399'],
  light: ['#e91e8c', '#059669', '#0369a1', '#ea580c', '#9333ea', '#db2777', '#0d9488'],
}

function getAssetChartColors(theme: DocumentChartTheme) {
  return ASSET_CHART_COLORS[theme]
}

function navSharePct(assetNavUsdRaw: bigint, totalNavUsdRaw: bigint): number {
  if (totalNavUsdRaw <= 0n || assetNavUsdRaw <= 0n) return 0
  return Number((assetNavUsdRaw * 10000n) / totalNavUsdRaw) / 100
}

function buildVaultCompositionRows(
  mintAssets: GraiAsset[],
  vaultBalances: Record<string, GraiAssetVaultBalances>,
  valueKey: 'seniorUsdRaw' | 'juniorUsdRaw' | 'allocatedUsdRaw',
  chartColors: readonly string[],
) {
  if (mintAssets.length === 0) return []

  const rows = mintAssets.map((asset, index) => {
    const vault = vaultBalances[asset.mint]
    return {
      asset,
      color: chartColors[index % chartColors.length],
      senior: vault ? formatVaultBalanceDisplay(vault.seniorRaw, vault.decimals) : '—',
      junior: vault ? formatVaultBalanceDisplay(vault.juniorRaw, vault.decimals) : '—',
      allocated: vault ? formatVaultBalanceDisplay(vault.allocatedRaw, vault.decimals) : '—',
      seniorUsdRaw: vault?.seniorUsdRaw ?? 0n,
      juniorUsdRaw: vault?.juniorUsdRaw ?? 0n,
      allocatedUsdRaw: vault?.allocatedUsdRaw ?? 0n,
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

function buildTotalAssetCompositionRows(
  mintAssets: GraiAsset[],
  vaultBalances: Record<string, GraiAssetVaultBalances>,
  chartColors: readonly string[],
) {
  if (mintAssets.length === 0) return []

  const rows = mintAssets.map((asset, index) => {
    const vault = vaultBalances[asset.mint]
    const valueUsdRaw = (vault?.seniorUsdRaw ?? 0n) + (vault?.juniorUsdRaw ?? 0n)
    return {
      asset,
      color: chartColors[index % chartColors.length],
      valueUsdRaw,
    }
  })
  const totalUsdRaw = rows.reduce((sum, row) => sum + row.valueUsdRaw, 0n)

  return rows.map((row) => ({
    asset: row.asset,
    color: row.color,
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
}: {
  label: string
  symbol?: string
  isConnected: boolean
}) {
  if (!isConnected) {
    return (
      <span className="grai-wallet-action-slot">
        <span className="grai-wallet-balance">—</span>
      </span>
    )
  }

  const trimmedSymbol = symbol?.trim()
  const symbolSuffix = trimmedSymbol ? ` ${trimmedSymbol}` : ''
  const amount =
    trimmedSymbol && label.endsWith(symbolSuffix)
      ? label.slice(0, -symbolSuffix.length).trimEnd()
      : label

  return (
    <span className="grai-wallet-action-slot">
      <span className="grai-wallet-balance">
      {trimmedSymbol ? (
        <>
          <span className="grai-wallet-balance-amount">{amount}</span>
          <span className="grai-wallet-balance-symbol">{trimmedSymbol}</span>
        </>
      ) : (
        label
      )}
    </span>
    </span>
  )
}

function GraiWalletActorRow({
  label,
  hint,
  isConnected,
  shortAddress,
  connectedWalletAddress,
  walletCopied,
  onCopyWallet,
  onConnect,
  solscanAccountUrl,
}: {
  label: string
  hint: string
  isConnected: boolean
  shortAddress?: string | null
  connectedWalletAddress?: string | null
  walletCopied: boolean
  onCopyWallet: () => void
  onConnect: () => void
  solscanAccountUrl: (address: string) => string
}) {
  return (
    <p className="grai-mint-feedback-wallet">
      <span className="grai-mint-asset-label-text">
        <span className="grai-balance-field-label-wrap">
          <span className="grai-field-label grai-field-label--with-icon">
            <span className="grai-field-label-icon" aria-hidden="true">
              <WalletIcon size={16} />
            </span>
            {label}
          </span>
          <GraiFieldInfoButton hint={hint} />
        </span>
        {isConnected && shortAddress && connectedWalletAddress ? (
          <span className="grai-mint-asset-address-actions">
            <span className="grai-mint-asset-short-address-wrap">
              <button
                type="button"
                className={`grai-mint-asset-short-address${walletCopied ? ' is-copied' : ''}`}
                onClick={() => {
                  void onCopyWallet()
                }}
                title={walletCopied ? 'Copied to clipboard' : connectedWalletAddress}
                aria-label={walletCopied ? 'Copied to clipboard' : 'Copy wallet address'}
              >
                {walletCopied ? 'Copied!' : shortAddress}
              </button>
            </span>
            <a
              href={solscanAccountUrl(connectedWalletAddress)}
              target="_blank"
              rel="noreferrer"
              className="grai-mint-asset-trigger-solscan"
              aria-label="View wallet on Solscan"
              title="View wallet on Solscan"
            >
              {MINT_ASSET_SOLSCAN_ICON}
            </a>
          </span>
        ) : (
          <span className="grai-mint-asset-address-actions">
            <button
              type="button"
              className="grai-wallet-connect-btn grai-mint-feedback-wallet-connect"
              onClick={onConnect}
            >
              <WalletIcon size={14} />
              Connect Wallet
            </button>
          </span>
        )}
      </span>
    </p>
  )
}

function GraiPage() {
  const chartTheme = useDocumentChartTheme()
  const assetChartColors = useMemo(() => getAssetChartColors(chartTheme), [chartTheme])
  const { solana, solscanTokenUrl, solscanTxUrl, solscanAccountUrl, clusterMismatch, solanaCluster, isConfigured } = useGraiDeployment()
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
  const { isConnected: isSolanaConnected, shortAddress, address: connectedWalletAddress } = useSolanaWallet()
  const [actionView, setActionView] = useState<'mint' | 'burn'>('mint')
  const [mintAmount, setMintAmount] = useState('')
  const [selectedMint, setSelectedMint] = useState('')
  const [mintAssetMenuOpen, setMintAssetMenuOpen] = useState(false)
  const [minterWalletCopied, setMinterWalletCopied] = useState(false)
  const [burnAmount, setBurnAmount] = useState('')
  const [isLegendTableHidden, setIsLegendTableHidden] = useState(false)
  const [isGrindersTableHidden, setIsGrindersTableHidden] = useState(true)
  const [isBurnAssetsRowsHidden, setIsBurnAssetsRowsHidden] = useState(true)
  const [isMintSplitSharesHidden, setIsMintSplitSharesHidden] = useState(true)
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)
  const [isTokenFlowOpen, setIsTokenFlowOpen] = useState(false)
  const [hasTokenFlowMounted, setHasTokenFlowMounted] = useState(false)
  const mintAssetMenuRef = useRef<HTMLDivElement>(null)
  const toggleTokenFlow = useCallback(() => {
    setIsTokenFlowOpen((open) => !open)
  }, [])
  useEffect(() => {
    if (isTokenFlowOpen) setHasTokenFlowMounted(true)
  }, [isTokenFlowOpen])
  useEffect(() => {
    const applySection = (section: GraiSection) => {
      if (section === 'mint') setActionView('mint')
      else if (section === 'burn') setActionView('burn')
      else if (section === 'grinders') setIsGrindersTableHidden(false)
    }

    const onSectionNav = (event: Event) => {
      applySection((event as CustomEvent<GraiSection>).detail)
    }

    const onHashChange = () => {
      const hash = window.location.hash.slice(1)
      if (hash === 'mint' || hash === 'burn' || hash === 'grinders' || hash === 'allocate' || hash === 'distribute' || hash === 'manage') {
        applySection(hash === 'manage' ? 'allocate' : hash)
      }
    }

    window.addEventListener('grai-section-nav', onSectionNav)
    window.addEventListener('hashchange', onHashChange)
    onHashChange()

    return () => {
      window.removeEventListener('grai-section-nav', onSectionNav)
      window.removeEventListener('hashchange', onHashChange)
    }
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
  const { estimatedGrai, seniorShareLabel, juniorShareLabel, seniorShareUsdRaw, juniorShareUsdRaw, isLoading: isEstimateLoading } = useGraiMintEstimate(
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
  const copyMinterWalletAddress = useCallback(() => {
    if (!connectedWalletAddress) return
    void navigator.clipboard.writeText(connectedWalletAddress).then(() => {
      setMinterWalletCopied(true)
    })
  }, [connectedWalletAddress])
  const compositionRows = useMemo(
    () => buildVaultCompositionRows(mintAssets, vaultBalances, 'seniorUsdRaw', assetChartColors),
    [mintAssets, vaultBalances, assetChartColors],
  )
  const juniorCompositionRows = useMemo(
    () => buildVaultCompositionRows(mintAssets, vaultBalances, 'juniorUsdRaw', assetChartColors),
    [mintAssets, vaultBalances, assetChartColors],
  )
  const supplyCompositionRows = useMemo(
    () => buildTotalAssetCompositionRows(mintAssets, vaultBalances, assetChartColors),
    [mintAssets, vaultBalances, assetChartColors],
  )
  const allocatedCompositionRows = useMemo(
    () => buildVaultCompositionRows(mintAssets, vaultBalances, 'allocatedUsdRaw', assetChartColors),
    [mintAssets, vaultBalances, assetChartColors],
  )
  const totalNavUsdRaw = compositionRows.reduce((sum, row) => sum + row.navUsdRaw, 0n)
  const totalJuniorUsdRaw = juniorCompositionRows.reduce((sum, row) => sum + row.navUsdRaw, 0n)
  const totalAllocatedUsdRaw = allocatedCompositionRows.reduce((sum, row) => sum + row.navUsdRaw, 0n)
  const totalNavLabel =
    vaultBalancesLoading || mintAssetsLoading
      ? '…'
      : formatVaultBalanceDisplay(totalNavUsdRaw, USD_SCALE, 2)
  const totalJuniorNavLabel =
    vaultBalancesLoading || mintAssetsLoading
      ? '…'
      : formatVaultBalanceDisplay(totalJuniorUsdRaw, USD_SCALE, 2)
  const totalAllocatedNavLabel =
    vaultBalancesLoading || mintAssetsLoading
      ? '…'
      : formatVaultBalanceDisplay(totalAllocatedUsdRaw, USD_SCALE, 2)
  useEffect(() => {
    if (mintAssets.length === 0) return
    if (!mintAssets.some((asset) => asset.mint === selectedMint)) {
      setSelectedMint(mintAssets[0].mint)
    }
  }, [mintAssets, selectedMint])

  useEffect(() => {
    if (!minterWalletCopied) return
    const timer = window.setTimeout(() => setMinterWalletCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [minterWalletCopied])

  useEffect(() => {
    setMinterWalletCopied(false)
  }, [connectedWalletAddress])

  useEffect(() => {
    resetMint()
    resetBurn()
  }, [selectedMint, actionView, resetMint, resetBurn])

  useEffect(() => {
    setMintAmount('')
  }, [selectedMint])

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
        <div className="grai-page-info-group">
          <button
            type="button"
            className={`grai-page-info-btn${isTokenFlowOpen ? ' is-active' : ' is-collapsed'}`}
            onClick={(event) => {
              event.stopPropagation()
              toggleTokenFlow()
            }}
            aria-expanded={isTokenFlowOpen}
            aria-controls="grai-token-flow-panel"
            aria-label="How it works"
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
            HOW IT WORKS
          </button>
        </div>
      </div>

      <div
        id="grai-token-flow-panel"
        className={`grai-token-flow-panel${isTokenFlowOpen ? ' is-open' : ''}`}
        aria-hidden={!isTokenFlowOpen}
      >
        <div className="grai-token-flow-panel-inner">
          {hasTokenFlowMounted ? <GraiTokenFlowDiagram /> : null}
        </div>
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
          <span className="grai-page-ca-label grai-page-ca-label--with-icon">
            <span className="grai-field-label-icon" aria-hidden="true">
              {CONTRACT_ICON}
            </span>
            CA:
          </span>{' '}
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

      <div className="grai-bottom-row">
        <div className="grai-grinders-summary-shell" id="grai-grinders-summary">
          <div className="grai-grinders-row grai-grinders-row--group grai-grinders-row--summary" role="row">
            <span className="grai-grinders-summary-leading" style={{ gridColumn: '1 / span 2' }}>
              <span role="columnheader" className="grai-grinders-group-general">
                <span className="grai-grinder-active-dot" aria-hidden="true" />
                {KNOWN_GRINDERS.length} grinders
              </span>
            </span>
            <span role="columnheader" className="grai-grinders-group-title is-uptime is-stacked" style={{ gridColumn: 3 }}>
              <span className="grai-grinders-group-title-label">
                <span className="grai-grinders-group-title-icon" aria-hidden="true">
                  {GRINDERS_COLUMN_ICONS.lastActionTime}
                </span>
                UPTIME
              </span>
              <span className="grai-grinders-group-title-value">{GRINDER_DEMO_UPTIME_LABEL}</span>
            </span>
            <span role="columnheader" className="grai-grinders-group-title is-tvl is-stacked" style={{ gridColumn: '4 / span 2' }}>
              <span className="grai-grinders-group-title-label">
                <span className="grai-grinders-group-title-icon" aria-hidden="true">
                  {GRINDERS_COLUMN_ICONS.quote}
                </span>
                TOTAL VALUE LOCKED
              </span>
              <span className="grai-grinders-group-title-value">
                {formatGrinderUsdTotal(GRINDER_DEMO_TVL_USD)}
              </span>
            </span>
            <span role="columnheader" className="grai-grinders-group-title is-yield is-stacked" style={{ gridColumn: '6 / span 2' }}>
              <span className="grai-grinders-group-title-label">
                <span className="grai-grinders-group-title-icon" aria-hidden="true">
                  {GRINDERS_COLUMN_ICONS.yieldQuote}
                </span>
                TOTAL YIELD
              </span>
              <span className="grai-grinders-group-title-value is-positive">
                + {formatGrinderUsdTotal(GRINDER_DEMO_YIELD_USD)}
              </span>
            </span>
          </div>
          <section
            className={`grai-bottom-card grai-bottom-card--table grai-grinders-table-panel${isGrindersTableHidden ? '' : ' is-open'}`}
            aria-hidden={isGrindersTableHidden}
            aria-label="Grinders in system"
          >
          <div className="grai-grinders-table-panel-inner">
            <div
              className="grai-grinders-table"
              id="grai-grinders-table"
              role="table"
              aria-label="Grinders table"
            >
              <div className="grai-grinders-row grai-grinders-row--head" role="row">
              <span role="columnheader" className="grai-grinders-col-grinder" aria-label="Grinder">
                <a
                  href={`${toAppPath('/grai')}#allocate`}
                  className="grai-grinders-col-grinder-link"
                  title="Grinder management"
                  onClick={(event) => {
                    event.preventDefault()
                    navigateToGraiSection('allocate')
                  }}
                >
                  <span className="grai-grinders-col-logos" aria-hidden="true">
                    {KNOWN_GRINDERS.map((grinder) => (
                      <img
                        key={grinder.id}
                        src={assetUrl('logo.png')}
                        alt=""
                        className="grai-grinders-col-logo"
                      />
                    ))}
                  </span>
                </a>
              </span>
              <span role="columnheader" className="grai-grinders-col-head is-last-action-kind">
                <span className="grai-grinders-col-icon">{GRINDERS_COLUMN_ICONS.lastAction}</span>
                Last action
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
            {GRINDER_DEMO_ROWS.map((row) => (
              <div className="grai-grinders-row" role="row" key={row.name}>
                <span role="cell" className="grai-grinder-name">
                  <span className="grai-grinder-active-dot" aria-hidden="true" />
                  {row.name}
                </span>
                <span role="cell">{row.lastActionLabel}</span>
                <span role="cell">{row.lastAction}</span>
                <span role="cell">{row.base}</span>
                <span role="cell">{row.quote}</span>
                <span role="cell" className="is-positive">
                  {row.yieldBase}
                </span>
                <span role="cell" className="is-positive">
                  {row.yieldQuote}
                </span>
              </div>
            ))}
            </div>
          </div>
        </section>
          <div className="grai-grinders-summary-toggle">
            <button
              type="button"
              className={`grai-donut-legend-toggle grai-grinders-show-all-toggle ${isGrindersTableHidden ? 'is-collapsed' : ''}`}
              onClick={() => setIsGrindersTableHidden((hidden) => !hidden)}
              aria-expanded={!isGrindersTableHidden}
              aria-controls="grai-grinders-table"
              aria-label={isGrindersTableHidden ? 'Show all grinders' : 'Hide grinders table'}
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
      </div>

      <FloatingTokenBackground tokens={STABLE_FLOATING_TOKENS} className="grai-content-row">
        <div className="grai-actions-block" id="grai-actions-section">
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
                    <GraiWalletActorRow
                      label="Minter"
                      hint="Minter wallet for signing mint transactions"
                      isConnected={isSolanaConnected}
                      shortAddress={shortAddress}
                      connectedWalletAddress={connectedWalletAddress}
                      walletCopied={minterWalletCopied}
                      onCopyWallet={copyMinterWalletAddress}
                      onConnect={() => setIsWalletModalOpen(true)}
                      solscanAccountUrl={solscanAccountUrl}
                    />
                    <div className="grai-mint-amount-block">
                    <div className="grai-mint-amount-header">
                      <GraiBalanceFieldLabel hint="Minter's wallet balance of selected asset" />
                      <GraiWalletBalanceSlot
                        label={balanceLabel}
                        symbol={selectedAsset?.symbol}
                        isConnected={isSolanaConnected}
                      />
                    </div>
                    <div className="grai-mint-amount-field">
                      <span className="grai-field-label grai-field-label--with-icon grai-mint-amount-input-label">
                        <span className="grai-field-label-icon" aria-hidden="true">
                          {ACTION_SWITCH_ICONS.mint}
                        </span>
                        Deposit Amount
                      </span>
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
                      {!isMinting && !mintError && !(mintSignature && mintStatus === 'success') ? (
                        <p className="grai-estimated-amount-label">
                          <span className="grai-estimated-amount-prefix" aria-label="Amount">
                            <span className="grai-field-label-icon" aria-hidden="true">
                              <WalletIcon size={14} />
                            </span>
                            MINTER + 
                          </span>
                          {mintAmount.trim() && (isEstimateLoading || estimatedGrai !== null) ? (
                            <>
                              <span className="grai-estimated-amount-value">
                                {isEstimateLoading ? (
                                  <span className="grai-estimate-spinner" aria-label="Calculating GRAI estimate" />
                                ) : (
                                  estimatedGrai
                                )}
                              </span>
                              {!isEstimateLoading && (
                                <span className="grai-estimated-amount-suffix"> GRAI</span>
                              )}
                            </>
                          ) : (
                            <span className="grai-estimated-amount-hint">
                              est. <span className="grai-estimated-amount-suffix">GRAI</span> minter receive
                            </span>
                          )}
                        </p>
                      ) : null}
                    </div>
                    {mintAssetsError && !isRegistryLoaded && (
                      <p className="grai-registry-hint is-error">{mintAssetsError}</p>
                    )}
                    <div className="grai-mint-split-shares-hint is-open" aria-label="Mint deposit split estimate">
                      <div className="grai-burn-assets-section-title">
                        <span className="grai-burn-assets-section-title-icon" aria-hidden="true">
                          {ACTION_TX_ICON}
                        </span>
                        <span className="grai-burn-assets-section-title-label">TX PREVIEW</span>
                        <button
                          type="button"
                          className={`grai-donut-legend-toggle ${isMintSplitSharesHidden ? 'is-collapsed' : ''}`}
                          onClick={() => setIsMintSplitSharesHidden((hidden) => !hidden)}
                          aria-expanded={!isMintSplitSharesHidden}
                          aria-controls="grai-mint-split-shares"
                          aria-label={
                            isMintSplitSharesHidden
                              ? 'Show split shares estimate'
                              : 'Hide split shares estimate'
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
                      {!isMintSplitSharesHidden && (
                      <div id="grai-mint-split-shares" className="grai-burn-assets-rows">
                        {(
                          [
                            {
                              key: 'senior',
                              label: 'Sr. Vault +',
                              hint: 'Amount transfered to Senior Vault as Collateral under GRAI',
                              shareLabel: seniorShareLabel,
                              shareUsdRaw: seniorShareUsdRaw,
                            },
                            {
                              key: 'junior',
                              label: 'Jr. Vault +',
                              hint: 'Amount transfered to Junior Vault as Yield Generation to Grinders',
                              shareLabel: juniorShareLabel,
                              shareUsdRaw: juniorShareUsdRaw,
                            },
                          ] as const
                        ).map((row) => (
                          <div className="grai-burn-assets-row" key={row.key}>
                            <span className="grai-burn-assets-amount">
                              <span className="grai-mint-split-vault-prefix">
                                <GraiFieldInfoButton hint={row.hint} />
                                {row.label}
                              </span>
                              <span className={`grai-burn-assets-amount-value${!mintAmount.trim() ? ' is-placeholder' : ''}`}>
                                <VaultBalanceTableValue
                                  amount={!mintAmount.trim() ? '0.0' : row.shareLabel ?? '0.0'}
                                  usdRaw={row.shareUsdRaw}
                                  isLoading={Boolean(mintAmount.trim()) && isEstimateLoading}
                                />
                              </span>
                            </span>
                            <span className="grai-burn-assets-token">
                              <span className="grai-burn-assets-token-icon" aria-hidden="true">
                                {selectedAsset && (
                                  <img src={selectedAsset.icon.src} alt={selectedAsset.icon.alt} />
                                )}
                              </span>
                              {selectedAsset?.symbol ?? '—'}
                              {selectedAsset?.mint && (
                                <a
                                  href={solscanTokenUrl(selectedAsset.mint)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="grai-burn-assets-solscan"
                                  aria-label={`View ${selectedAsset.symbol} on Solscan`}
                                  title={`View ${selectedAsset.symbol} on Solscan`}
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
                    </div>
                    {(isMinting || mintError || (mintSignature && mintStatus === 'success')) && (
                    <div className="grai-mint-feedback-slot">
                      {isMinting ? (
                        <p className="grai-mint-feedback is-pending">Confirming transaction…</p>
                      ) : mintError ? (
                        <p className="grai-mint-feedback is-error">{mintError}</p>
                      ) : (
                        <p className="grai-mint-feedback is-success grai-mint-feedback-confirmed">
                          Mint confirmed:{' '}
                          <a
                            href={solscanTxUrl(mintSignature!)}
                            target="_blank"
                            rel="noreferrer"
                            title={mintSignature!}
                          >
                            {shortenMintAddress(mintSignature!)}
                          </a>
                        </p>
                      )}
                    </div>
                    )}
                    <button
                      type="button"
                      className="grai-mint-btn"
                      disabled={isMinting || !selectedAsset?.mint || !mintAmount.trim()}
                      onClick={() => {
                        void handleMint()
                      }}
                    >
                      <span className="grai-action-tx-btn-icon" aria-hidden="true">
                        {ACTION_TX_ICON}
                      </span>
                      {isMinting ? 'MINTING…' : 'MINT'}
                    </button>
                  </>
                ) : (
                  <>
                    <GraiWalletActorRow
                      label="Burner"
                      hint="Burner wallet for signing burn transactions"
                      isConnected={isSolanaConnected}
                      shortAddress={shortAddress}
                      connectedWalletAddress={connectedWalletAddress}
                      walletCopied={minterWalletCopied}
                      onCopyWallet={copyMinterWalletAddress}
                      onConnect={() => setIsWalletModalOpen(true)}
                      solscanAccountUrl={solscanAccountUrl}
                    />
                    <div className="grai-mint-amount-block">
                    <div className="grai-mint-amount-header">
                        <GraiBalanceFieldLabel hint="Burner's wallet balance of GRAI" />
                        <GraiWalletBalanceSlot
                          label={graiBalanceLabel}
                          symbol="GRAI"
                          isConnected={isSolanaConnected}
                        />
                      </div>
                    <div className="grai-mint-amount-field">
                      <span className="grai-field-label grai-field-label--with-icon grai-mint-amount-input-label">
                        <span className="grai-field-label-icon" aria-hidden="true">
                          {ACTION_SWITCH_ICONS.burn}
                        </span>
                        Burn Amount
                      </span>
                      <div className="grai-mint-amount-row">
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
                        <span className="grai-burn-amount-suffix">
                          <span className="grai-mint-asset-item-icon" aria-hidden="true">
                            <img
                              src={assetUrl('logo.png')}
                              alt=""
                              width={16}
                              height={16}
                              loading="lazy"
                              decoding="async"
                            />
                          </span>
                          GRAI
                          {solana?.graiMint && (
                            <a
                              href={solscanTokenUrl(graiMintAddress)}
                              target="_blank"
                              rel="noreferrer"
                              className="grai-mint-asset-value-solscan"
                              aria-label="View GRAI contract on Solscan"
                              title="View GRAI contract on Solscan"
                            >
                              {MINT_ASSET_SOLSCAN_ICON}
                            </a>
                          )}
                        </span>
                      </div>
                      {!isBurning && !burnError && !(burnSignature && burnStatus === 'success') ? (
                        <p className="grai-estimated-amount-label grai-burn-estimate-label">
                          <span className="grai-estimated-amount-prefix" aria-label="Burner">
                            <span className="grai-field-label-icon" aria-hidden="true">
                              <WalletIcon size={14} />
                            </span>
                            BURNER
                            <span className="grai-burn-estimate-sigma" aria-hidden="true">
                              Σ
                            </span>
                          </span>
                          <span className="grai-burn-estimate-value">
                            {burnAmount.trim() && (isBurnEstimateLoading || burnTotalUsdLabel !== '—') ? (
                              isBurnEstimateLoading ? (
                                <span className="grai-estimate-spinner" aria-label="Calculating burn value estimate" />
                              ) : (
                                `~${burnTotalUsdLabel}`
                              )
                            ) : (
                              <span className="grai-estimated-amount-hint">
                                est. sum burner receive
                              </span>
                            )}
                          </span>
                        </p>
                      ) : null}
                    </div>
                    <div className="grai-burn-assets-hint is-open" aria-label="Burn outputs estimate">
                      <div className="grai-burn-assets-section-title">
                        <span className="grai-burn-assets-section-title-icon" aria-hidden="true">
                          {ACTION_TX_ICON}
                        </span>
                        <span className="grai-burn-assets-section-title-label">TX PREVIEW</span>
                        <button
                          type="button"
                          className={`grai-donut-legend-toggle ${isBurnAssetsRowsHidden ? 'is-collapsed' : ''}`}
                          onClick={() => setIsBurnAssetsRowsHidden((hidden) => !hidden)}
                          aria-expanded={!isBurnAssetsRowsHidden}
                          aria-controls="grai-burn-assets-rows"
                          aria-label={
                            isBurnAssetsRowsHidden
                              ? 'Show senior vault shares breakdown'
                              : 'Hide senior vault shares breakdown'
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
                      {!isBurnAssetsRowsHidden && (
                      <div
                        id="grai-burn-assets-rows"
                        className={`grai-burn-assets-rows${mintAssets.length > 3 ? ' is-scrollable' : ''}`}
                      >
                        {mintAssets.map((asset) => {
                          const output = burnOutputByMint.get(asset.mint)
                          return (
                            <div className="grai-burn-assets-row" key={asset.mint}>
                              <span className="grai-burn-assets-amount">
                                <span className="grai-estimated-amount-prefix" aria-label="Burner">
                                  <span className="grai-field-label-icon" aria-hidden="true">
                                    <WalletIcon size={14} />
                                  </span>
                                  BURNER +
                                </span>
                                <span className={`grai-burn-assets-amount-value${!burnAmount.trim() ? ' is-placeholder' : ''}`}>
                                  <VaultBalanceTableValue
                                    amount={output?.amountLabel ?? '0'}
                                    usdRaw={output?.usdRaw ?? 0n}
                                    isLoading={Boolean(burnAmount.trim()) && isBurnEstimateLoading}
                                  />
                                </span>
                              </span>
                              <span className="grai-burn-assets-token">
                                <span className="grai-burn-assets-token-icon" aria-hidden="true">
                                  <img src={asset.icon.src} alt={asset.icon.alt} />
                                </span>
                                {asset.symbol}
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
                      )}
                    </div>
                    </div>
                    {(isBurning || burnError || (burnSignature && burnStatus === 'success')) && (
                    <div className="grai-burn-feedback-slot">
                      {isBurning ? (
                        <p className="grai-mint-feedback is-pending">Confirming transaction…</p>
                      ) : burnError ? (
                        <p className="grai-mint-feedback is-error">{burnError}</p>
                      ) : (
                        <p className="grai-mint-feedback is-success grai-burn-feedback-confirmed">
                          Burn confirmed:{' '}
                          <a
                            href={solscanTxUrl(burnSignature!)}
                            target="_blank"
                            rel="noreferrer"
                            title={burnSignature!}
                          >
                            {shortenMintAddress(burnSignature!)}
                          </a>
                        </p>
                      )}
                    </div>
                    )}
                    <button
                      type="button"
                      className="grai-burn-btn"
                      disabled={isBurning || !burnAmount.trim()}
                      onClick={() => {
                        void handleBurn()
                      }}
                    >
                      <span className="grai-action-tx-btn-icon" aria-hidden="true">
                        {ACTION_TX_ICON}
                      </span>
                      {isBurning ? 'BURNING…' : 'BURN'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </FloatingTokenBackground>
      <aside className="grai-assets-chart-card" id="grai-assets-section" aria-label="GRAI assets composition">
          <div className="grai-assets-split">
            <div className="grai-assets-composition-block">
            <div className="grai-donut-slot grai-donut-slot--supply" aria-label="GRAI total supply">
              <GraiNavDonut
                slices={supplyCompositionRows}
                totalNavLabel={totalSupplyLoading ? '…' : totalSupplyLabel}
                centerLabel="Total Supply"
                valueUnit="GRAI"
                isLoading={totalSupplyLoading || vaultBalancesLoading || mintAssetsLoading}
              />
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
            <div className="grai-donut-slot grai-donut-slot--allocated" aria-label="Allocated NAV">
              <GraiNavDonut
                slices={allocatedCompositionRows}
                totalNavLabel={totalAllocatedNavLabel}
                centerLabel="Allocated NAV"
                isLoading={vaultBalancesLoading || mintAssetsLoading}
              />
            </div>
            <div className="grai-vault-balance-shell">
            <div className="grai-vault-balance-table-scroll">
            <div
              className="grai-balance-table"
              id="grai-vault-balance-table"
              aria-label="Asset balances by vault"
            >
                <div className="grai-balance-table-row grai-balance-table-row--head">
                  <div className="grai-balance-table-cell grai-balance-table-cell--head grai-balance-table-cell--asset is-asset">
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
                <div
                  className={`grai-vault-balance-body-panel${isLegendTableHidden ? '' : ' is-open'}`}
                  aria-hidden={isLegendTableHidden}
                >
                  <div className="grai-vault-balance-body-panel-inner">
                    <div className="grai-vault-balance-body-grid">
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
                          <a
                            href={solscanTokenUrl(row.asset.mint)}
                            target="_blank"
                            rel="noreferrer"
                            className="grai-mint-asset-value-solscan grai-asset-cell-solscan"
                            aria-label={`View ${row.asset.symbol} on Solscan`}
                            title={`View ${row.asset.symbol} on Solscan`}
                          >
                            {MINT_ASSET_SOLSCAN_ICON}
                          </a>
                        </span>
                      </div>
                      <div className="grai-balance-table-cell grai-balance-table-value">
                        <VaultBalanceTableValue
                          amount={row.senior}
                          usdRaw={row.seniorUsdRaw}
                          isLoading={vaultBalancesLoading}
                        />
                      </div>
                      <div className="grai-balance-table-cell grai-balance-table-value">
                        <VaultBalanceTableValue
                          amount={row.junior}
                          usdRaw={row.juniorUsdRaw}
                          isLoading={vaultBalancesLoading}
                        />
                      </div>
                      <div className="grai-balance-table-cell grai-balance-table-value">
                        <VaultBalanceTableValue
                          amount={row.allocated}
                          usdRaw={row.allocatedUsdRaw}
                          isLoading={vaultBalancesLoading}
                        />
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
                className={`grai-donut-legend-toggle grai-vault-balance-show-toggle ${isLegendTableHidden ? 'is-collapsed' : ''}`}
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
            </div>
            </div>
            </div>
            <GraiManageSection />
          </div>
        </aside>
      <ChainSelectorModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
      />
    </div>
  )
}

export default GraiPage
