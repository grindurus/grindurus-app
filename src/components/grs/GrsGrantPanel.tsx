import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { formatEther, getAddress, isAddress } from 'viem'
import { GraiAmountInput } from '../grai/GraiAmountInput'
import { GraiFieldInfoButton } from '../grai/GraiFieldInfo'
import { useEvmWallet } from '../../hooks/useEvmWallet'
import { useSolanaWallet } from '../../hooks/useSolanaWallet'
import { useGrsEvmTransaction } from '../../hooks/useGrsEvmTransaction'
import { formatTokenBalance, normalizeDecimalInput, parseTokenAmount } from '../../grai/onchain'
import { assetUrl } from '../../utils/appPaths'
import {
  BUCKET_LABELS,
  GRS_DECIMALS,
  HOLDER_BUCKET,
  MAX_CLIFF_SECONDS,
  MAX_DURATION_SECONDS,
  bucketLabel,
  isSolanaLzEid,
  isTestnetChainId,
} from '../../grs/constants'
import { parseBridgeRecipient, validateBridgeRecipient } from '../../grs/bytes32'
import { executeGrsGrant } from '../../grs/evm/executeTransactions'
import { quoteGrsGrant } from '../../grs/evm/readProtocol'
import {
  grsExplorerTxUrl,
  layerZeroScanTxUrl,
  type GrsEvmConfig,
} from '../../grs/deployments'
import type { GrsSnapshot } from '../../grs/evm/readProtocol'
import { ActionDepositNote, usePersistedActionTx } from '../ActionTxFeedback'
import { GrsChainGlyph } from './GrsChainGlyph'
import { GrsSubmit, toastGrsSuccess } from './GrsActionBits'

type Props = {
  config: GrsEvmConfig | null
  snapshot: GrsSnapshot | null
  isLoading: boolean
  refresh: () => void
  solanaSelected?: boolean
  note?: ReactNode
}

type DestOption = { eid: number; name: string; chainId?: number; solana?: boolean }

const GRANT_BUCKETS = BUCKET_LABELS.map((label, bucket) => ({ bucket, label })).filter(
  (row) => row.bucket !== HOLDER_BUCKET,
)

function daysToSeconds(input: string, max: number, label: string): number {
  const trimmed = input.trim()
  if (!trimmed) return 0
  const days = Number(trimmed)
  if (!Number.isFinite(days) || days < 0) throw new Error(`Enter a valid ${label}`)
  const seconds = Math.round(days * 24 * 60 * 60)
  if (seconds > max) throw new Error(`${label} is over the on-chain cap`)
  return seconds
}

function chainIconClass(name: string, solana?: boolean): string {
  if (solana || /solana/i.test(name)) return 'solana'
  if (/arbitrum/i.test(name)) return 'arbitrum'
  if (/base/i.test(name)) return 'base'
  if (/sepolia/i.test(name)) return 'sepolia'
  return 'ethereum'
}

