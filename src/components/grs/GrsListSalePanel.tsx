import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { formatEther } from 'viem'
import { GraiAmountInput } from '../grai/GraiAmountInput'
import { GraiFieldInfoButton } from '../grai/GraiFieldInfo'
import { useEvmWallet } from '../../hooks/useEvmWallet'
import { useSolanaWallet } from '../../hooks/useSolanaWallet'
import { useGrsEvmTransaction } from '../../hooks/useGrsEvmTransaction'
import { formatTokenBalance, normalizeDecimalInput, parseTokenAmount } from '../../grai/onchain'
import { assetUrl } from '../../utils/appPaths'
import {
  parseBridgeRecipient,
  parseSaleAsset,
  validateBridgeRecipient,
  ZERO_BYTES32,
} from '../../grs/bytes32'
import {
  GRS_DECIMALS,
  isSolanaLzEid,
  isTestnetChainId,
} from '../../grs/constants'
import { executeGrsSale } from '../../grs/evm/executeTransactions'
import { quoteGrsSale } from '../../grs/evm/readProtocol'
import {
  getDefaultGrsSolanaCluster,
  layerZeroScanTxUrl,
  type GrsEvmConfig,
} from '../../grs/deployments'
import { solanaUsdcMint } from '../../grs/solana/quoteAssets'
import type { GrsSnapshot } from '../../grs/evm/readProtocol'
import { SolanaLogomark } from '../SolanaLogomark'
import { EvmChainListIcon } from '../WalletNetworkSelect'
import { ActionDepositNote, usePersistedActionTx } from '../ActionTxFeedback'
import { GrsChainGlyph } from './GrsChainGlyph'
import { GrsSubmit, toastGrsSuccess } from './GrsActionBits'

type Props = {
  config: GrsEvmConfig | null
  snapshot: GrsSnapshot | null
  refresh: () => void
  solanaSpoke?: boolean
  note?: ReactNode
}

type QuoteAssetId = 'ETH' | 'USDC' | 'SOL'

const USDC_BY_CHAIN: Record<number, `0x${string}`> = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
}

const QUOTE_OPTIONS: {
  id: QuoteAssetId
  label: string
  decimals: number
  icon: ReactNode
}[] = [
  {
    id: 'ETH',
    label: 'ETH',
    decimals: 18,
    icon: <EvmChainListIcon name="Ethereum" />,
  },
  {
    id: 'USDC',
    label: 'USDC',
    decimals: 6,
    icon: (
      <img
        src="https://assets.coingecko.com/coins/images/6319/small/usdc.png"
        alt=""
        width={16}
        height={16}
      />
    ),
  },
  {
    id: 'SOL',
    label: 'SOL',
    decimals: 9,
    icon: <SolanaLogomark size={16} />,
  },
]

function resolveQuoteAssetInput(
  id: QuoteAssetId,
  chainId: number | undefined,
  destIsSolana: boolean,
  solanaCluster?: string,
): string {
  if (destIsSolana) {
    if (id === 'ETH' || id === 'SOL') return 'SOL'
    return solanaUsdcMint(solanaCluster)
  }
  if (id === 'ETH' || id === 'SOL') return id
  return USDC_BY_CHAIN[chainId ?? 11155111] ?? USDC_BY_CHAIN[11155111]
}

type DestOption = {
  eid: number
  name: string
  solana?: boolean
  chainId?: number
}

