import { useEffect, useMemo, useState } from 'react'
import { isAddress } from 'viem'
import { GraiAmountInput } from '../grai/GraiAmountInput'
import { GraiFieldInfoButton } from '../grai/GraiFieldInfo'
import { useEvmWallet } from '../../hooks/useEvmWallet'
import { useGrsEvmTransaction } from '../../hooks/useGrsEvmTransaction'
import { formatTokenBalance, normalizeDecimalInput } from '../../grai/onchain'
import { assetUrl } from '../../utils/appPaths'
import { shortenAddress } from '../../utils/shortenAddress'
import { bucketLabel, GRS_DECIMALS, MAX_CLIFF_SECONDS, MAX_DURATION_SECONDS } from '../../grs/constants'
import { mockGrsVestings, partyName } from '../../grs/preview'
import { executeGrsRelease, executeGrsVest } from '../../grs/evm/executeTransactions'
import type { GrsEvmConfig } from '../../grs/deployments'
import type { GrsSnapshot, GrsVesting } from '../../grs/evm/readProtocol'
import { navigateToGrsSection } from '../../utils/grsNavigation'
import { GrsFeedback, GrsSubmit, toastGrsSuccess } from './GrsActionBits'

type VestView = 'claim' | 'lock'

type Props = {
  config: GrsEvmConfig | null
  snapshot: GrsSnapshot | null
  isLoading: boolean
  refresh: () => void
  view: VestView
}

function formatTs(ts: number): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function daysToSeconds(input: string, max: number, label: string): number {
  const trimmed = input.trim()
  if (!trimmed) return 0
  const days = Number(trimmed)
  if (!Number.isFinite(days) || days < 0) throw new Error(`Enter a valid ${label}`)
  const seconds = Math.round(days * 24 * 60 * 60)
  if (seconds > max) throw new Error(`${label} is over the on-chain cap`)
  return seconds
}

function beneficiaryWho(row: GrsVesting): string {
  const name = partyName(row.beneficiary)
  const short = shortenAddress(row.beneficiary)
  return name ? `${name} · ${short}` : short
}

function vestProgress(row: GrsVesting): number {
  if (row.allocation === 0n) return 0
  const unlocked = row.released + row.releasable
  return Number((unlocked * 10_000n) / row.allocation) / 100
}