function DestSelect({
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
        aria-label="Grant destination"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {selected ? (
          <span
            className={`network-icon-svg ${chainIconClass(selected.name, selected.solana)}`}
            aria-hidden="true"
          >
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
        <div className="grs-chain-select-menu" role="listbox" aria-label="Grant destination">
          {options.map((option) => {
            const active = option.eid === selected?.eid
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
                <span
                  className={`network-icon-svg ${chainIconClass(option.name, option.solana)}`}
                  aria-hidden="true"
                >
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

const BUCKET_STAMP_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="6.25" />
    <circle cx="12" cy="12" r="2.25" fill="currentColor" stroke="none" />
    <path d="M12 5.75v1.5M12 16.75v1.5M5.75 12h1.5M16.75 12h1.5" />
  </svg>
)

function BucketSelect({
  value,
  options,
  remainingByBucket,
  decimals,
  onChange,
}: {
  value: number
  options: { bucket: number; label: string }[]
  remainingByBucket: Map<number, bigint>
  decimals: number
  onChange: (bucket: number) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.bucket === value) ?? options[0] ?? null

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

  const formatRemaining = (bucketId: number) => {
    const remaining = remainingByBucket.get(bucketId)
    if (remaining == null) return '—'
    return `${formatTokenBalance(remaining, decimals, 2)} GRS`
  }

  return (
    <div className={`grs-chain-select grs-bucket-select${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="grs-chain-select-trigger grai-mint-referrer-input"
        aria-label="Grant bucket"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="network-icon-svg grs-bucket-select-icon" aria-hidden="true">
          {BUCKET_STAMP_ICON}
        </span>
        <span className="grs-chain-select-label">{selected?.label ?? '—'}</span>
        <span className="grs-bucket-select-remaining" aria-hidden="true">
          {selected ? formatRemaining(selected.bucket) : '—'}
        </span>
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
        <div className="grs-chain-select-menu" role="listbox" aria-label="Grant bucket">
          {options.map((option) => {
            const active = option.bucket === selected?.bucket
            return (
              <button
                key={option.bucket}
                type="button"
                role="option"
                aria-selected={active}
                className={`grs-chain-select-option${active ? ' is-active' : ''}`}
                onClick={() => {
                  onChange(option.bucket)
                  setOpen(false)
                }}
              >
                <span className="network-icon-svg grs-bucket-select-icon" aria-hidden="true">
                  {BUCKET_STAMP_ICON}
                </span>
                <span className="grs-bucket-select-option-label">{option.label}</span>
                <span className="grs-bucket-select-option-remaining">{formatRemaining(option.bucket)}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function GrsGrantPanel({ config, snapshot, isLoading, refresh, solanaSelected, note }: Props) {
  const evmWallet = useEvmWallet()
  const solanaWallet = useSolanaWallet()
  const { run, reset, error: liveError, lastHash, isPending } = useGrsEvmTransaction()
  const { lastTx, lastError, begin, succeed, fail } = usePersistedActionTx()
  const [bucket, setBucket] = useState(0)
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [cliffDays, setCliffDays] = useState('0')
  const [durationDays, setDurationDays] = useState('0')
  const [dstEid, setDstEid] = useState(0)
  const [nativeFee, setNativeFee] = useState<bigint | null>(null)
  const [feeError, setFeeError] = useState<string | null>(null)

  const decimals = snapshot?.decimals ?? GRS_DECIMALS
  const allocation = snapshot?.allocations?.find((row) => row.bucket === bucket) ?? null
  const remaining = allocation?.remaining ?? null
  const maxAmount =
    remaining != null && remaining > 0n ? formatTokenBalance(remaining, decimals) : ''
  const remainingLabel = remaining == null ? '—' : formatTokenBalance(remaining, decimals, 2)
  const remainingByBucket = useMemo(() => {
    const map = new Map<number, bigint>()
    for (const row of snapshot?.allocations ?? []) {
      map.set(row.bucket, row.remaining)
    }
    return map
  }, [snapshot?.allocations])

  const destinations = useMemo((): DestOption[] => {
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
  const localGrant = dstEid === 0

  const recipientCheck = useMemo(() => {
    if (localGrant) {
      const trimmed = recipient.trim()
      if (!trimmed) return { ok: false as const, message: 'Enter an EVM address' }
      if (!isAddress(trimmed)) return { ok: false as const, message: 'Invalid EVM address' }
      return { ok: true as const }
    }
    return validateBridgeRecipient(recipient, destIsSolana, destName)
  }, [destIsSolana, destName, localGrant, recipient])

  const recipientInvalid = recipient.trim().length > 0 && !recipientCheck.ok
  const recipientReady = recipientCheck.ok
  const meAddress = destIsSolana && !localGrant ? solanaWallet.address : evmWallet.address

  useEffect(() => {
    if (!destinations.some((dest) => dest.eid === dstEid)) setDstEid(0)
  }, [destinations, dstEid])

  useEffect(() => {
    setRecipient((current) => {
      const trimmed = current.trim()
      if (localGrant || !destIsSolana) {
        if (trimmed && isAddress(trimmed)) return current
        return evmWallet.address ?? ''
      }
      if (trimmed && validateBridgeRecipient(trimmed, true, destName).ok) return current
      return solanaWallet.address || ''
    })
  }, [destIsSolana, destName, evmWallet.address, localGrant, solanaWallet.address])

  useEffect(() => {
    if (!config || localGrant) {
      setNativeFee(0n)
      setFeeError(null)
      return
    }
    let cancelled = false
    const handle = window.setTimeout(() => {
      try {
        if (!amount.trim() || amount === '0' || amount === '0.' || !recipientReady) {
          setNativeFee(null)
          setFeeError(null)
          return
        }
        const cliffSeconds = daysToSeconds(cliffDays, MAX_CLIFF_SECONDS, 'cliff')
        const durationSeconds = daysToSeconds(durationDays, MAX_DURATION_SECONDS, 'duration')
        const to = parseBridgeRecipient(recipient, destIsSolana, destName)
        const amountLD = parseTokenAmount(amount, decimals)
        void quoteGrsGrant(
          config,
          to,
          amountLD,
          0n,
          BigInt(cliffSeconds),
          BigInt(durationSeconds),
          bucket,
          dstEid,
        )
          .then((fee) => {
            if (!cancelled) {
              setNativeFee(fee)
              setFeeError(null)
            }
          })
          .catch((quoteError) => {
            if (!cancelled) {
              setNativeFee(null)
              setFeeError(
                quoteError instanceof Error ? quoteError.message : 'Could not quote LayerZero fee',
              )
            }
          })
      } catch (parseError) {
        if (!cancelled) {
          setNativeFee(null)
          setFeeError(parseError instanceof Error ? parseError.message : null)
        }
      }
    }, 280)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [
    amount,
    bucket,
    cliffDays,
    config,
    decimals,
    destIsSolana,
    destName,
    dstEid,
    durationDays,
    localGrant,
    recipient,
    recipientReady,
  ])

  const assets = useMemo(
    () => [{ icon: assetUrl('logo.png'), symbol: 'GRS', address: config?.address ?? 'grs' }],
    [config?.address],
  )

  const error = liveError ?? lastError
  const feedbackHash = lastTx?.hash ?? lastHash
  const feedbackHref =
    lastTx?.href ??
    (feedbackHash && config
      ? localGrant
        ? grsExplorerTxUrl(config, feedbackHash)
        : layerZeroScanTxUrl(feedbackHash, isTestnetChainId(config.chainId))
      : null)
  const feedbackLinkLabel = lastTx?.linkLabel ?? (localGrant ? 'Etherscan' : 'LayerZero Scan')

  const handleGrant = async () => {
    begin()
    reset()
    try {
      const cliffSeconds = daysToSeconds(cliffDays, MAX_CLIFF_SECONDS, 'cliff')
      const durationSeconds = daysToSeconds(durationDays, MAX_DURATION_SECONDS, 'duration')
      const result = await run({
        config,
        connectMessage: 'Connect an EVM wallet to grant GRS',
        chainAction: 'grant GRS',
        failureMessage: 'Grant failed',
        amountInput: amount,
        execute: () =>
          executeGrsGrant({
            config: config!,
            bucket,
            destIsSolana,
            destName,
            recipientInput: localGrant ? getAddress(recipient.trim()) : recipient,
            amountInput: amount,
            start: 0n,
            cliffSeconds,
            durationSeconds,
            dstEid,
            decimals,
          }),
      })
      const schedule =
        cliffSeconds === 0 && durationSeconds === 0
          ? 'instant'
          : `${cliffDays || '0'}d cliff / ${durationDays || '0'}d linear`
      const href = localGrant
        ? grsExplorerTxUrl(config!, result.hash)
        : layerZeroScanTxUrl(result.hash, isTestnetChainId(config!.chainId))
      const linkLabel = localGrant ? 'Etherscan' : 'LayerZero Scan'
      succeed({ hash: result.hash, href, linkLabel, successLabel: 'Grant sent.' })
      toastGrsSuccess(
        `Granted ${result.amountLabel} GRS (${bucketLabel(bucket)}, ${schedule})`,
        config!.chainId,
        result.hash,
        href ? { href, linkLabel: `View on ${linkLabel}` } : undefined,
      )
      setAmount('')
      refresh()
    } catch (grantError) {
      fail(grantError, 'Grant failed')
    }
  }

  if (solanaSelected && !config) {
    return (
      <p className="grs-empty">
        Cap-table <code>grant</code> is home-owner only on EVM. Switch to the GRS home chain (e.g.
        Sepolia).
      </p>
    )
  }

  return (
    <>
      {!snapshot?.home && config ? (
        <p className="grai-manage-feedback is-error" role="status">
          Grant is home-only (<code>onlyOwner</code>). Switch wallet to the home OFT chain.
        </p>
      ) : null}

      <label className="grai-mint-referrer-field">
        <span className="grai-mint-referrer-label-row">
          <span className="grai-mint-referrer-label">Bucket</span>
          <GraiFieldInfoButton hint="Cap-table bucket. Holder is for self-vest only — use Vest for that." />
        </span>
        <BucketSelect
          value={bucket}
          options={GRANT_BUCKETS}
          remainingByBucket={remainingByBucket}
          decimals={decimals}
          onChange={(next) => {
            setBucket(next)
          }}
        />
      </label>

      <label className="grai-mint-referrer-field">
        <span className="grai-mint-referrer-label-row">
          <span className="grai-mint-referrer-label">Destination</span>
          <GraiFieldInfoButton hint="dstEid 0 pays on home. Else instant OFT or LZ grant vest on the spoke." />
        </span>
        <DestSelect
          value={dstEid}
          options={destinations}
          onChange={(eid) => {
            setDstEid(eid)
          }}
        />
      </label>

      <GraiAmountInput
        label="Amount"
        assets={assets}
        value={amount}
        onValueChange={(value) => {
          setAmount(normalizeDecimalInput(value, decimals))
        }}
        balanceLabel={isLoading ? '…' : remainingLabel === '—' ? '—' : `${remainingLabel} GRS`}
        maxSubLabel={bucketLabel(bucket)}
        maxAmount={maxAmount}
        decimals={decimals}
        disabled={!config}
      />

      <label className={`grai-mint-referrer-field${recipientInvalid ? ' is-invalid' : ''}`}>
        <span className="grai-mint-referrer-label-row">
          <span className="grai-mint-referrer-label">
            Recipient{localGrant ? '' : ` on ${destName ?? 'destination'}`}
          </span>
          <GraiFieldInfoButton
            hint={
              localGrant
                ? 'EVM address (bytes32 left-padded). Solana pubkeys need a remote dstEid.'
                : destIsSolana
                  ? 'Solana wallet (base58) for the spoke grant / OFT credit.'
                  : 'EVM address on the destination chain.'
            }
          />
        </span>
        <div className={`grai-mint-referrer-input-row${recipientInvalid ? ' is-invalid' : ''}`}>
          <input
            className={`grai-mint-referrer-input${recipientInvalid ? ' is-invalid' : ''}`}
            value={recipient}
            spellCheck={false}
            autoComplete="off"
            placeholder={destIsSolana && !localGrant ? 'Solana address' : '0x…'}
            aria-invalid={recipientInvalid}
            onChange={(event) => {
              setRecipient(event.target.value)
            }}
          />
          <button
            type="button"
            className="grai-mint-referrer-me-btn"
            disabled={!meAddress}
            onClick={() => {
              if (!meAddress) return
              setRecipient(meAddress)
            }}
          >
            ME
          </button>
        </div>
        {recipientInvalid && !recipientCheck.ok ? (
          <p className="grai-mint-referrer-error" role="alert">
            {recipientCheck.message}
          </p>
        ) : null}
      </label>

      <div className="grs-route-row grs-route-row--pair">
        <label className="grai-mint-referrer-field">
          <span className="grai-mint-referrer-label-row">
            <span className="grai-mint-referrer-label">Cliff (days)</span>
            <GraiFieldInfoButton hint="0 + duration 0 = instant. Cliff ≤ 365 days." />
          </span>
          <input
            className="grai-mint-referrer-input"
            inputMode="decimal"
            value={cliffDays}
            onChange={(event) => {
              setCliffDays(normalizeDecimalInput(event.target.value, 2))
            }}
          />
        </label>
        <label className="grai-mint-referrer-field">
          <span className="grai-mint-referrer-label-row">
            <span className="grai-mint-referrer-label">Linear (days)</span>
            <GraiFieldInfoButton hint="Unlock after cliff. Duration ≤ 4 × 365 days. Start = now (0)." />
          </span>
          <input
            className="grai-mint-referrer-input"
            inputMode="decimal"
            value={durationDays}
            onChange={(event) => {
              setDurationDays(normalizeDecimalInput(event.target.value, 2))
            }}
          />
        </label>
      </div>

      {!localGrant ? (
        <div className="grai-action-metrics" aria-live="polite">
          <div className="grai-action-metric-row">
            <span className="grai-action-metric-label-wrap">
              <GraiFieldInfoButton
                className="grai-action-metric-label-info"
                hint="Native gas for LayerZero. From quoteGrant."
              />
              <span className="grai-action-metric-label">LZ fee</span>
            </span>
            <span className="grai-action-metric-value">
              {nativeFee != null ? `${formatEther(nativeFee)} ETH` : isLoading ? '…' : '—'}
            </span>
          </div>
        </div>
      ) : null}

      {feeError ? (
        <p className="grai-manage-feedback is-error" role="alert">
          {feeError}
        </p>
      ) : null}

      <GrsSubmit
        connected={evmWallet.isConnected}
        disabled={
          !config ||
          !snapshot?.home ||
          !amount.trim() ||
          !recipientReady ||
          Boolean(feeError)
        }
        pending={isPending}
        label="Grant"
        onClick={() => {
          void handleGrant()
        }}
      />

      <ActionDepositNote
        isPending={isPending}
        pendingLabel="Granting GRS…"
        error={error}
        hash={feedbackHash}
        chainId={config?.chainId}
        config={config}
        successLabel={lastTx?.successLabel ?? 'Grant sent.'}
        txHref={feedbackHref}
        linkLabel={feedbackLinkLabel}
      >
        {note}
      </ActionDepositNote>
    </>
  )
}
