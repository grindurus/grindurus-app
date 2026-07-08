import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'react-toastify'
import { formatVaultBalanceDisplay } from '../../grai/formatVaultBalance'
import { useGraiDeployment } from '../../grai/GraiDeploymentProvider'
import { GRAI_DECIMALS_EVM } from '../../grai/evm/constants'
import { USD_SCALE } from '../../grai/tokenomics'
import {
  formatProjectedYieldPct,
  formatVolatilityPct,
  lookupGraiAssetYieldMetrics,
  type GraiAssetYieldMetrics,
} from '../../grai/assetYieldMetrics'
import { useGraiAssets } from '../../hooks/useGraiAssets'
import { useGraiBurn } from '../../hooks/useGraiBurn'
import { useGraiMint } from '../../hooks/useGraiMint'
import { useGraiBurnEstimate } from '../../hooks/useGraiBurnEstimate'
import { useGraiMintEstimate } from '../../hooks/useGraiMintEstimate'
import { useWalletAssetBalance } from '../../hooks/useWalletAssetBalance'
import { useActiveWallet } from '../../hooks/useActiveWallet'
import { useWalletContext } from '../../providers/AppWalletProvider'
import { assetUrl } from '../../utils/appPaths'
import { GraiActionSwitch } from './GraiActionSwitch'
import { GraiAmountInput, type GraiAmountAsset } from './GraiAmountInput'
import { GraiTransactionToast } from './GraiTransactionToast'
import { GraiActionConnectWalletButton } from './GraiWalletAction'
import { GraiFieldInfoButton } from './GraiFieldInfo'
import { BALANCE_COLUMN_ICONS } from './graiPageIcons'
import { GraiUiCaret } from './GraiUiCaret'

type ActionView = 'mint' | 'burn'

type Props = {
  actionView: ActionView
  onActionViewChange: (view: ActionView) => void
}

function buildVaultShareHint(vault: 'senior' | 'junior', assetSymbol?: string): ReactNode {
  const title = assetSymbol ? `Share of ${assetSymbol} amount` : 'Share of asset amount'
  const description =
    vault === 'senior'
      ? 'Portion allocated to the Senior Vault collateral pool.'
      : 'Portion allocated to the Junior Vault for grinder strategies.'

  return (
    <>
      <span className="grai-field-info-tooltip-title">{title}</span>
      <span className="grai-field-info-tooltip-section">{description}</span>
    </>
  )
}

function buildAssetVolatilityHint(
  symbol?: string,
  metrics?: GraiAssetYieldMetrics | null,
): ReactNode {
  const assetLabel = symbol ?? 'the selected asset'
  const volatilityLabel = metrics ? formatVolatilityPct(metrics.volatilityPct) : '—'

  return (
    <>
      <span className="grai-field-info-tooltip-title">
        {symbol ? `${symbol} Volatility` : 'Asset Volatility'}
      </span>
      <span className="grai-field-info-tooltip-section">
        <span className="grai-field-info-tooltip-section-label">Definition</span>
        Realized volatility is the annualized standard deviation of {assetLabel} price returns over a
        trailing lookback — it reflects how much the asset actually moved, not implied or forecast
        volatility.
      </span>
      <span className="grai-field-info-tooltip-section">
        <span className="grai-field-info-tooltip-section-label">Current reading</span>
        Annually {volatilityLabel} based on observed historical price swings.
      </span>
    </>
  )
}

function buildProjectedAnnualYieldHint(
  symbol?: string,
  metrics?: GraiAssetYieldMetrics | null,
): ReactNode {
  const assetLabel = symbol ?? 'the selected asset'
  const volatilityLabel = metrics ? formatVolatilityPct(metrics.volatilityPct) : '—'
  const yieldLabel = metrics ? formatProjectedYieldPct(metrics.projectedAnnualYieldPct) : '—'

  return (
    <>
      <span className="grai-field-info-tooltip-title">est. APY</span>
      <span className="grai-field-info-tooltip-section">
        <span className="grai-field-info-tooltip-section-label">Formula</span>
        <code>max(baseline, capture_rate × annualized_volatility)</code>
        <span className="grai-field-info-tooltip-formula-note">
          Annualized volatility for {assetLabel} is {volatilityLabel}. Capture rate is calibrated per
          asset from grinder backtests. Current projection: {yieldLabel}.
        </span>
      </span>
      <span className="grai-field-info-tooltip-section">
        <span className="grai-field-info-tooltip-section-label">What it means</span>
        Junior vault grinders harvest price swings. Higher volatility usually creates more trading
        opportunity and a higher projected annual return to GRAI holders.
      </span>
      <p className="grai-field-info-tooltip-note">
        Indicative estimate only. Actual returns depend on market conditions and grinder uptime.
      </p>
    </>
  )
}

