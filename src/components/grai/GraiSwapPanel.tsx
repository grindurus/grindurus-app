import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownUp, Settings } from 'lucide-react'
import { useGraiDeployment } from '../../grai/GraiDeploymentProvider'
import { FALLBACK_GRAI_ASSETS } from '../../grai/knownMints'
import { normalizeDecimalInput } from '../../grai/onchain'
import { GRAI_DECIMALS } from '../../grai/tokenomics'
import { GRAI_DECIMALS_EVM } from '../../grai/evm/constants'
import { useGraiAssets } from '../../hooks/useGraiAssets'
import { useWalletAssetBalance } from '../../hooks/useWalletAssetBalance'
import { assetUrl } from '../../utils/appPaths'
import { useActiveWallet } from '../../wallets/useActiveWallet'
import { useEvmWallet } from '../../wallets/useEvmWallet'
import { useSolanaWallet } from '../../wallets/useSolanaWallet'
import { GraiAmountInput, type GraiAmountAsset } from './GraiAmountInput'
import { GraiActionConnectWalletButton } from './GraiWalletAction'

const SLIPPAGE_PRESETS = ['0.1', '0.5', '1.0'] as const

export function GraiSwapPanel() {
  const { chainKind, solana, staticSolana, evm } = useGraiDeployment()
  const { assets: graiAssets } = useGraiAssets()
  const activeWallet = useActiveWallet()
  const solanaWallet = useSolanaWallet()
  const evmWallet = useEvmWallet()
  const isWalletConnected =
    chainKind === 'solana'
      ? solanaWallet.isConnected || Boolean(solanaWallet.address || solanaWallet.publicKey)
      : chainKind === 'evm'
        ? evmWallet.isConnected
        : activeWallet.isConnected

  const graiMintAddress =
    chainKind === 'evm' && evm
      ? (evm.graiToken ?? evm.protocolAddress ?? '')
      : solana?.graiMint.toBase58() ?? staticSolana?.graiMint.toBase58() ?? ''

  const graiAsset = useMemo<GraiAmountAsset>(
    () => ({
      icon: assetUrl('grai.png'),
      symbol: 'GRAI',
      address: graiMintAddress,
    }),
    [graiMintAddress],
  )

  const listedAssets = useMemo<GraiAmountAsset[]>(() => {
    const listedSource = graiAssets.length > 0 ? graiAssets : FALLBACK_GRAI_ASSETS
    return listedSource
      .filter((asset) => asset.symbol.toUpperCase() !== 'GRAI')
      .map((asset) => ({
        icon: asset.icon.src,
        symbol: asset.symbol,
        address: asset.mint,
      }))
  }, [graiAssets])

  const allAssets = useMemo(() => [graiAsset, ...listedAssets], [graiAsset, listedAssets])

  const [sellSymbol, setSellSymbol] = useState('GRAI')
  const [buySymbol, setBuySymbol] = useState('')
  const [sellAmount, setSellAmount] = useState('')
  const [buyAmount, setBuyAmount] = useState('')
  const [slippagePct, setSlippagePct] = useState('0.5')
  const [isSlippageOpen, setIsSlippageOpen] = useState(false)
  const slippageWrapRef = useRef<HTMLDivElement>(null)

  // Keep buy/sell on valid, distinct assets. GRAI may sit on either side (flip).
  useEffect(() => {
    const sellOk = Boolean(sellSymbol && allAssets.some((a) => a.symbol === sellSymbol))
    const buyOk =
      Boolean(buySymbol && allAssets.some((a) => a.symbol === buySymbol)) &&
      buySymbol !== sellSymbol
    if (sellOk && buyOk) return

    const nextSell =
      (sellOk ? sellSymbol : null) ??
      allAssets.find((a) => a.symbol === 'GRAI')?.symbol ??
      allAssets[0]?.symbol
    if (!nextSell) return
    if (!sellOk) setSellSymbol(nextSell)

    const nextBuy =
      (buyOk && buySymbol !== nextSell ? buySymbol : null) ??
      listedAssets.find((a) => a.symbol !== nextSell)?.symbol ??
      allAssets.find((a) => a.symbol !== nextSell)?.symbol
    if (nextBuy && nextBuy !== buySymbol) setBuySymbol(nextBuy)
  }, [allAssets, buySymbol, listedAssets, sellSymbol])

  useEffect(() => {
    if (!isSlippageOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!slippageWrapRef.current?.contains(target)) {
        setIsSlippageOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSlippageOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isSlippageOpen])

  const sellAsset = useMemo(
    () => allAssets.find((a) => a.symbol === sellSymbol) ?? graiAsset,
    [allAssets, graiAsset, sellSymbol],
  )
  const buyAsset = useMemo(
    () =>
      allAssets.find((a) => a.symbol === buySymbol) ??
      listedAssets[0] ??
      graiAsset,
    [allAssets, buySymbol, graiAsset, listedAssets],
  )

  const sellAssets = useMemo(
    () => allAssets.filter((a) => a.symbol !== buyAsset.symbol),
    [allAssets, buyAsset.symbol],
  )
  const buyAssets = useMemo(
    () => allAssets.filter((a) => a.symbol !== sellAsset.symbol),
    [allAssets, sellAsset.symbol],
  )

  const {
    balanceLabel: sellBalanceLabel,
    maxAmount: sellMaxAmount,
    decimals: sellDecimals,
    isLoading: sellBalanceLoading,
  } = useWalletAssetBalance(sellAsset.address || undefined, sellAsset.symbol)

  const {
    balanceLabel: buyBalanceLabel,
    maxAmount: buyMaxAmount,
    decimals: buyDecimals,
    isLoading: buyBalanceLoading,
  } = useWalletAssetBalance(buyAsset.address || undefined, buyAsset.symbol)

  const graiDecimals = chainKind === 'evm' ? GRAI_DECIMALS_EVM : GRAI_DECIMALS

  const handleFlip = useCallback(() => {
    const nextSell = buySymbol
    const nextBuy = sellSymbol
    if (!nextSell || !nextBuy || nextSell === nextBuy) return
    setSellSymbol(nextSell)
    setBuySymbol(nextBuy)
    setSellAmount(buyAmount)
    setBuyAmount(sellAmount)
  }, [buyAmount, buySymbol, sellAmount, sellSymbol])

  const rateLabel = useMemo(() => {
    if (!sellAsset || !buyAsset) return '—'
    return `1 ${sellAsset.symbol} ≈ — ${buyAsset.symbol}`
  }, [buyAsset, sellAsset])

  return (
    <div className="grai-actions-row grai-actions-row-mint">
      <div className="grai-action-card grai-mint">
        <div className="grai-action-content">
          <div className="grai-swap-controls" role="group" aria-label="Swap GRAI on DEX">
            <div className="grai-swap-stack">
              <div className="grai-swap-leg is-sell">
                <GraiAmountInput
                  key={`sell-${sellAsset.symbol}`}
                  label="FROM"
                  assets={sellAssets}
                  defaultAsset={sellAsset.symbol}
                  value={sellAmount}
                  onValueChange={setSellAmount}
                  onAssetChange={(asset) => setSellSymbol(asset.symbol)}
                  balanceLabel={isWalletConnected ? sellBalanceLabel : '—'}
                  balanceLoading={sellBalanceLoading}
                  balancePrefix="Available:"
                  maxAmount={sellMaxAmount}
                  decimals={sellDecimals ?? (sellAsset.symbol === 'GRAI' ? graiDecimals : null)}
                  usdLabel="$0.00"
                  keepUsdForGrai
                  showPresets
                  showAssetDetail
                />
              </div>

              <div className="grai-swap-flip-row">
                <button
                  type="button"
                  className="grai-swap-flip-btn"
                  onClick={handleFlip}
                  aria-label={`Flip ${sellAsset.symbol} and ${buyAsset.symbol}`}
                  title="Flip tokens"
                >
                  <ArrowDownUp aria-hidden="true" />
                </button>
              </div>

              <div className="grai-swap-leg is-buy">
                <GraiAmountInput
                  key={`buy-${buyAsset.symbol}`}
                  label="TO"
                  assets={buyAssets}
                  defaultAsset={buyAsset.symbol}
                  value={buyAmount}
                  onValueChange={setBuyAmount}
                  onAssetChange={(asset) => setBuySymbol(asset.symbol)}
                  balanceLabel={isWalletConnected ? buyBalanceLabel : '—'}
                  balanceLoading={buyBalanceLoading}
                  balancePrefix="Available:"
                  maxAmount={buyMaxAmount}
                  decimals={buyDecimals ?? (buyAsset.symbol === 'GRAI' ? graiDecimals : null)}
                  usdLabel="$0.00"
                  keepUsdForGrai
                  showPresets={false}
                  showAssetDetail
                />
              </div>
            </div>

            <div className="grai-swap-meta" aria-live="polite">
              <span className="grai-swap-meta-rate">{rateLabel}</span>
              <div className="grai-swap-meta-slippage grai-yield-auction-slippage" ref={slippageWrapRef}>
                <button
                  type="button"
                  className={`grai-swap-slippage-trigger${isSlippageOpen ? ' is-open' : ''}`}
                  aria-label="Set slippage"
                  aria-expanded={isSlippageOpen}
                  aria-haspopup="dialog"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    setIsSlippageOpen((open) => !open)
                  }}
                >
                  <span>Slippage {slippagePct.trim() || '0'}%</span>
                  <Settings size={14} strokeWidth={2.2} aria-hidden="true" />
                </button>
                {isSlippageOpen ? (
                  <div
                    className="grai-yield-auction-slippage-popover"
                    role="dialog"
                    aria-label="Slippage settings"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <span className="grai-yield-auction-slippage-title">Slippage</span>
                    <span className="grai-yield-auction-slippage-input-wrap">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="grai-yield-auction-slippage-input"
                        value={slippagePct}
                        onChange={(event) =>
                          setSlippagePct(normalizeDecimalInput(event.target.value, 2))
                        }
                        aria-label="Slippage percent"
                        autoFocus
                      />
                      <span className="grai-yield-auction-slippage-suffix">%</span>
                    </span>
                    <div className="grai-amount-preset-btns" aria-label="Slippage presets">
                      {SLIPPAGE_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className={`grai-amount-preset-btn${slippagePct === preset ? ' is-active' : ''}`}
                          onClick={() => setSlippagePct(preset)}
                        >
                          {preset}%
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {isWalletConnected ? (
              <div className="grai-action-submit">
                <button type="button" className="grai-mint-btn" disabled title="DEX routing coming soon">
                  Swap
                </button>
              </div>
            ) : (
              <GraiActionConnectWalletButton />
            )}

            <p className="grai-liquidation-buyback-vote-note">
              Swap GRAI for a listed asset on DEX aggregators. Quotes and execution wire up next.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
