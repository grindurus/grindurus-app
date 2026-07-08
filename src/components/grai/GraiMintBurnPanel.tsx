import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'react-toastify'
import { formatVaultBalanceDisplay } from '../../grai/formatVaultBalance'
import { useGraiDeployment } from '../../grai/GraiDeploymentProvider'
import { GRAI_DECIMALS_EVM } from '../../grai/evm/constants'
import { USD_SCALE } from '../../grai/tokenomics'
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

function GraiDetailedPreviewVaultLabel({
  label,
  hint,
}: {
  label: string
  hint: ReactNode
}) {
  return (
    <span className="grai-detailed-preview-label-wrap">
      <span className="grai-detailed-preview-label">{label}</span>
      <GraiFieldInfoButton hint={hint} ariaLabel={`${label} information`} structured />
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
          <div className="grai-action-result" aria-live="polite">
            {actionView === 'mint' ? (
              <>
                <span className="grai-action-result-label">You receive:</span>
                <span className="grai-action-result-value">
                  {mintedGraiLabel}
                  <img src={assetUrl('logo.png')} alt="" width={18} height={18} loading="lazy" decoding="async" />
                  GRAI
                </span>
              </>
            ) : (
              <>
                <span className="grai-action-result-label">
                  <span className="grai-action-result-sigma" aria-hidden="true">Σ</span>
                  You receive:
                </span>
                <span className="grai-action-result-value">{redeemUsdLabel}</span>
              </>
            )}
          </div>
          <div className={`grai-detailed-preview${isPreviewOpen ? ' is-open' : ''}`}>
            <button
              type="button"
              className="grai-detailed-preview-summary"
              aria-expanded={isPreviewOpen}
              onClick={() => setIsPreviewOpen((open) => !open)}
            >
              <span>Detailed Preview</span>
              <GraiUiCaret className="grai-detailed-preview-chevron" />
            </button>
            <div className="grai-detailed-preview-collapse">
              <div className="grai-detailed-preview-body">
                {actionView === 'mint' ? (
                  <>
                    <div className="grai-detailed-preview-row">
                      <GraiDetailedPreviewVaultLabel
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
                  <div className="grai-detailed-preview-row">
                    <span className="grai-detailed-preview-label">You receive:</span>
                    <span className="grai-detailed-preview-value">…</span>
                  </div>
                ) : burnOutputs.length === 0 ? (
                  <div className="grai-detailed-preview-row">
                    <span className="grai-detailed-preview-label">You receive:</span>
                    <span className="grai-detailed-preview-empty">Enter an amount to see the estimate</span>
                  </div>
                ) : (
                  burnOutputs.map((output) => (
                    <div key={output.asset.mint} className="grai-detailed-preview-row">
                      <span className="grai-detailed-preview-label">You receive:</span>
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
          {isWalletConnected ? (
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
          ) : (
            <GraiActionConnectWalletButton onConnect={openChainSelector} />
          )}
        </div>
      </div>
    </div>
  )
}