function GraiDetailedPreviewVaultLabel({
  vault,
  label,
  hint,
}: {
  vault: 'senior' | 'junior'
  label: string
  hint: ReactNode
}) {
  return (
    <span className="grai-detailed-preview-label-wrap">
      <span className={`grai-detailed-preview-vault-icon is-${vault}`} aria-hidden="true">
        {vault === 'senior' ? BALANCE_COLUMN_ICONS.seniorVault : BALANCE_COLUMN_ICONS.juniorVault}
      </span>
      <span className="grai-detailed-preview-label">{label}</span>
      <GraiFieldInfoButton hint={hint} ariaLabel={`${label} information`} structured />
    </span>
  )
}

function GraiActionResultLabel({
  isPreviewOpen,
  onTogglePreview,
  children,
}: {
  isPreviewOpen: boolean
  onTogglePreview: () => void
  children: ReactNode
}) {
  return (
    <span className="grai-action-result-label-wrap">
      <button
        type="button"
        className="grai-action-result-preview-toggle"
        aria-expanded={isPreviewOpen}
        aria-label={isPreviewOpen ? 'Hide detailed preview' : 'Show detailed preview'}
        onClick={onTogglePreview}
      >
        <GraiUiCaret className="grai-detailed-preview-chevron" />
      </button>
      <span className="grai-action-result-label">{children}</span>
    </span>
  )
}

