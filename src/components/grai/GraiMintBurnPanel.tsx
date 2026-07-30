import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { toast } from 'react-toastify'
import { formatVaultBalanceDisplay } from '../../grai/formatVaultBalance'
import { useGraiDeployment } from '../../grai/GraiDeploymentProvider'
import { GRAI_DECIMALS_EVM } from '../../grai/evm/constants'
import { formatClaimUsdTotal } from '../../grai/evm/estimateClaim'
import { parseTokenAmount } from '../../grai/onchain'
import { USD_SCALE } from '../../grai/tokenomics'
import {
  formatProjectedYieldPct,
  formatVolatilityPct,
  lookupGraiAssetYieldMetrics,
  type GraiAssetYieldMetrics,
} from '../../grai/assetYieldMetrics'
import { useGraiAssets } from '../../hooks/useGraiAssets'
import { FALLBACK_GRAI_ASSETS } from '../../grai/knownMints'
import type { GraiAssetVaultBalances } from '../../grai/fetchVaultBalances'
import {
  fetchEvmGraiRedeemables,
  fetchEvmRedeemUnlockTiming,
} from '../../grai/evm/readProtocol'
import { useDocumentChartTheme } from '../../chart/useDocumentChartTheme'
import { buildVaultCompositionRows, getAssetChartColors } from '../../grai/vaultComposition'
import { useGraiBurn } from '../../hooks/useGraiBurn'
import { useGraiLock } from '../../hooks/useGraiLock'
import { useGraiMint } from '../../hooks/useGraiMint'
import { useGraiBurnEstimate } from '../../hooks/useGraiBurnEstimate'
import { useGraiMintEstimate } from '../../hooks/useGraiMintEstimate'
import { useGraiUnlockEstimate } from '../../hooks/useGraiUnlockEstimate'
import { useGraiClaimEstimate } from '../../hooks/useGraiClaimEstimate'
import { useWalletAssetBalance } from '../../hooks/useWalletAssetBalance'
import { useActiveWallet } from '../../hooks/useActiveWallet'
import { useWalletContext } from '../../providers/AppWalletProvider'
import { assetUrl } from '../../utils/appPaths'
import { readGraiSectionFromHash, type GraiSection } from '../../utils/graiNavigation'
import { GraiAmountInput, type GraiAmountAsset } from './GraiAmountInput'
import { GraiMintSubtitleRotatingAsset } from './GraiMintSubtitleRotatingAsset'
import { GraiNavDonut } from '../GraiNavDonut'
import { GraiTransactionToast } from './GraiTransactionToast'
import { GraiActionConnectWalletButton } from './GraiWalletAction'
import { GraiFieldInfoButton } from './GraiFieldInfo'
import { GraiUiCaret } from './GraiUiCaret'

type ActionView = 'mint' | 'burn'

type Props = {
  actionView: ActionView
  actionSubtitle: ReactNode
  onOpenHowItWorks: () => void
}

const REDEEM_BLOCKED_HINT =
  'Redeem is only available after a liquidation opens. Until then, reserves cannot be redeemed.'