export function GrsVestingPanel({ config, snapshot, isLoading, refresh, view }: Props) {
  const evmWallet = useEvmWallet()
  const claimTx = useGrsEvmTransaction()
  const lockTx = useGrsEvmTransaction()
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [cliffDays, setCliffDays] = useState('0')
  const [durationDays, setDurationDays] = useState('365')
  const [releasingId, setReleasingId] = useState<string | null>(null)

  const decimals = snapshot?.decimals ?? GRS_DECIMALS
  const owner = evmWallet.address?.toLowerCase()
  const liveRows = (snapshot?.vestings ?? []).filter((row) =>
    owner ? row.beneficiary.toLowerCase() === owner : true,
  )
  const previewRows = useMemo(() => mockGrsVestings(), [])
  const isPreview = liveRows.length === 0
  const rows = isPreview ? previewRows : liveRows

  useEffect(() => {
    if (evmWallet.address) {
      setRecipient((current) => (current.trim() ? current : evmWallet.address ?? ''))
    }
  }, [evmWallet.address])

  const assets = useMemo(
    () => [{ icon: assetUrl('logo.png'), symbol: 'GRS', address: config?.address ?? 'grs' }],
    [config?.address],
  )
  const walletBalanceText =
    snapshot != null ? formatTokenBalance(snapshot.balance, decimals, 6) : '—'
  const maxAmount =
    snapshot != null && snapshot.balance > 0n
      ? formatTokenBalance(snapshot.balance, decimals)
      : evmWallet.isConnected
        ? '0'
        : ''

  const handleRelease = async (id: bigint) => {
    if (!config || isPreview) return
    claimTx.reset()
    setReleasingId(id.toString())
    try {
      const result = await claimTx.run({
        config,
        connectMessage: 'Connect an EVM wallet to release vested GRS',
        chainAction: 'release vested GRS',
        failureMessage: 'Release failed',
        execute: () => executeGrsRelease(config, id),
      })
      toastGrsSuccess(`Released vesting #${id.toString()}`, config.chainId, result.hash)
      refresh()
    } catch {
      /* status captured */
    } finally {
      setReleasingId(null)
    }
  }

  const handleVest = async () => {
    if (!config || isPreview) return
    lockTx.reset()
    try {
      const result = await lockTx.run({
        config,
        connectMessage: 'Connect an EVM wallet to vest GRS',
        chainAction: 'vest GRS',
        failureMessage: 'Vest failed',
        amountInput: amount,
        execute: () => {
          const cliffSeconds = daysToSeconds(cliffDays, MAX_CLIFF_SECONDS, 'cliff')
          const durationSeconds = daysToSeconds(durationDays, MAX_DURATION_SECONDS, 'linear duration')
          return executeGrsVest({
            config,
            recipient: recipient.trim() || evmWallet.address || '',
            amountInput: amount,
            cliffSeconds,
            durationSeconds,
            decimals,
          })
        },
      })
      toastGrsSuccess(`Vested ${result.amountLabel} GRS`, config.chainId, result.hash)
      setAmount('')
      refresh()
      navigateToGrsSection('vesting')
    } catch {
      /* status captured */
    }
  }

  return (
    <>
      {view === 'claim' ? (
        <>
          {config && isLoading && liveRows.length === 0 ? (
            <p className="grs-empty">Loading schedules…</p>
          ) : (
            <ul className="grs-vest-list">
              {rows.map((row) => {
                const now = Date.now() / 1000
                const beforeCliff = now < row.cliffEnd
                const claimPending = releasingId === row.id.toString() && claimTx.isPending
                return (
                  <li key={row.id.toString()} className="grs-vest-row">
                    <div className="grs-vest-row-top">
                      <span>
                        {bucketLabel(row.bucket)} · #{row.id.toString()}
                      </span>
                      <span>{formatTokenBalance(row.allocation, decimals, 4)} GRS</span>
                    </div>
                    <p className="grs-vest-who">To {beneficiaryWho(row)}</p>
                    <p className="grs-vest-meta">
                      <span>
                        {beforeCliff ? `Cliff ${formatTs(row.cliffEnd)}` : `Ends ${formatTs(row.end)}`}
                      </span>
                      <span>
                        {formatTokenBalance(row.releasable, decimals, 4)} unlocked · {vestProgress(row).toFixed(0)}%
                      </span>
                    </p>
                    <div className="grai-action-submit">
                      <button
                        type="button"
                        className="grai-mint-btn"
                        disabled={
                          isPreview ||
                          !evmWallet.isConnected ||
                          row.releasable === 0n ||
                          claimTx.isPending
                        }
                        onClick={() => {
                          void handleRelease(row.id)
                        }}
                      >
                        {claimPending
                          ? 'Releasing…'
                          : row.releasable === 0n
                            ? beforeCliff
                              ? 'Cliffed'
                              : 'Released'
                            : `Release ${formatTokenBalance(row.releasable, decimals, 4)} GRS`}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <GrsFeedback
            isPending={claimTx.isPending}
            pendingLabel="Releasing vested GRS…"
            error={claimTx.error}
            hash={claimTx.lastHash}
            chainId={config?.chainId}
            successLabel="Released."
          />
        </>
      ) : (
        <>
          <GraiAmountInput
            label="Vest"
            assets={assets}
            value={amount}
            onValueChange={(value) => {
              setAmount(normalizeDecimalInput(value, decimals))
              lockTx.reset()
            }}
            balanceLabel={evmWallet.isConnected ? walletBalanceText : '—'}
            balanceLoading={isLoading && snapshot == null}
            usdTrailingLabel="balance"
            maxAmount={maxAmount}
            decimals={decimals}
            disabled={false}
          />
          <div className="grs-schedule-grid">
            <label className="grai-mint-referrer-field">
              <span className="grai-mint-referrer-label-row">
                <span className="grai-mint-referrer-label">Cliff (days)</span>
                <GraiFieldInfoButton hint="Max 365 days. Zero cliff starts linear unlock immediately." />
              </span>
              <input
                className="grai-mint-referrer-input"
                inputMode="numeric"
                value={cliffDays}
                onChange={(event) => setCliffDays(event.target.value.replace(/[^\d]/g, ''))}
              />
            </label>
            <label className="grai-mint-referrer-field">
              <span className="grai-mint-referrer-label-row">
                <span className="grai-mint-referrer-label">Linear (days)</span>
                <GraiFieldInfoButton hint="Max 4 years. Cliff or duration must be non-zero." />
              </span>
              <input
                className="grai-mint-referrer-input"
                inputMode="numeric"
                value={durationDays}
                onChange={(event) => setDurationDays(event.target.value.replace(/[^\d]/g, ''))}
              />
            </label>
          </div>
          <label className="grai-mint-referrer-field">
            <span className="grai-mint-referrer-label-row">
              <span className="grai-mint-referrer-label">Beneficiary</span>
              <GraiFieldInfoButton hint="Non-revocable. Tokens stream to this address; start is now." />
            </span>
            <input
              className="grai-mint-referrer-input"
              value={recipient}
              spellCheck={false}
              placeholder="0x…"
              onChange={(event) => {
                setRecipient(event.target.value)
                lockTx.reset()
              }}
            />
          </label>
          <GrsFeedback
            isPending={lockTx.isPending}
            pendingLabel="Vesting GRS…"
            error={lockTx.error}
            hash={lockTx.lastHash}
            chainId={config?.chainId}
            successLabel="Vest created."
          />
          <GrsSubmit
            connected={evmWallet.isConnected}
            disabled={
              isPreview || !amount.trim() || !isAddress(recipient.trim() || evmWallet.address || '')
            }
            pending={lockTx.isPending}
            label="Vest GRS"
            onClick={() => {
              void handleVest()
            }}
          />
        </>
      )}
    </>
  )
}