export function GraiMintBurnPanel({ actionView, onActionViewChange }: Props) {
  const { openChainSelector } = useWalletContext()
  const { chainKind, solana, staticSolana, evm, explorerTxUrl } = useGraiDeployment()
  const activeWallet = useActiveWallet()
  const isWalletConnected = activeWallet.isConnected
  const { assets: graiAssets } = useGraiAssets()
  const { mint: mintGrai, isMinting } = useGraiMint()
  const { burn: burnGrai, isBurning } = useGraiBurn()

  const [amount, setAmount] = useState('')
  const [selectedAsset, setSelectedAsset] = useState<GraiAmountAsset | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const graiMintAddress =
    chainKind === 'evm' && evm
      ? (evm.graiToken ?? evm.protocolAddress ?? '')
      : solana?.graiMint.toBase58() ?? staticSolana?.graiMint.toBase58() ?? ''

  const mintAssetOptions = useMemo<GraiAmountAsset[]>(
    () =>
      graiAssets.map((asset) => ({
        icon: asset.icon.src,
        symbol: asset.symbol,
        address: asset.mint,
      })),
    [graiAssets],
  )
  const redeemAssetOptions = useMemo<GraiAmountAsset[]>(
    () => [{ icon: assetUrl('logo.png'), symbol: 'GRAI', address: graiMintAddress }],
    [graiMintAddress],
  )

  const {
    balanceLabel,
    maxAmount,
    decimals,
    refresh: refreshWalletBalance,
  } = useWalletAssetBalance(selectedAsset?.address || undefined, selectedAsset?.symbol)

  const {
    estimatedGrai,
    seniorShareLabel,
    juniorShareLabel,
    seniorShareUsdRaw,
    juniorShareUsdRaw,
    isLoading: isEstimateLoading,
  } = useGraiMintEstimate(
    actionView === 'mint' ? selectedAsset?.address : undefined,
    amount,
    decimals,
  )

  const { burnOutputs, isLoading: isBurnEstimateLoading } = useGraiBurnEstimate(
    amount,
    actionView === 'burn',
  )

  useEffect(() => {
    setAmount('')
  }, [actionView])

  const usdScale = chainKind === 'evm' ? GRAI_DECIMALS_EVM : USD_SCALE
  const mintUsdLabel = useMemo(() => {
    if (!amount.trim()) return '$0.00'
    if (isEstimateLoading) return '…'
    const totalUsd = seniorShareUsdRaw + juniorShareUsdRaw
    if (totalUsd <= 0n) return '$0.00'
    return `$${formatVaultBalanceDisplay(totalUsd, usdScale, 2)}`
  }, [amount, isEstimateLoading, juniorShareUsdRaw, seniorShareUsdRaw, usdScale])

  const redeemUsdLabel = useMemo(() => {
    if (!amount.trim()) return '$0.00'
    if (isBurnEstimateLoading) return '…'
    const totalUsd = burnOutputs.reduce((sum, output) => sum + output.usdRaw, 0n)
    if (totalUsd <= 0n) return '$0.00'
    return `$${formatVaultBalanceDisplay(totalUsd, usdScale, 2)}`
  }, [amount, burnOutputs, isBurnEstimateLoading, usdScale])

  const formatShareUsdLabel = useCallback(
    (usdRaw: bigint) => (usdRaw > 0n ? `$${formatVaultBalanceDisplay(usdRaw, usdScale, 2)}` : '$0.00'),
    [usdScale],
  )

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

  const assetVolatilityHint = useMemo(
    () => buildAssetVolatilityHint(selectedAsset?.symbol, assetYieldMetrics),
    [selectedAsset?.symbol, assetYieldMetrics],
  )

  const isPending = actionView === 'mint' ? isMinting : isBurning

  const handleSubmit = useCallback(async () => {
    const isMint = actionView === 'mint'
    const toastId = toast.loading(isMint ? 'Minting GRAI…' : 'Redeeming GRAI…')
    try {
      const signature = isMint
        ? await mintGrai({
            assetMint: selectedAsset?.address ?? '',
            amountInput: amount,
            assetDecimals: decimals ?? undefined,
          })
        : await burnGrai({ amountInput: amount, graiDecimals: decimals ?? undefined })
      toast.update(toastId, {
        render: (
          <GraiTransactionToast
            message={isMint ? 'Mint successful' : 'Redeem successful'}
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
    } catch (error) {
      toast.update(toastId, {
        render: error instanceof Error ? error.message : 'Transaction failed',
        type: 'error',
        isLoading: false,
        autoClose: 8000,
        closeOnClick: true,
      })
    }
  }, [actionView, amount, burnGrai, decimals, explorerTxUrl, mintGrai, refreshWalletBalance, selectedAsset?.address])

  return (
    <div className="grai-actions-row grai-actions-row-mint">
      <div className="grai-action-card grai-mint">
        <GraiActionSwitch actionView={actionView} onActionViewChange={onActionViewChange} />
        <div className="grai-action-content">
          <GraiAmountInput
            key={actionView}
            label={actionView === 'mint' ? 'Asset Amount' : 'Token Amount'}
            assets={actionView === 'mint' ? mintAssetOptions : redeemAssetOptions}
            defaultAsset={actionView === 'mint' ? mintAssetOptions[0]?.symbol : 'GRAI'}
            value={amount}
            onValueChange={setAmount}
            onAssetChange={setSelectedAsset}
            balanceLabel={isWalletConnected ? balanceLabel : '—'}
            maxAmount={maxAmount}
            decimals={decimals}
            usdLabel={actionView === 'mint' ? mintUsdLabel : redeemUsdLabel}
          />
          <div className="grai-action-result-group">
            <div className={`grai-action-result${isPreviewOpen ? ' is-preview-open' : ''}`} aria-live="polite">
              {actionView === 'mint' ? (
                <>
                  <GraiActionResultLabel
                    isPreviewOpen={isPreviewOpen}
                    onTogglePreview={() => setIsPreviewOpen((open) => !open)}
                  >
                    You receive:
                  </GraiActionResultLabel>
                  <span className="grai-action-result-value">
                    {mintedGraiLabel}
                    <img src={assetUrl('logo.png')} alt="" width={18} height={18} loading="lazy" decoding="async" />
                    GRAI
                  </span>
                </>
              ) : (
                <>
                  <GraiActionResultLabel
                    isPreviewOpen={isPreviewOpen}
                    onTogglePreview={() => setIsPreviewOpen((open) => !open)}
                  >
                    <span className="grai-action-result-sigma" aria-hidden="true">Σ</span>
                    You receive:
                  </GraiActionResultLabel>
                  <span className="grai-action-result-value">{redeemUsdLabel}</span>
                </>
              )}
            </div>
            <div className={`grai-detailed-preview grai-detailed-preview--inline${isPreviewOpen ? ' is-open' : ''}`}>
              <div className="grai-detailed-preview-collapse">
                <div className="grai-detailed-preview-body">
                  {actionView === 'mint' ? (
                    <>
                      <div className="grai-detailed-preview-row">
                        <GraiDetailedPreviewVaultLabel
                          vault="senior"
                          label="Sr. Vault:"
                          hint={buildVaultShareHint('senior', selectedAsset?.symbol)}
                        />
                        <span className="grai-detailed-preview-value">
                          + {isEstimateLoading ? '…' : seniorShareLabel ?? '0.0'}
                          {selectedAsset ? (
                            <>
                              <img src={selectedAsset.icon} alt="" width={16} height={16} loading="lazy" decoding="async" />
                              {selectedAsset.symbol}
                            </>
                          ) : null}
                          {!isEstimateLoading ? (
                            <span className="grai-detailed-preview-usd">({formatShareUsdLabel(seniorShareUsdRaw)})</span>
                          ) : null}
                        </span>
                      </div>
                      <div className="grai-detailed-preview-row">
                        <GraiDetailedPreviewVaultLabel
                          vault="junior"
                          label="Jr. Vault:"
                          hint={buildVaultShareHint('junior', selectedAsset?.symbol)}
                        />
                        <span className="grai-detailed-preview-value">
                          + {isEstimateLoading ? '…' : juniorShareLabel ?? '0.0'}
                          {selectedAsset ? (
                            <>
                              <img src={selectedAsset.icon} alt="" width={16} height={16} loading="lazy" decoding="async" />
                              {selectedAsset.symbol}
                            </>
                          ) : null}
                          {!isEstimateLoading ? (
                            <span className="grai-detailed-preview-usd">({formatShareUsdLabel(juniorShareUsdRaw)})</span>
                          ) : null}
                        </span>
                      </div>
                    </>
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
          {actionView === 'mint' ? (
            <div className="grai-action-metrics" aria-live="polite">
              <div className="grai-action-metrics-labels">
                <span className="grai-action-metric-label-wrap grai-action-metric-label-wrap--start">
                  {selectedAsset?.icon ? (
                    <span className="grai-action-metric-label-icon" aria-hidden="true">
                      <img
                        src={selectedAsset.icon}
                        alt=""
                        width={18}
                        height={18}
                        loading="lazy"
                        decoding="async"
                      />
                    </span>
                  ) : null}
                  <span className="grai-action-metric-label">
                    {selectedAsset?.symbol ? `${selectedAsset.symbol} Volatility` : 'Asset Volatility'}
                  </span>
                  <GraiFieldInfoButton
                    className="grai-action-metric-label-info"
                    hint={assetVolatilityHint}
                    ariaLabel="What realized volatility means"
                    structured
                  />
                </span>
                <span className="grai-action-metrics-arrow" aria-hidden="true">
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
                <span className="grai-action-metric-label-wrap grai-action-metric-label-wrap--end">
                  <span className="grai-action-metric-label">est. APY</span>
                  <GraiFieldInfoButton
                    className="grai-action-metric-label-info"
                    hint={projectedAnnualYieldHint}
                    ariaLabel="How estimated APY is calculated"
                    structured
                  />
                </span>
              </div>
              <div className="grai-action-metrics-values">
                <span className="grai-action-metric-value">
                  {assetYieldMetrics
                    ? `Annually ${formatVolatilityPct(assetYieldMetrics.volatilityPct)}`
                    : '—'}
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
                disabled={isPending || !amount.trim() || (actionView === 'mint' && !selectedAsset?.address)}
                onClick={() => {
                  void handleSubmit()
                }}
              >
                {actionView === 'mint'
                  ? isMinting
                    ? 'Minting...'
                    : 'Mint'
                  : isBurning
                    ? 'Redeeming...'
                    : 'Redeem'}
              </button>
            </div>
          ) : (
            <GraiActionConnectWalletButton onConnect={openChainSelector} />
          )}
        </div>
      </div>
    </div>
  )
}