function formatRedeemCountdown(secondsLeft: number): string {
  if (secondsLeft <= 0) return 'Ready'
  const d = Math.floor(secondsLeft / 86_400)
  const h = Math.floor((secondsLeft % 86_400) / 3600)
  const m = Math.floor((secondsLeft % 3600) / 60)
  const s = secondsLeft % 60
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`
  return `${s}s`
}

const MOCK_REDEEMABLE_SPECS: Array<{
  mint: string
  decimals: number
  seniorRaw: bigint
  usdDollars: number
}> = [
  { mint: FALLBACK_GRAI_ASSETS[0]!.mint, decimals: 6, seniorRaw: 42_500_000_000n, usdDollars: 42_500 },
  { mint: FALLBACK_GRAI_ASSETS[1]!.mint, decimals: 9, seniorRaw: 200_000_000_000n, usdDollars: 28_400 },
  { mint: FALLBACK_GRAI_ASSETS[2]!.mint, decimals: 6, seniorRaw: 18_200_000_000n, usdDollars: 18_200 },
  { mint: FALLBACK_GRAI_ASSETS[3]!.mint, decimals: 18, seniorRaw: 12_000_000_000_000_000_000n, usdDollars: 31_500 },
  { mint: FALLBACK_GRAI_ASSETS[4]!.mint, decimals: 8, seniorRaw: 72_000_000n, usdDollars: 48_000 },
  { mint: FALLBACK_GRAI_ASSETS[5]!.mint, decimals: 18, seniorRaw: 12_000_000_000_000_000_000_000n, usdDollars: 4_200 },
  { mint: FALLBACK_GRAI_ASSETS[6]!.mint, decimals: 18, seniorRaw: 5_500_000_000_000_000_000_000n, usdDollars: 2_100 },
]

function usdRawFromDollars(dollars: number, usdScale: number): bigint {
  return (BigInt(Math.round(dollars * 100)) * 10n ** BigInt(usdScale)) / 100n
}

function buildMockRedeemableVaultBalances(usdScale: number): Record<string, GraiAssetVaultBalances> {
  return Object.fromEntries(
    MOCK_REDEEMABLE_SPECS.map((spec) => {
      const seniorUsdRaw = usdRawFromDollars(spec.usdDollars, usdScale)
      return [
        spec.mint,
        {
          seniorRaw: spec.seniorRaw,
          juniorRaw: 0n,
          allocatedRaw: 0n,
          decimals: spec.decimals,
          navUsdRaw: seniorUsdRaw,
          seniorUsdRaw,
          juniorUsdRaw: 0n,
          allocatedUsdRaw: 0n,
        } satisfies GraiAssetVaultBalances,
      ]
    }),
  )
}

function buildGrindersShareHint(assetSymbol?: string): ReactNode {
  const title = assetSymbol ? `Share of ${assetSymbol} amount` : 'Share of asset amount'

  return (
    <>
      <span className="grai-field-info-tooltip-title">{title}</span>
      <span className="grai-field-info-tooltip-section">
        Portion of your deposit allocated to Grinders for price-volatility yield strategies.
      </span>
    </>
  )
}

function buildGrindersCashflowHint(): ReactNode {
  return (
    <>
      <span className="grai-field-info-tooltip-title">Future Grinders cashflow</span>
      <span className="grai-field-info-tooltip-section">
        Your claim on future yield harvested by Grinders from price-volatility strategies.
      </span>
    </>
  )
}

function formatUnlockFeeWindow(unlockPenaltyPeriodSec: number): string {
  const duration = unlockPenaltyPeriodSec > 0 ? unlockPenaltyPeriodSec : 24 * 3600
  const hours = Math.max(1, Math.round(duration / 3600))
  if (hours === 24) return '24 hours'
  if (hours % 24 === 0) {
    const days = hours / 24
    return days === 1 ? '24 hours' : `${days} days`
  }
  return `${hours} hours`
}

function buildUnlockPenaltyHint(unlockPenaltyPeriodSec: number): ReactNode {
  const windowLabel = formatUnlockFeeWindow(unlockPenaltyPeriodSec)
  return (
    <>
      <span className="grai-field-info-tooltip-title">Unlock penalty</span>
      <span className="grai-field-info-tooltip-section">
        <span className="grai-field-info-tooltip-section-label">Early unlock</span>
        A decaying fee applies from the moment you lock. It starts at the configured max and falls
        linearly to zero.
      </span>
      <span className="grai-field-info-tooltip-section">
        <span className="grai-field-info-tooltip-section-label">No penalty</span>
        After {windowLabel} from lock time you can unlock the full amount with no penalty.
      </span>
      <span className="grai-field-info-tooltip-section">
        <span className="grai-field-info-tooltip-section-label">Where it goes</span>
        The penalty stays in GRAI and is credited to liquidation voters via the buyback reward
        index.
      </span>
    </>
  )
}

function buildProjectedAnnualYieldHint(
  symbol?: string,
  metrics?: GraiAssetYieldMetrics | null,
): ReactNode {
  const volatilityLabel = metrics ? formatVolatilityPct(metrics.volatilityPct) : '—'
  const yieldLabel = metrics ? formatProjectedYieldPct(metrics.projectedAnnualYieldPct) : '—'

  return (
    <>
      <span className="grai-field-info-tooltip-title">Expected APR</span>
      <span className="grai-field-info-tooltip-section">
        <span className="grai-field-info-tooltip-section-label">How we estimate</span>
        Grinder backtests on historical prices, actual state with ML-adjusted forecast. Higher
        volatility usually means more swing-trading opportunity.
      </span>
      <span className="grai-field-info-tooltip-section">
        <span className="grai-field-info-tooltip-section-label">
          {symbol ? `For ${symbol}` : 'For selected asset'}
        </span>
        <span className="grai-field-info-tooltip-flow">
          <span className="grai-field-info-tooltip-flow-item">
            <span className="grai-field-info-tooltip-flow-label">Price Volatility</span>
            <span className="grai-field-info-tooltip-flow-value">{volatilityLabel}</span>
          </span>
          <span className="grai-field-info-tooltip-flow-arrow">
            <svg viewBox="0 0 120 8" preserveAspectRatio="none" fill="none">
              <path
                d="M1 4 H106"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                strokeLinecap="round"
              />
              <path
                d="M106 1.5 L114 4 L106 6.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="grai-field-info-tooltip-flow-item">
            <span className="grai-field-info-tooltip-flow-label">Expected APR</span>
            <span className="grai-field-info-tooltip-flow-value is-yield">{yieldLabel}</span>
          </span>
        </span>
      </span>
      <p className="grai-field-info-tooltip-note">
        Indicative only — not guaranteed. Actual returns can be higher or lower.
      </p>
    </>
  )
}

function GraiDetailedPreviewVaultLabel({
  label,
  hint,
  ariaLabel,
}: {
  label: ReactNode
  hint: ReactNode
  ariaLabel?: string
}) {
  return (
    <span className="grai-detailed-preview-label-wrap">
      <GraiFieldInfoButton
        hint={hint}
        ariaLabel={ariaLabel ?? (typeof label === 'string' ? `${label} information` : 'More information')}
        structured
      />
      <span className="grai-detailed-preview-label">{label}</span>
    </span>
  )
}

function GraiActionResultLabel({
  isPreviewOpen,
  onTogglePreview,
  showToggle = true,
  children,
}: {
  isPreviewOpen: boolean
  onTogglePreview: () => void
  showToggle?: boolean
  children: ReactNode
}) {
  return (
    <span
      className={`grai-action-result-label-wrap${showToggle ? '' : ' is-toggle-hidden'}`}
    >
      <span className="grai-action-result-preview-toggle-slot" aria-hidden={!showToggle}>
        <button
          type="button"
          className="grai-action-result-preview-toggle"
          aria-expanded={isPreviewOpen}
          aria-label={isPreviewOpen ? 'Hide detailed preview' : 'Show detailed preview'}
          tabIndex={showToggle ? 0 : -1}
          disabled={!showToggle}
          onClick={onTogglePreview}
        >
          <GraiUiCaret className="grai-detailed-preview-chevron" />
        </button>
      </span>
      <span className="grai-action-result-label">{children}</span>
    </span>
  )
}

export function GraiMintBurnPanel({
  actionView,
  actionSubtitle,
  onOpenHowItWorks,
}: Props) {
  const { openChainSelector } = useWalletContext()
  const { chainKind, solana, staticSolana, evm, explorerTxUrl } = useGraiDeployment()
  const activeWallet = useActiveWallet()
  const isWalletConnected = activeWallet.isConnected
  const { assets: graiAssets } = useGraiAssets()
  const chartTheme = useDocumentChartTheme()
  const { mint: mintGrai, isMinting } = useGraiMint()
  const { burn: burnGrai, isBurning } = useGraiBurn()
  const { lock: lockGrai, unlock: unlockGrai, claim: claimGrai, claimAll: claimAllGrai, isPending: isLockPending } =
    useGraiLock()

  const [amount, setAmount] = useState('')
  const [selectedAsset, setSelectedAsset] = useState<GraiAmountAsset | null>(null)
  const [earnDividends, setEarnDividends] = useState(true)
  const [claimAllDividends, setClaimAllDividends] = useState(false)
  const [assetFlowView, setAssetFlowView] = useState<'deposit' | 'claim'>(() => {
    const section = readGraiSectionFromHash()
    return section === 'unlock' || section === 'claim' ? 'claim' : 'deposit'
  })
  const [forcedDefaultAsset, setForcedDefaultAsset] = useState<string | null>(() => {
    const section = readGraiSectionFromHash()
    return section === 'lock' || section === 'unlock' ? 'GRAI' : null
  })
  const [assetSelectKey, setAssetSelectKey] = useState(0)
  const [previewOpenByAction, setPreviewOpenByAction] = useState<Record<ActionView, boolean>>({
    mint: false,
    burn: false,
  })
  const [liquidationOpen, setLiquidationOpen] = useState(false)
  const [redeemUnlockAtSec, setRedeemUnlockAtSec] = useState<number | null>(null)
  const [redeemCountdownNowSec, setRedeemCountdownNowSec] = useState(() =>
    Math.floor(Date.now() / 1000),
  )

  useEffect(() => {
    const focusGraiEscrow = (view: 'lock' | 'unlock') => {
      setForcedDefaultAsset('GRAI')
      setAssetFlowView(view === 'unlock' ? 'claim' : 'deposit')
      setAmount('')
      setAssetSelectKey((key) => key + 1)
    }

    const onSectionNav = (event: Event) => {
      const section = (event as CustomEvent<GraiSection>).detail
      if (section === 'lock') {
        focusGraiEscrow('lock')
        return
      }
      if (section === 'unlock') {
        focusGraiEscrow('unlock')
        return
      }
      if (section === 'mint') {
        setForcedDefaultAsset(null)
        setAssetFlowView('deposit')
        setAmount('')
        setAssetSelectKey((key) => key + 1)
        return
      }
      if (section === 'claim') {
        setForcedDefaultAsset(null)
        setAssetFlowView('claim')
        setEarnDividends(false)
        setAmount('')
        setAssetSelectKey((key) => key + 1)
      }
    }

    window.addEventListener('grai-section-nav', onSectionNav)
    return () => window.removeEventListener('grai-section-nav', onSectionNav)
  }, [])
  const isPreviewOpen = previewOpenByAction[actionView]
  const togglePreview = () => {
    setPreviewOpenByAction((current) => ({
      ...current,
      [actionView]: !current[actionView],
    }))
  }

  const graiMintAddress =
    chainKind === 'evm' && evm
      ? (evm.graiToken ?? evm.protocolAddress ?? '')
      : solana?.graiMint.toBase58() ?? staticSolana?.graiMint.toBase58() ?? ''

  const mintAssetOptions = useMemo<GraiAmountAsset[]>(() => {
    const graiOption: GraiAmountAsset = {
      icon: assetUrl('logo.png'),
      symbol: 'GRAI',
      address: graiMintAddress,
    }
    const listed = graiAssets
      .filter((asset) => asset.symbol.toUpperCase() !== 'GRAI')
      .map((asset) => ({
        icon: asset.icon.src,
        symbol: asset.symbol,
        address: asset.mint,
      }))
    const listedSymbols = new Set(listed.map((asset) => asset.symbol.toUpperCase()))
    const mockExtras = FALLBACK_GRAI_ASSETS.filter((asset) =>
      ['USDC', 'SOL'].includes(asset.symbol.toUpperCase()),
    )
      .filter((asset) => !listedSymbols.has(asset.symbol.toUpperCase()))
      .map((asset) => ({
        icon: asset.icon.src,
        symbol: asset.symbol,
        address: asset.mint,
      }))
    return [graiOption, ...listed, ...mockExtras]
  }, [graiAssets, graiMintAddress])
  const redeemAssetOptions = useMemo<GraiAmountAsset[]>(
    () => [{ icon: assetUrl('logo.png'), symbol: 'GRAI', address: graiMintAddress }],
    [graiMintAddress],
  )
  const mintDefaultAsset =
    mintAssetOptions.find((asset) => asset.symbol.toUpperCase() !== 'GRAI')?.symbol ?? 'GRAI'

  const {
    balanceLabel: walletBalanceLabel,
    maxAmount: walletMaxAmount,
    decimals,
    refresh: refreshWalletBalance,
  } = useWalletAssetBalance(selectedAsset?.address || undefined, selectedAsset?.symbol)

  const isGraiSelected = selectedAsset?.symbol.toUpperCase() === 'GRAI'
  const isGraiUnlock = isGraiSelected && assetFlowView === 'claim'
  const isGraiLock = isGraiSelected && assetFlowView === 'deposit'
  const isAssetClaim = actionView === 'mint' && !isGraiSelected && assetFlowView === 'claim'
  const lockedGraiLabel = amount.trim() || '0.0'
  const {
    claims: unlockClaims,
    usdLabel: unlockDividendsUsdLabel,
    lockedLabel,
    lockedMaxAmount,
    unlockAmountLabel,
    penaltyLabel,
    penaltyDurationLabel,
    unlockPreview,
    refresh: refreshUnlockEstimate,
  } = useGraiUnlockEstimate(
    actionView === 'mint' && (isGraiUnlock || (isAssetClaim && claimAllDividends)),
    amount,
  )

  const {
    claim: assetClaim,
    claimableLabel,
    claimableMaxAmount,
    usdLabel: claimUsdLabel,
    refresh: refreshClaimEstimate,
  } = useGraiClaimEstimate(isAssetClaim, selectedAsset?.address)

  useEffect(() => {
    if (!claimAllDividends && isPreviewOpen && isAssetClaim) {
      setPreviewOpenByAction((current) => ({ ...current, mint: false }))
    }
  }, [claimAllDividends, isAssetClaim, isPreviewOpen])

  const balanceLabel = isGraiUnlock
    ? `${lockedLabel} GRAI`
    : isAssetClaim
      ? `${claimableLabel}${selectedAsset?.symbol ? ` ${selectedAsset.symbol}` : ''}`
      : walletBalanceLabel
  const maxAmount = isGraiUnlock ? lockedMaxAmount : isAssetClaim ? claimableMaxAmount : walletMaxAmount

  const {
    estimatedGrai,
    seniorShareLabel,
    seniorShareUsdRaw,
    juniorShareUsdRaw,
    isLoading: isEstimateLoading,
  } = useGraiMintEstimate(
    actionView === 'mint' && assetFlowView === 'deposit' ? selectedAsset?.address : undefined,
    amount,
    decimals,
  )

  const { burnOutputs, isLoading: isBurnEstimateLoading } = useGraiBurnEstimate(
    amount,
    actionView === 'burn',
  )

  const usdScale = chainKind === 'evm' ? GRAI_DECIMALS_EVM : USD_SCALE
  const mockRedeemableBalances = useMemo(
    () => buildMockRedeemableVaultBalances(usdScale),
    [usdScale],
  )

  useEffect(() => {
    if (actionView !== 'burn') {
      setLiquidationOpen(false)
      setRedeemUnlockAtSec(null)
      return
    }

    if (chainKind !== 'evm' || !evm) {
      setLiquidationOpen(false)
      setRedeemUnlockAtSec(null)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const timing = await fetchEvmRedeemUnlockTiming(evm)
        if (cancelled) return
        setLiquidationOpen(timing.liquidationOpen)
        setRedeemUnlockAtSec(timing.redeemUnlockAt)
      } catch {
        if (cancelled) return
        setLiquidationOpen(false)
        setRedeemUnlockAtSec(null)
      }

      try {
        await fetchEvmGraiRedeemables(evm)
      } catch {
        if (cancelled) return
        setLiquidationOpen(false)
        setRedeemUnlockAtSec(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [actionView, chainKind, evm])

  useEffect(() => {
    if (actionView !== 'burn' || !liquidationOpen || redeemUnlockAtSec == null) return
    setRedeemCountdownNowSec(Math.floor(Date.now() / 1000))
    const id = window.setInterval(() => {
      setRedeemCountdownNowSec(Math.floor(Date.now() / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [actionView, liquidationOpen, redeemUnlockAtSec])

  const redeemCountdownLabel = useMemo(() => {
    if (!liquidationOpen || redeemUnlockAtSec == null) return null
    return formatRedeemCountdown(redeemUnlockAtSec - redeemCountdownNowSec)
  }, [liquidationOpen, redeemCountdownNowSec, redeemUnlockAtSec])

  const displayRedeemableBalances = mockRedeemableBalances

  const redeemableBalanceRows = useMemo(() => {
    const chartColors = getAssetChartColors(chartTheme)
    return buildVaultCompositionRows(
      FALLBACK_GRAI_ASSETS,
      displayRedeemableBalances,
      'seniorUsdRaw',
      chartColors,
    )
  }, [chartTheme, displayRedeemableBalances])

  const redeemableTotalUsdLabel = useMemo(() => {
    const totalUsd = redeemableBalanceRows.reduce((sum, row) => sum + row.seniorUsdRaw, 0n)
    if (totalUsd <= 0n) return '0.00'
    return formatVaultBalanceDisplay(totalUsd, usdScale, 2)
  }, [redeemableBalanceRows, usdScale])

  const redeemableDonutSlices = useMemo(
    () =>
      redeemableBalanceRows.map((row) => ({
        asset: row.asset,
        color: row.color,
        // Forbidden: zero pct → GraiNavDonut renders equal shares across assets.
        pct: liquidationOpen ? row.pct : 0,
        navUsdRaw: liquidationOpen ? row.navUsdRaw : 0n,
      })),
    [liquidationOpen, redeemableBalanceRows],
  )

  useEffect(() => {
    setAmount('')
  }, [actionView])

  const wasGraiSelectedRef = useRef(isGraiSelected)
  useEffect(() => {
    if (isGraiSelected !== wasGraiSelectedRef.current) {
      setAmount('')
    }
    wasGraiSelectedRef.current = isGraiSelected
  }, [isGraiSelected])

  const mintUsdLabel = useMemo(() => {
    if (isAssetClaim) {
      if (!amount.trim() || assetClaim.amountRaw <= 0n || assetClaim.usdRaw <= 0n) return '$0.00'
      try {
        const amountRaw = parseTokenAmount(amount, assetClaim.decimals)
        if (amountRaw <= 0n) return '$0.00'
        const usdRaw =
          amountRaw >= assetClaim.amountRaw
            ? assetClaim.usdRaw
            : (assetClaim.usdRaw * amountRaw) / assetClaim.amountRaw
        return formatClaimUsdTotal(usdRaw)
      } catch {
        return claimUsdLabel
      }
    }
    if (!amount.trim()) return '$0.00'
    if (isEstimateLoading) return '…'
    const totalUsd = seniorShareUsdRaw + juniorShareUsdRaw
    if (totalUsd <= 0n) return '$0.00'
    return `$${formatVaultBalanceDisplay(totalUsd, usdScale, 2)}`
  }, [
    amount,
    assetClaim.amountRaw,
    assetClaim.decimals,
    assetClaim.usdRaw,
    claimUsdLabel,
    isAssetClaim,
    isEstimateLoading,
    juniorShareUsdRaw,
    seniorShareUsdRaw,
    usdScale,
  ])

  const redeemUsdLabel = useMemo(() => {
    if (!amount.trim()) return '$0.00'
    if (isBurnEstimateLoading) return '…'
    const totalUsd = burnOutputs.reduce((sum, output) => sum + output.usdRaw, 0n)
    if (totalUsd <= 0n) return '$0.00'
    return `$${formatVaultBalanceDisplay(totalUsd, usdScale, 2)}`
  }, [amount, burnOutputs, isBurnEstimateLoading, usdScale])

  const mintedGraiLabel = !amount.trim()
    ? '0.0'
    : isEstimateLoading
      ? '…'
      : estimatedGrai ?? '0.0'

  const assetYieldMetrics = useMemo(
    () => lookupGraiAssetYieldMetrics(selectedAsset?.symbol),
    [selectedAsset?.symbol],
  )

  const projectedAnnualYieldHint = useMemo(
    () => buildProjectedAnnualYieldHint(selectedAsset?.symbol, assetYieldMetrics),
    [selectedAsset?.symbol, assetYieldMetrics],
  )

  const isPending = actionView === 'mint' ? isMinting || isLockPending : isBurning

  const unlockAmountIsEmptyOrZero = useMemo(() => {
    const trimmed = amount.trim()
    if (!trimmed) return true
    const normalized = trimmed.replace(/,/g, '')
    const asNumber = Number(normalized)
    return Number.isFinite(asNumber) && asNumber === 0
  }, [amount])

  const isClaimAllAssetDividends = isAssetClaim && claimAllDividends

  const handleSubmit = useCallback(async () => {
    const isMint = actionView === 'mint'
    const isGraiEscrow = isMint && selectedAsset?.symbol.toUpperCase() === 'GRAI'
    const escrowAction = isGraiEscrow ? (assetFlowView === 'claim' ? 'unlock' : 'lock') : null
    const isClaimAsset = isMint && !isGraiEscrow && assetFlowView === 'claim'
    const toastId = toast.loading(
      isMint
        ? escrowAction === 'unlock'
          ? 'Unlocking GRAI…'
          : escrowAction === 'lock'
            ? 'Locking GRAI…'
            : isClaimAsset
              ? claimAllDividends
                ? 'Claiming all dividends…'
                : 'Claiming dividends…'
              : 'Depositing GRAI…'
        : 'Redeeming GRAI…',
    )
    try {
      const graiDecimals = decimals ?? GRAI_DECIMALS_EVM
      const signature = isMint
        ? escrowAction === 'unlock'
          ? await unlockGrai({
              amountInput: amount,
              graiDecimals,
            })
          : escrowAction === 'lock'
            ? await lockGrai({ amountInput: amount, graiDecimals })
            : isClaimAsset
              ? claimAllDividends
                ? await claimAllGrai()
                : await claimGrai({
                    assetAddress: selectedAsset?.address ?? '',
                    amountInput: amount,
                    assetDecimals: decimals ?? assetClaim.decimals ?? 6,
                  })
              : await mintGrai({
                  assetMint: selectedAsset?.address ?? '',
                  amountInput: amount,
                  assetDecimals: decimals ?? undefined,
                })
        : await burnGrai({ amountInput: amount, graiDecimals: decimals ?? undefined })
      toast.update(toastId, {
        render: (
          <GraiTransactionToast
            message={
              isMint
                ? escrowAction === 'unlock'
                  ? 'Unlock successful'
                  : escrowAction === 'lock'
                    ? 'Lock successful'
                    : isClaimAsset
                      ? claimAllDividends
                        ? 'Claim all successful'
                        : 'Claim successful'
                      : 'Deposit successful'
                : 'Redeem successful'
            }
            explorerHref={signature ? explorerTxUrl(signature) : null}
          />
        ),
        type: 'success',
        isLoading: false,
        autoClose: 8000,
        closeOnClick: true,
      })
      setAmount('')
      void refreshWalletBalance()
      refreshUnlockEstimate()
      refreshClaimEstimate()
    } catch (error) {
      toast.update(toastId, {
        render: error instanceof Error ? error.message : 'Transaction failed',
        type: 'error',
        isLoading: false,
        autoClose: 8000,
        closeOnClick: true,
      })
    }
  }, [
    actionView,
    amount,
    assetClaim.decimals,
    assetFlowView,
    burnGrai,
    claimAllGrai,
    claimAllDividends,
    claimGrai,
    decimals,
    explorerTxUrl,
    lockGrai,
    mintGrai,
    refreshClaimEstimate,
    refreshUnlockEstimate,
    refreshWalletBalance,
    selectedAsset?.address,
    selectedAsset?.symbol,
    unlockGrai,
  ])

  const actionContentRef = useRef<HTMLDivElement>(null)
  const actionContentHeightRef = useRef<number | null>(null)
  const [actionContentHeight, setActionContentHeight] = useState<number | null>(null)
  const [isActionContentAnimating, setIsActionContentAnimating] = useState(false)

  useLayoutEffect(() => {
    const el = actionContentRef.current
    if (!el) return

    const applyHeight = (next: number) => {
      const rounded = Math.round(next)
      if (rounded <= 0) return
      if (
        actionContentHeightRef.current !== null &&
        Math.abs(actionContentHeightRef.current - rounded) < 1
      ) {
        return
      }
      if (
        actionContentHeightRef.current !== null &&
        Math.abs(actionContentHeightRef.current - rounded) >= 1
      ) {
        setIsActionContentAnimating(true)
      }
      actionContentHeightRef.current = rounded
      setActionContentHeight(rounded)
    }

    applyHeight(el.getBoundingClientRect().height)

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      // Use border-box height so padding/borders stay in sync with the shell.
      applyHeight(el.getBoundingClientRect().height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="grai-actions-row grai-actions-row-mint">
      <div className="grai-action-card grai-mint">
        <div
          className={`grai-action-content-shell${isActionContentAnimating ? ' is-animating' : ''}`}
          style={
            actionContentHeight != null
              ? ({ height: `${actionContentHeight}px` } as CSSProperties)
              : undefined
          }
          onTransitionEnd={(event) => {
            if (event.propertyName !== 'height') return
            if (event.target !== event.currentTarget) return
            setIsActionContentAnimating(false)
          }}
        >
          <div className="grai-action-content" ref={actionContentRef}>
          {actionView === 'burn' ? (
            <div
              className="grai-redeemable-balances"
              role="region"
              aria-label="Redeemable GRAI reserves"
            >
              <div className="grai-redeemable-balances-head">
                <span className="grai-redeemable-balances-title">Redeemable reserves</span>
                {liquidationOpen && redeemCountdownLabel ? (
                  <span
                    className={`grai-redeemable-balances-countdown${
                      redeemCountdownLabel === 'Ready' ? ' is-ready' : ''
                    }`}
                    aria-live="polite"
                    title="Time until redeem is allowed"
                  >
                    {redeemCountdownLabel}
                  </span>
                ) : (
                  <span className="grai-redeemable-balances-blocked" aria-live="polite">
                    <span className="grai-redeemable-balances-countdown is-blocked">
                      Redeem forbidden
                    </span>
                    <GraiFieldInfoButton
                      hint={REDEEM_BLOCKED_HINT}
                      ariaLabel="Why redeem is forbidden"
                      className="grai-redeemable-balances-blocked-info"
                    />
                  </span>
                )}
                <button
                  type="button"
                  className="header-nav-link header-nav-info grai-page-how-it-works-hint grai-redeemable-balances-hint"
                  onClick={onOpenHowItWorks}
                  aria-haspopup="dialog"
                >
                  <Info className="header-nav-info-icon" aria-hidden="true" />
                  How it works?
                </button>
              </div>
              <div className="grai-redeemable-balances-body">
                <div className="grai-redeemable-balances-donut grai-donut-slot">
                  <GraiNavDonut
                    slices={redeemableDonutSlices}
                    totalNavLabel={liquidationOpen ? redeemableTotalUsdLabel : '—'}
                    centerLabel="Total"
                    valueUnit="USD"
                    isLoading={false}
                    showSliceIcons
                  />
                </div>
                <ul className="grai-redeemable-balances-list">
                  {redeemableBalanceRows.length === 0 ? (
                    <li className="grai-redeemable-balances-empty">No reserves</li>
                  ) : (
                    redeemableBalanceRows.map((row) => (
                      <li key={row.asset.mint} className="grai-redeemable-balances-item">
                        <span
                          className="grai-redeemable-balances-swatch"
                          style={{ background: row.color }}
                          aria-hidden="true"
                        />
                        <span className="grai-redeemable-balances-amount">
                          {liquidationOpen ? row.senior : '—'}
                        </span>
                        <img
                          className="grai-redeemable-balances-icon"
                          src={row.asset.icon.src}
                          alt=""
                          width={16}
                          height={16}
                          loading="lazy"
                          decoding="async"
                        />
                        <span className="grai-redeemable-balances-symbol">{row.asset.symbol}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          ) : (
          <div className="grai-page-subtitle-wrap">
            <button
              type="button"
              className="header-nav-link header-nav-info grai-page-how-it-works-hint"
              onClick={onOpenHowItWorks}
              aria-haspopup="dialog"
            >
              <Info className="header-nav-info-icon" aria-hidden="true" />
              How it works?
            </button>
            <div className="grai-page-subtitle-head">
              <button
                type="button"
                className="grai-page-subtitle is-fit-width is-clickable"
                onClick={onOpenHowItWorks}
                aria-haspopup="dialog"
              >
                  <span
                    className={`grai-page-subtitle-mode-swap is-${
                      isGraiLock ? 'lock' : isGraiUnlock ? 'unlock' : isAssetClaim ? 'claim' : 'deposit'
                    }`}
                  >
                    <span
                      className="grai-page-subtitle-mode-swap-item is-deposit"
                      aria-hidden={isGraiLock || isGraiUnlock || isAssetClaim}
                    >
                      {actionSubtitle}
                    </span>
                    {selectedAsset ? (
                      <>
                        <span
                          className="grai-page-subtitle-mode-swap-item is-lock"
                          aria-hidden={!isGraiLock}
                        >
                          <span className="grai-page-subtitle-text-line">
                            <span className="grai-page-subtitle-text-segment">Lock</span>
                            <span className="grai-page-subtitle-rotating-slot">
                              <span className="grai-page-subtitle-rotating-word-current">
                                <span className="grai-page-subtitle-rotating-word-icon" aria-hidden="true">
                                  <img
                                    src={selectedAsset.icon}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                  />
                                </span>
                                <span className="grai-page-subtitle-rotating-word-label">GRAI</span>
                              </span>
                            </span>
                            <span className="grai-page-subtitle-text-segment">
                              for Price Volatility Yields
                            </span>
                          </span>
                        </span>
                        <span
                          className="grai-page-subtitle-mode-swap-item is-unlock"
                          aria-hidden={!isGraiUnlock}
                        >
                          <span className="grai-page-subtitle-text-line">
                            <span className="grai-page-subtitle-text-segment">Unlock</span>
                            <span className="grai-page-subtitle-rotating-slot">
                              <span className="grai-page-subtitle-rotating-word-current">
                                <span className="grai-page-subtitle-rotating-word-icon" aria-hidden="true">
                                  <img
                                    src={selectedAsset.icon}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                  />
                                </span>
                                <span className="grai-page-subtitle-rotating-word-label">GRAI</span>
                              </span>
                            </span>
                            <span className="grai-page-subtitle-text-segment">
                              from Escrow
                            </span>
                          </span>
                        </span>
                        <span
                          className="grai-page-subtitle-mode-swap-item is-claim"
                          aria-hidden={!isAssetClaim}
                        >
                          <span className="grai-page-subtitle-text-line">
                            <span className="grai-page-subtitle-text-segment">Claim</span>
                            <GraiMintSubtitleRotatingAsset />
                            <span className="grai-page-subtitle-text-segment">
                              Price Volatility Yield
                            </span>
                          </span>
                        </span>
                      </>
                    ) : null}
                  </span>
                <GraiUiCaret className="grai-page-subtitle-caret" />
              </button>
            </div>
          </div>
          )}
          {actionView === 'mint' ? (
            <div
              className={`grai-action-switch grai-action-switch--buttons grai-action-switch--asset-flow grai-action-switch--escrow-below is-${assetFlowView}-active`}
              role="tablist"
              aria-label={isGraiSelected ? 'Lock or Unlock GRAI' : 'Deposit or Claim'}
            >
              <button
                type="button"
                role="tab"
                aria-selected={assetFlowView === 'deposit'}
                className={`grai-action-switch-btn is-deposit${
                  assetFlowView === 'deposit' ? ' is-active' : ''
                }`}
                onClick={() => {
                  if (assetFlowView === 'deposit') return
                  setAssetFlowView('deposit')
                  setAmount('')
                }}
              >
                {isGraiSelected ? 'Lock' : 'Deposit'}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={assetFlowView === 'claim'}
                className={`grai-action-switch-btn is-claim${
                  assetFlowView === 'claim' ? ' is-active' : ''
                }`}
                onClick={() => {
                  if (assetFlowView === 'claim') return
                  setAssetFlowView('claim')
                  setAmount('')
                  setEarnDividends(false)
                  if (isPreviewOpen) {
                    setPreviewOpenByAction((current) => ({ ...current, mint: false }))
                  }
                }}
              >
                {isGraiSelected ? 'Unlock' : 'Claim'}
              </button>
            </div>
          ) : null}
          <GraiAmountInput
            key={`${actionView}-${assetSelectKey}`}
            label={
              actionView === 'mint'
                ? isAssetClaim
                  ? 'Claim Amount'
                  : isGraiLock
                    ? 'Lock Amount'
                    : isGraiUnlock
                      ? 'Unlock Amount'
                      : 'Deposit Amount'
                : 'Amount'
            }
            assets={actionView === 'mint' ? mintAssetOptions : redeemAssetOptions}
            defaultAsset={
              actionView === 'mint' ? (forcedDefaultAsset ?? mintDefaultAsset) : 'GRAI'
            }
            value={amount}
            onValueChange={setAmount}
            onAssetChange={setSelectedAsset}
            balanceLabel={isWalletConnected ? balanceLabel : '—'}
            balancePrefix={
              isGraiUnlock
                ? 'Your escrow balance:'
                : isGraiSelected
                  ? 'Your balance:'
                  : 'Available:'
            }
            maxAmount={maxAmount}
            decimals={decimals ?? (isAssetClaim ? assetClaim.decimals : null)}
            usdLabel={actionView === 'mint' ? mintUsdLabel : redeemUsdLabel}
            showVolatility={!isAssetClaim}
            disabled={isClaimAllAssetDividends}
          />
          {isAssetClaim ? (
            <div
              className={`grai-mint-dividends-toggle is-yes-no is-below-amount${
                claimAllDividends ? ' is-active' : ''
              }`}
            >
              <span className="grai-mint-dividends-toggle-label">
                <span className="grai-mint-dividends-toggle-label-text">Claim all dividends:</span>
              </span>
              <button
                type="button"
                className={`grai-mint-dividends-toggle-btn${claimAllDividends ? ' is-active' : ''}`}
                role="switch"
                aria-checked={claimAllDividends}
                aria-label="Claim all dividends"
                onClick={() => setClaimAllDividends((current) => !current)}
              >
                <span className="grai-mint-dividends-toggle-option is-yes">Yes</span>
                <span className="grai-mint-dividends-toggle-track" aria-hidden="true">
                  <span className="grai-mint-dividends-toggle-thumb" />
                </span>
                <span className="grai-mint-dividends-toggle-option is-no">No</span>
              </button>
            </div>
          ) : null}
          {actionView === 'mint' && !isGraiSelected && !isAssetClaim ? (
            <div
              className={`grai-mint-dividends-toggle is-yes-no is-below-amount${
                earnDividends ? ' is-active' : ''
              }`}
            >
              <span className="grai-mint-dividends-toggle-label">
                <span className="grai-mint-dividends-toggle-label-text">
                  Lock GRAI for dividends
                </span>
              </span>
              <button
                type="button"
                className={`grai-mint-dividends-toggle-btn${earnDividends ? ' is-active' : ''}`}
                role="switch"
                aria-checked={earnDividends}
                aria-label="Lock GRAI for dividends"
                onClick={() => setEarnDividends((current) => !current)}
              >
                <span className="grai-mint-dividends-toggle-option is-yes">Yes</span>
                <span className="grai-mint-dividends-toggle-track" aria-hidden="true">
                  <span className="grai-mint-dividends-toggle-thumb" />
                </span>
                <span className="grai-mint-dividends-toggle-option is-no">No</span>
              </button>
            </div>
          ) : null}
          {actionView === 'mint' && isGraiSelected ? (
            <div className="grai-mint-secondary-row-slot">
              {isGraiUnlock ? (
                <div className="grai-action-result grai-action-result--penalty grai-action-result--penalty-row" aria-live="polite">
                  <span className="grai-action-result-label-wrap">
                    <GraiFieldInfoButton
                      className="grai-action-result-penalty-info"
                      hint={buildUnlockPenaltyHint(unlockPreview.unlockPenaltyPeriod)}
                      ariaLabel="About unlock penalty"
                      structured
                    />
                    <span className="grai-action-result-label">Penalty:</span>
                    <span className="grai-action-result-penalty-time">{penaltyDurationLabel}</span>
                  </span>
                  <span className="grai-action-result-value">
                    {penaltyLabel}
                    <img
                      src={assetUrl('logo.png')}
                      alt=""
                      width={18}
                      height={18}
                      loading="lazy"
                      decoding="async"
                    />
                    GRAI
                  </span>
                </div>
              ) : (
                <div className="grai-action-metrics grai-action-metrics--result-row" aria-live="polite">
                  <div className="grai-action-metric-row">
                    <span className="grai-action-metric-label-wrap">
                      <GraiFieldInfoButton
                        className="grai-action-metric-label-info"
                        hint="Indicative APR from yield dividends accrued on locked GRAI. Not guaranteed."
                        ariaLabel="About estimated APR"
                      />
                      <span className="grai-action-metric-label">Estimated APR</span>
                    </span>
                    <span className="grai-action-metric-value is-yield">11%</span>
                  </div>
                </div>
              )}
            </div>
          ) : null}
          {amount.trim() || isClaimAllAssetDividends || actionView === 'burn' ? (
          <div className="grai-action-result-group">
            <div
              className={`grai-action-result${
                isPreviewOpen &&
                (actionView === 'burn' ||
                  (actionView === 'mint' && !isGraiSelected && !isAssetClaim) ||
                  (isAssetClaim && claimAllDividends))
                  ? ' is-preview-open'
                  : ''
              }`}
              aria-live="polite"
            >
              {actionView === 'mint' ? (
                <>
                  {isAssetClaim ? (
                    <GraiActionResultLabel
                      isPreviewOpen={isPreviewOpen}
                      onTogglePreview={togglePreview}
                      showToggle={claimAllDividends}
                    >
                      You claim:
                    </GraiActionResultLabel>
                  ) : isGraiUnlock ? (
                    <span className="grai-action-result-label-wrap">
                      <span className="grai-action-result-label">You unlock:</span>
                    </span>
                  ) : isGraiLock ? (
                    <span className="grai-action-result-label-wrap">
                      <span className="grai-action-result-label">You lock:</span>
                    </span>
                  ) : (
                    <GraiActionResultLabel
                      isPreviewOpen={isPreviewOpen}
                      onTogglePreview={togglePreview}
                    >
                      <span
                        className="grai-action-result-label-swap"
                        data-mode={earnDividends ? 'lock' : 'receive'}
                      >
                        <span
                          className={`grai-action-result-label-swap-item${
                            earnDividends ? '' : ' is-active'
                          }`}
                          aria-hidden={earnDividends}
                        >
                          You receive:
                        </span>
                        <span
                          className={`grai-action-result-label-swap-item${
                            earnDividends ? ' is-active' : ''
                          }`}
                          aria-hidden={!earnDividends}
                        >
                          You lock:
                        </span>
                      </span>
                    </GraiActionResultLabel>
                  )}
                  <span className="grai-action-result-value">
                    {isAssetClaim ? (
                      claimAllDividends ? (
                        unlockDividendsUsdLabel
                      ) : (
                        <>
                          {amount.trim() || '0.0'}
                          {selectedAsset ? (
                            <img
                              src={selectedAsset.icon}
                              alt=""
                              width={18}
                              height={18}
                              loading="lazy"
                              decoding="async"
                            />
                          ) : null}
                          {selectedAsset?.symbol ?? ''}
                        </>
                      )
                    ) : isGraiLock ? (
                      <>
                        {lockedGraiLabel}
                        <img
                          src={assetUrl('logo.png')}
                          alt=""
                          width={18}
                          height={18}
                          loading="lazy"
                          decoding="async"
                        />
                        GRAI
                      </>
                    ) : isGraiUnlock ? (
                      <>
                        {amount.trim() ? unlockAmountLabel : lockedGraiLabel}
                        <img
                          src={assetUrl('logo.png')}
                          alt=""
                          width={18}
                          height={18}
                          loading="lazy"
                          decoding="async"
                        />
                        GRAI
                      </>
                    ) : (
                      <>
                        {!earnDividends ? '+ ' : null}
                        {mintedGraiLabel}
                        <img
                          src={assetUrl('logo.png')}
                          alt=""
                          width={18}
                          height={18}
                          loading="lazy"
                          decoding="async"
                        />
                        GRAI
                      </>
                    )}
                  </span>
                </>
              ) : (
                <>
                  <GraiActionResultLabel
                    isPreviewOpen={isPreviewOpen}
                    onTogglePreview={togglePreview}
                  >
                    <span className="grai-action-result-sigma" aria-hidden="true">Σ</span>
                    You receive:
                  </GraiActionResultLabel>
                  <span className="grai-action-result-value">{redeemUsdLabel}</span>
                </>
              )}
            </div>
            <div
              className={`grai-detailed-preview grai-detailed-preview--inline${
                isPreviewOpen &&
                (actionView === 'burn' ||
                  (actionView === 'mint' && !isGraiSelected && !isAssetClaim) ||
                  (isAssetClaim && claimAllDividends))
                  ? ' is-open'
                  : ''
              }`}
            >
              <div className="grai-detailed-preview-collapse">
                <div className="grai-detailed-preview-body">
                  {actionView === 'mint' ? (
                    isAssetClaim && claimAllDividends ? (
                      unlockClaims.length === 0 ? (
                        <div className="grai-detailed-preview-row grai-detailed-preview-row--value-only">
                          <span className="grai-detailed-preview-empty">No dividends to claim</span>
                        </div>
                      ) : (
                        unlockClaims.map((claim) => (
                          <div
                            key={claim.assetAddress}
                            className="grai-detailed-preview-row grai-detailed-preview-row--value-only"
                          >
                            <span className="grai-detailed-preview-value">
                              + {claim.amountLabel}
                              <img
                                src={claim.icon}
                                alt=""
                                width={16}
                                height={16}
                                loading="lazy"
                                decoding="async"
                              />
                              {claim.symbol}
                            </span>
                          </div>
                        ))
                      )
                    ) : isGraiSelected || isAssetClaim ? null : (
                      <>
                        <div className="grai-detailed-preview-row">
                          <GraiDetailedPreviewVaultLabel
                            label="Your escrow:"
                            hint={buildGrindersCashflowHint()}
                          />
                          <span className="grai-detailed-preview-value">
                            {earnDividends ? `+ ${mintedGraiLabel}` : '0.0'}
                            <img
                              src={assetUrl('logo.png')}
                              alt=""
                              width={16}
                              height={16}
                              loading="lazy"
                              decoding="async"
                            />
                            GRAI
                          </span>
                        </div>
                        <div className="grai-detailed-preview-row">
                          <GraiDetailedPreviewVaultLabel
                            label="Grinders"
                            hint={buildGrindersShareHint(selectedAsset?.symbol)}
                          />
                          <span className="grai-detailed-preview-value">
                            + {isEstimateLoading ? '…' : seniorShareLabel ?? '0.0'}
                            {selectedAsset ? (
                              <>
                                <img src={selectedAsset.icon} alt="" width={16} height={16} loading="lazy" decoding="async" />
                                {selectedAsset.symbol}
                              </>
                            ) : null}
                          </span>
                        </div>
                      </>
                    )
                  ) : isBurnEstimateLoading ? (
                    <div className="grai-detailed-preview-row grai-detailed-preview-row--value-only">
                      <span className="grai-detailed-preview-value">…</span>
                    </div>
                  ) : burnOutputs.length === 0 ? (
                    <div className="grai-detailed-preview-row grai-detailed-preview-row--value-only">
                      <span className="grai-detailed-preview-empty">Enter an amount to see the estimate</span>
                    </div>
                  ) : (
                    burnOutputs.map((output) => (
                      <div key={output.asset.mint} className="grai-detailed-preview-row grai-detailed-preview-row--value-only">
                        <span className="grai-detailed-preview-value">
                          + {output.amountLabel}
                          <img
                            src={output.asset.icon.src}
                            alt=""
                            width={16}
                            height={16}
                            loading="lazy"
                            decoding="async"
                          />
                          {output.asset.symbol}
                          <span className="grai-detailed-preview-usd">({output.usdLabel ?? '$0.00'})</span>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
          ) : null}
          {actionView === 'mint' && !isGraiSelected && !isAssetClaim ? (
            <div className="grai-action-metrics" aria-live="polite">
              <div className="grai-action-metric-row">
                <span className="grai-action-metric-label-wrap">
                  <GraiFieldInfoButton
                    className="grai-action-metric-label-info"
                    hint={projectedAnnualYieldHint}
                    ariaLabel="About expected APR"
                    structured
                  />
                  <span className="grai-action-metric-label">Expected APR</span>
                </span>
                <span className="grai-action-metric-value is-yield">
                  {assetYieldMetrics
                    ? formatProjectedYieldPct(assetYieldMetrics.projectedAnnualYieldPct)
                    : '—'}
                </span>
              </div>
            </div>
          ) : null}
          {isWalletConnected ? (
            <div className="grai-action-submit">
              <button
                type="button"
                className={actionView === 'mint' ? 'grai-mint-btn' : 'grai-burn-btn'}
                disabled={
                  isPending ||
                  (actionView === 'mint' && !selectedAsset?.address && !isClaimAllAssetDividends) ||
                  (isClaimAllAssetDividends ? false : unlockAmountIsEmptyOrZero)
                }
                onClick={() => {
                  void handleSubmit()
                }}
              >
                {actionView === 'mint'
                  ? selectedAsset?.symbol.toUpperCase() === 'GRAI'
                    ? isMinting || isLockPending
                      ? isGraiUnlock
                        ? 'Unlocking...'
                        : 'Locking...'
                      : isGraiUnlock
                        ? 'Unlock'
                        : 'Lock'
                    : isMinting || isLockPending
                      ? isAssetClaim
                        ? 'Claiming...'
                        : 'Depositing...'
                      : isAssetClaim
                        ? claimAllDividends
                          ? 'Claim All'
                          : 'Claim'
                        : 'Deposit'
                  : isBurning
                    ? 'Redeeming...'
                    : 'Redeem'}
              </button>
            </div>
          ) : (
            <GraiActionConnectWalletButton onConnect={openChainSelector} />
          )}
          {actionView === 'mint' ? (
            <div className="grai-action-deposit-notes">
              <p className="grai-action-deposit-note">
                {isGraiUnlock ? (
                  <>Unlock GRAI from escrow.</>
                ) : isGraiLock ? (
                  <>Lock GRAI to earn protocol dividends.</>
                ) : isAssetClaim ? (
                  <>
                    {claimAllDividends
                      ? 'Claim all accrued yield dividends across listed assets.'
                      : 'Claim accrued yield dividends for the selected asset.'}
                  </>
                ) : (
                  <>
                    Deposit assets goes to{' '}
                    <GraiFieldInfoButton
                      className="grai-action-deposit-term"
                      tooltipClassName="grai-action-deposit-term-tooltip"
                      ariaLabel="What Grinders are"
                      hint="An automated bookkeeping program with buy-low → sell-high signals that harvests price volatility."
                    >
                      <span className="grai-action-deposit-term-label">Grinders</span>
                    </GraiFieldInfoButton>{' '}
                    and their{' '}
                    <GraiFieldInfoButton
                      className="grai-action-deposit-term"
                      tooltipClassName="grai-action-deposit-term-tooltip"
                      ariaLabel="What custodians are"
                      hint="Protected smart contracts that hold deposited funds in custody."
                    >
                      <span className="grai-action-deposit-term-label">custodians</span>
                    </GraiFieldInfoButton>{' '}
                    to generate volatility yield, receiving GRAI as your share in the fund.
                  </>
                )}
              </p>
            </div>
          ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