function DestinationSelect({
  value,
  options,
  onChange,
}: {
  value: number
  options: DestOption[]
  onChange: (eid: number) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.eid === value) ?? options[0] ?? null

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={`grs-chain-select grs-destination-select${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="grs-chain-select-trigger grai-mint-referrer-input"
        aria-label="Sale destination"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {selected ? (
          <span className="network-icon-svg" aria-hidden="true">
            <GrsChainGlyph name={selected.name} solana={selected.solana} />
          </span>
        ) : null}
        <span className="grs-chain-select-label">{selected?.name ?? '—'}</span>
        <svg
          className="grs-chain-select-caret"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div className="grs-chain-select-menu" role="listbox" aria-label="Sale destination">
          {options.map((option) => {
            const active = option.eid === value
            return (
              <button
                key={option.eid}
                type="button"
                role="option"
                aria-selected={active}
                className={`grs-chain-select-option${active ? ' is-active' : ''}`}
                onClick={() => {
                  onChange(option.eid)
                  setOpen(false)
                }}
              >
                <span className="network-icon-svg" aria-hidden="true">
                  <GrsChainGlyph name={option.name} solana={option.solana} />
                </span>
                <span>{option.name}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function QuoteAssetSelect({
  value,
  onChange,
  options = QUOTE_OPTIONS,
}: {
  value: QuoteAssetId
  onChange: (value: QuoteAssetId) => void
  options?: typeof QUOTE_OPTIONS
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.id === value) ?? options[0] ?? QUOTE_OPTIONS[0]

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={`grs-chain-select grs-quote-asset-select${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="grs-chain-select-trigger grai-mint-referrer-input"
        aria-label="Quote asset"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="network-icon-svg" aria-hidden="true">
          {selected.icon}
        </span>
        <span className="grs-chain-select-label">{selected.label}</span>
        <svg
          className="grs-chain-select-caret"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div className="grs-chain-select-menu" role="listbox" aria-label="Quote asset">
          {options.map((option) => {
            const active = option.id === value
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={active}
                className={`grs-chain-select-option${active ? ' is-active' : ''}`}
                onClick={() => {
                  onChange(option.id)
                  setOpen(false)
                }}
              >
                <span className="network-icon-svg" aria-hidden="true">
                  {option.icon}
                </span>
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function GrsListSalePanel({ config, snapshot, refresh, solanaSpoke, note }: Props) {
  const evmWallet = useEvmWallet()
  const solanaWallet = useSolanaWallet()
  const { run, reset, error: liveError, lastHash, isPending } = useGrsEvmTransaction()
  const { lastTx, lastError, begin, succeed, fail } = usePersistedActionTx()
  const [grsAmount, setGrsAmount] = useState('')
  const [quoteId, setQuoteId] = useState<QuoteAssetId>('ETH')
  const [assetAmount, setAssetAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [dstEid, setDstEid] = useState(0)
  const [nativeFee, setNativeFee] = useState<bigint | null>(null)
  const solanaCluster = getDefaultGrsSolanaCluster()

  const decimals = snapshot?.decimals ?? GRS_DECIMALS
  const remaining = snapshot?.tokenSalesRemaining ?? null
  const maxAmount = remaining != null && remaining > 0n ? formatTokenBalance(remaining, decimals) : ''
  const remainingLabel = remaining == null ? '—' : formatTokenBalance(remaining, decimals, 2)

  const assets = useMemo(
    () => [{ icon: assetUrl('logo.png'), symbol: 'GRS', address: config?.address ?? 'grs' }],
    [config?.address],
  )

  const destinations = useMemo(() => {
    const homeId = snapshot?.homeChain?.chainId ?? config?.chainId
    const homeName = snapshot?.homeChain?.chainName ?? config?.chainName ?? 'Home'
    const listed = (snapshot?.homePeers?.length ? snapshot.homePeers : snapshot?.peers) ?? []
    const peers = listed
      .filter((peer) => peer.eid > 0)
      .filter((peer) => !(peer.chainId && homeId && peer.chainId === homeId))
      .map((peer) => ({
        eid: peer.eid,
        name: `${peer.name} (spoke)`,
        chainId: peer.chainId,
        solana: peer.solana,
      }))
    return [
      {
        eid: 0,
        name: `${homeName} (home)`,
        chainId: homeId,
        solana: false,
      },
      ...peers,
    ]
  }, [
    config?.chainId,
    config?.chainName,
    snapshot?.homeChain?.chainId,
    snapshot?.homeChain?.chainName,
    snapshot?.homePeers,
    snapshot?.peers,
  ])

  const selectedDest = destinations.find((dest) => dest.eid === dstEid) ?? destinations[0] ?? null
  const destIsSolana = selectedDest
    ? Boolean(selectedDest.solana) || isSolanaLzEid(selectedDest.eid)
    : false
  const destName = selectedDest?.name

  const quoteOptions = useMemo(
    () =>
      destIsSolana
        ? QUOTE_OPTIONS.filter((option) => option.id === 'SOL' || option.id === 'USDC')
        : QUOTE_OPTIONS.filter((option) => option.id === 'ETH' || option.id === 'USDC'),
    [destIsSolana],
  )
  const quoteMeta = quoteOptions.find((option) => option.id === quoteId) ?? quoteOptions[0] ?? QUOTE_OPTIONS[0]
  const assetInput = resolveQuoteAssetInput(quoteId, config?.chainId, destIsSolana, solanaCluster)
  const assetDecimals = quoteMeta.decimals
  const quoteSymbol = quoteMeta.label

  useEffect(() => {
    if (!quoteOptions.some((option) => option.id === quoteId)) {
      setQuoteId(destIsSolana ? 'SOL' : 'ETH')
      setAssetAmount('')
    }
  }, [destIsSolana, quoteId, quoteOptions])

  const recipientCheck = useMemo(() => {
    if (!recipient.trim()) return { ok: true as const }
    return validateBridgeRecipient(recipient, destIsSolana, destName)
  }, [destIsSolana, destName, recipient])
  const recipientInvalid = recipient.trim().length > 0 && !recipientCheck.ok
  const recipientOk = recipientCheck.ok
  const meAddress = destIsSolana ? solanaWallet.address : evmWallet.address

  useEffect(() => {
    if (!destinations.some((dest) => dest.eid === dstEid)) {
      setDstEid(0)
    }
  }, [destinations, dstEid])

  useEffect(() => {
    setRecipient((current) => {
      const trimmed = current.trim()
      if (!destIsSolana) {
        if (!trimmed || validateBridgeRecipient(trimmed, false, destName).ok) return current
        return ''
      }
      if (!trimmed || validateBridgeRecipient(trimmed, true, destName).ok) return current
      return ''
    })
  }, [destIsSolana, destName])

  useEffect(() => {
    if (!config || dstEid === 0) {
      setNativeFee(0n)
      return
    }
    let cancelled = false
    const handle = window.setTimeout(() => {
      try {
        if (!grsAmount.trim() || !assetAmount.trim() || !recipientOk) {
          if (!cancelled) setNativeFee(null)
          return
        }
        const asset = parseSaleAsset(assetInput)
        const grsRaw = parseTokenAmount(grsAmount, decimals)
        const quoteRaw = parseTokenAmount(assetAmount, assetDecimals)
        const payee = recipient.trim()
          ? parseBridgeRecipient(recipient, destIsSolana, destName)
          : ZERO_BYTES32
        void quoteGrsSale(config, asset, quoteRaw, grsRaw, payee, dstEid)
          .then((fee) => {
            if (!cancelled) setNativeFee(fee)
          })
          .catch(() => {
            if (!cancelled) setNativeFee(null)
          })
      } catch {
        if (!cancelled) setNativeFee(null)
      }
    }, 220)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [
    assetAmount,
    assetDecimals,
    assetInput,
    config,
    decimals,
    destIsSolana,
    destName,
    dstEid,
    grsAmount,
    recipient,
    recipientOk,
  ])

  const handleList = async () => {
    if (!config) return
    begin()
    reset()
    try {
      const result = await run({
        config,
        connectMessage: 'Connect an EVM wallet to list a GRS sale',
        chainAction: 'list a GRS sale',
        failureMessage: 'Sale listing failed',
        amountInput: grsAmount,
        execute: () =>
          executeGrsSale({
            config,
            assetInput,
            assetAmountInput: assetAmount,
            assetDecimals,
            grsAmountInput: grsAmount,
            recipientInput: recipient,
            dstEid,
            destIsSolana,
            destName,
            decimals,
          }),
      })
      const href =
        dstEid !== 0
          ? layerZeroScanTxUrl(result.hash, isTestnetChainId(config.chainId))
          : null
      const linkLabel = href ? 'LayerZero Scan' : undefined
      const successLabel = dstEid === 0 ? 'Sale listed.' : 'Sale published.'
      succeed({ hash: result.hash, href, linkLabel, successLabel })
      toastGrsSuccess(
        dstEid === 0
          ? `Listed ${result.amountLabel} GRS`
          : `Published ${result.amountLabel} GRS`,
        config.chainId,
        result.hash,
        dstEid !== 0
          ? {
              href: layerZeroScanTxUrl(result.hash, isTestnetChainId(config.chainId)),
              linkLabel: 'View on LayerZero Scan',
            }
          : undefined,
      )
      setGrsAmount('')
      setAssetAmount('')
      refresh()
    } catch (listError) {
      fail(listError, 'Sale listing failed')
    }
  }

  const canSubmit =
    Boolean(config) &&
    Boolean(snapshot?.home) &&
    grsAmount.trim() !== '' &&
    assetAmount.trim() !== '' &&
    recipientOk

  const saleGrsLabel = grsAmount.trim() ? `${grsAmount} GRS` : '— GRS'
  const quoteLabel = assetAmount.trim() ? `${assetAmount} ${quoteSymbol}` : `— ${quoteSymbol}`
  let salePriceLabel: string | null = null
  try {
    if (grsAmount.trim() && assetAmount.trim()) {
      const grsRaw = parseTokenAmount(grsAmount, decimals)
      const quoteRaw = parseTokenAmount(assetAmount, assetDecimals)
      if (grsRaw > 0n && quoteRaw > 0n) {
        // quote units per 1 GRS, scaled by quote decimals
        const perGrs = (quoteRaw * 10n ** BigInt(decimals)) / grsRaw
        salePriceLabel = `${formatTokenBalance(perGrs, assetDecimals, 8)} ${quoteSymbol} / GRS`
      }
    }
  } catch {
    salePriceLabel = null
  }

  const lzScanTestnet = isTestnetChainId(config?.chainId ?? 0)
  const feedbackHash = lastTx?.hash ?? lastHash
  const error = liveError ?? lastError
  const lzScanHref =
    lastTx?.href ??
    (feedbackHash && dstEid !== 0 ? layerZeroScanTxUrl(feedbackHash, lzScanTestnet) : null)

  if (solanaSpoke && !config) {
    return (
      <p className="grs-empty">
        Solana GRS is deployed as a spoke (<code>home: false</code>). List / publish sales on the EVM
        home chain (Sepolia), then they can be LZ-published to Solana for spoke buys.
      </p>
    )
  }

  return (
    <>
      {snapshot && !snapshot.home ? (
        <p className="grs-preview-note">sale() is home-only. Switch to the home chain to list.</p>
      ) : null}

      <label className="grai-mint-referrer-field">
        <span className="grai-mint-referrer-label-row">
          <span className="grai-mint-referrer-label">Destination</span>
          <GraiFieldInfoButton hint="sale.dstEid: 0 keeps the lot on home. Else burns TokenSales GRS and LZ-publishes so the spoke mints escrow." />
        </span>
        <DestinationSelect
          value={dstEid}
          options={destinations}
          onChange={(eid) => {
            setDstEid(eid)
            reset()
          }}
        />
      </label>

      <GraiAmountInput
        label="GRS amount"
        assets={assets}
        value={grsAmount}
        onValueChange={(value) => {
          setGrsAmount(normalizeDecimalInput(value, decimals))
          reset()
        }}
        balanceLabel={remaining != null ? remainingLabel : '—'}
        balancePrefix="TokenSales:"
        usdTrailingLabel="remaining"
        maxAmount={maxAmount}
        decimals={decimals}
        disabled={false}
      />

      <label className="grai-mint-referrer-field">
        <span className="grai-mint-referrer-label-row">
          <span className="grai-mint-referrer-label">Quote amount</span>
          <GraiFieldInfoButton hint="Quote for remaining GRS. Home: ETH/USDC. Solana destination: SOL (native) or Solana USDC mint — not Sepolia USDC." />
        </span>
        <div className="grai-mint-referrer-input-row grs-quote-amount-row">
          <input
            className="grai-mint-referrer-input"
            inputMode="decimal"
            value={assetAmount}
            placeholder="0.00"
            onChange={(event) => {
              setAssetAmount(normalizeDecimalInput(event.target.value, assetDecimals))
              reset()
            }}
          />
          <QuoteAssetSelect
            value={quoteId}
            options={quoteOptions}
            onChange={(next) => {
              setQuoteId(next)
              setAssetAmount('')
              reset()
            }}
          />
        </div>
      </label>

      <label className={`grai-mint-referrer-field${recipientInvalid ? ' is-invalid' : ''}`}>
        <span className="grai-mint-referrer-label-row">
          <span className="grai-mint-referrer-label">Proceeds recipient</span>
          <GraiFieldInfoButton
            hint={
              destIsSolana
                ? 'sale.recipient: empty → owner() on home buy path; Solana pubkey as bytes32 for spoke sales.'
                : 'sale.recipient: empty → owner() at buy. EVM address left-padded to bytes32.'
            }
          />
        </span>
        <div className={`grai-mint-referrer-input-row${recipientInvalid ? ' is-invalid' : ''}`}>
          <input
            className={`grai-mint-referrer-input${recipientInvalid ? ' is-invalid' : ''}`}
            value={recipient}
            spellCheck={false}
            placeholder={destIsSolana ? 'owner() · Solana address' : 'owner() · 0x…'}
            aria-invalid={recipientInvalid}
            aria-describedby={recipientInvalid ? 'grs-sale-recipient-error' : undefined}
            onChange={(event) => {
              setRecipient(event.target.value)
              reset()
            }}
          />
          <button
            type="button"
            className="grai-mint-referrer-me-btn"
            disabled={!meAddress}
            title={
              destIsSolana
                ? meAddress
                  ? 'Use connected Solana wallet'
                  : 'Connect a Solana wallet'
                : meAddress
                  ? 'Use connected EVM wallet'
                  : 'Connect an EVM wallet'
            }
            aria-label={
              destIsSolana ? 'Fill connected Solana address' : 'Fill connected EVM address'
            }
            onClick={() => {
              if (!meAddress) return
              setRecipient(meAddress)
              reset()
            }}
          >
            ME
          </button>
        </div>
        {recipientInvalid && !recipientCheck.ok ? (
          <p id="grs-sale-recipient-error" className="grai-mint-referrer-error" role="alert">
            {recipientCheck.message}
          </p>
        ) : null}
      </label>

      <div className="grai-action-metrics" aria-live="polite">
        <div className="grai-action-metric-row">
          <span className="grai-action-metric-label">Quote</span>
          <span className="grai-action-metric-value">{quoteLabel}</span>
        </div>
        <div className="grai-action-metric-row">
          <span className="grai-action-metric-label">Sale</span>
          <span className="grai-action-metric-value">{saleGrsLabel}</span>
        </div>
        <div className="grai-action-metric-row">
          <span className="grai-action-metric-label">Price</span>
          <span className="grai-action-metric-value">
            {salePriceLabel ?? `— ${quoteSymbol} / GRS`}
          </span>
        </div>
        {dstEid !== 0 ? (
          <div className="grai-action-metric-row">
            <span className="grai-action-metric-label-wrap">
              <GraiFieldInfoButton
                className="grai-action-metric-label-info"
                hint="EVM sale() can publish to an EVM spoke. Solana listings use the Solana program."
              />
              <span className="grai-action-metric-label">LZ fee</span>
            </span>
            <span className="grai-action-metric-value">
              {nativeFee == null ? '—' : `${formatEther(nativeFee)} ETH`}
            </span>
          </div>
        ) : null}
      </div>

      <GrsSubmit
        connected={evmWallet.isConnected}
        disabled={!canSubmit}
        pending={isPending}
        label={dstEid === 0 ? 'List sale' : 'Publish sale'}
        onClick={() => {
          void handleList()
        }}
      />

      <ActionDepositNote
        isPending={isPending}
        pendingLabel={dstEid === 0 ? 'Listing sale…' : 'Publishing sale…'}
        error={error}
        hash={feedbackHash}
        chainId={config?.chainId}
        successLabel={lastTx?.successLabel ?? (dstEid === 0 ? 'Sale listed.' : 'Sale published.')}
        txHref={lzScanHref}
        linkLabel={lastTx?.linkLabel ?? (lzScanHref ? 'LayerZero Scan' : undefined)}
      >
        {note}
      </ActionDepositNote>
    </>
  )
}
