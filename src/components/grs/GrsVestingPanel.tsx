import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { GraiAmountInput } from '../grai/GraiAmountInput'
import { GraiFieldInfoButton } from '../grai/GraiFieldInfo'
import { useEvmWallet } from '../../hooks/useEvmWallet'
import { useSolanaWallet } from '../../hooks/useSolanaWallet'
import { useGrsEvmTransaction } from '../../hooks/useGrsEvmTransaction'
import { useGrsSolanaTransaction } from '../../hooks/useGrsSolanaTransaction'
import { formatTokenBalance, normalizeDecimalInput } from '../../grai/onchain'
import { assetUrl } from '../../utils/appPaths'
import { shortenAddress } from '../../utils/shortenAddress'
import { bucketLabel, GRS_DECIMALS, MAX_CLIFF_SECONDS, MAX_DURATION_SECONDS } from '../../grs/constants'
import { mockGrsVestings, partyName } from '../../grs/preview'
import { executeGrsRelease, executeGrsVest } from '../../grs/evm/executeTransactions'
import { executeSolanaGrsRelease, executeSolanaGrsVest } from '../../grs/solana/executeTransactions'
import { grsExplorerTxUrl, type GrsConfig } from '../../grs/deployments'
import type { GrsSnapshot, GrsVesting } from '../../grs/evm/readProtocol'
import { navigateToGrsSection } from '../../utils/grsNavigation'
import { ActionDepositNote, usePersistedActionTx } from '../ActionTxFeedback'
import { GrsSubmit, isGrsRecipient, toastGrsSuccess } from './GrsActionBits'

type VestView = 'claim' | 'lock'

type Props = {
  config: GrsConfig | null
  snapshot: GrsSnapshot | null
  isLoading: boolean
  refresh: () => void
  view: VestView
  note?: ReactNode
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

export function GrsVestingPanel({ config, snapshot, isLoading, refresh, view, note }: Props) {
  const evmWallet = useEvmWallet()
  const solanaWallet = useSolanaWallet()
  const claimTx = useGrsEvmTransaction()
  const lockTx = useGrsEvmTransaction()
  const solClaimTx = useGrsSolanaTransaction()
  const solLockTx = useGrsSolanaTransaction()
  const {
    lastTx: lastClaimTx,
    lastError: lastClaimError,
    begin: beginClaim,
    succeed: succeedClaim,
    fail: failClaim,
  } = usePersistedActionTx()
  const {
    lastTx: lastLockTx,
    lastError: lastLockError,
    begin: beginLock,
    succeed: succeedLock,
    fail: failLock,
  } = usePersistedActionTx()
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [cliffDays, setCliffDays] = useState('0')
  const [durationDays, setDurationDays] = useState('365')
  const [releasingId, setReleasingId] = useState<string | null>(null)

  const chainKind = config?.kind ?? null
  const decimals = snapshot?.decimals ?? (chainKind === 'solana' ? 9 : GRS_DECIMALS)
  const owner =
    chainKind === 'solana'
      ? solanaWallet.address ?? undefined
      : evmWallet.address?.toLowerCase()
  const liveRows = (snapshot?.vestings ?? []).filter((row) => {
    if (!owner) return true
    if (chainKind === 'solana') {
      return row.beneficiary === owner || row.funder === owner
    }
    return (
      row.beneficiary.toLowerCase() === owner || row.funder.toLowerCase() === owner
    )
  })
  const previewRows = useMemo(() => mockGrsVestings(), [])
  const isDemo = !config
  const rows = isDemo ? previewRows : liveRows
  const walletAddress =
    chainKind === 'solana' ? solanaWallet.address ?? '' : evmWallet.address ?? ''
  const walletConnected =
    chainKind === 'solana' ? solanaWallet.isConnected : evmWallet.isConnected

  useEffect(() => {
    if (walletAddress) {
      setRecipient((current) => (current.trim() ? current : walletAddress))
    }
  }, [walletAddress])

  const tokenAddress =
    config?.kind === 'solana' ? config.mint.toBase58() : (config?.address ?? 'grs')
  const assets = useMemo(
    () => [{ icon: assetUrl('logo.png'), symbol: 'GRS', address: tokenAddress }],
    [tokenAddress],
  )
  const walletBalanceText =
    snapshot != null ? formatTokenBalance(snapshot.balance, decimals, 6) : '—'
  const maxAmount =
    snapshot != null && snapshot.balance > 0n
      ? formatTokenBalance(snapshot.balance, decimals)
      : walletConnected
        ? '0'
        : ''

  const claimPending = chainKind === 'solana' ? solClaimTx.isPending : claimTx.isPending
  const claimLiveError = chainKind === 'solana' ? solClaimTx.error : claimTx.error
  const claimError = claimLiveError ?? lastClaimError
  const claimHash =
    lastClaimTx?.hash ?? (chainKind === 'solana' ? solClaimTx.lastSignature : claimTx.lastHash)
  const claimHref =
    lastClaimTx?.href ?? (claimHash && config ? grsExplorerTxUrl(config, claimHash) : null)
  const lockPending = chainKind === 'solana' ? solLockTx.isPending : lockTx.isPending
  const lockLiveError = chainKind === 'solana' ? solLockTx.error : lockTx.error
  const lockError = lockLiveError ?? lastLockError
  const lockHash =
    lastLockTx?.hash ?? (chainKind === 'solana' ? solLockTx.lastSignature : lockTx.lastHash)
  const lockHref =
    lastLockTx?.href ?? (lockHash && config ? grsExplorerTxUrl(config, lockHash) : null)
  const explorerLinkLabel = config?.kind === 'solana' ? 'Solscan' : 'Etherscan'

  const handleRelease = async (id: bigint) => {
    if (!config || isDemo) return
    setReleasingId(id.toString())
    beginClaim()
    try {
      if (config.kind === 'solana') {
        solClaimTx.reset()
        const result = await solClaimTx.run({
          connectMessage: 'Connect a Solana wallet to release vested GRS',
          clusterAction: 'release vested GRS',
          failureMessage: 'Release failed',
          execute: (ctx) => executeSolanaGrsRelease({ ...ctx, vestingId: id }),
        })
        const href = grsExplorerTxUrl(config, result.signature)
        succeedClaim({ hash: result.signature, href, linkLabel: 'Solscan', successLabel: 'Released.' })
        toastGrsSuccess(`Released vesting #${id.toString()}`, config, result.signature, {
          href,
          linkLabel: 'Solscan',
        })
      } else {
        claimTx.reset()
        const result = await claimTx.run({
          config,
          connectMessage: 'Connect an EVM wallet to release vested GRS',
          chainAction: 'release vested GRS',
          failureMessage: 'Release failed',
          execute: () => executeGrsRelease(config, id),
        })
        const href = grsExplorerTxUrl(config, result.hash)
        succeedClaim({ hash: result.hash, href, linkLabel: 'Etherscan', successLabel: 'Released.' })
        toastGrsSuccess(`Released vesting #${id.toString()}`, config, result.hash, {
          href,
          linkLabel: 'Etherscan',
        })
      }
      refresh()
    } catch (releaseError) {
      failClaim(releaseError, 'Release failed')
    } finally {
      setReleasingId(null)
    }
  }

  const handleVest = async () => {
    if (!config || isDemo) return
    const to = recipient.trim() || walletAddress
    if (!isGrsRecipient(to, config.kind)) return
    beginLock()
    try {
      const cliffSeconds = daysToSeconds(cliffDays, MAX_CLIFF_SECONDS, 'cliff')
      const durationSeconds = daysToSeconds(durationDays, MAX_DURATION_SECONDS, 'linear duration')
      if (config.kind === 'solana') {
        solLockTx.reset()
        const result = await solLockTx.run({
          connectMessage: 'Connect a Solana wallet to vest GRS',
          clusterAction: 'vest GRS',
          failureMessage: 'Vest failed',
          amountInput: amount,
          execute: (ctx) =>
            executeSolanaGrsVest({
              ...ctx,
              amountInput: amount,
              beneficiary: to,
              cliffSeconds,
              durationSeconds,
              decimals,
            }),
        })
        const href = grsExplorerTxUrl(config, result.signature)
        succeedLock({
          hash: result.signature,
          href,
          linkLabel: 'Solscan',
          successLabel: 'Vest created.',
        })
        toastGrsSuccess(`Vested ${result.amountLabel} GRS`, config, result.signature, {
          href,
          linkLabel: 'Solscan',
        })
      } else {
        lockTx.reset()
        const result = await lockTx.run({
          config,
          connectMessage: 'Connect an EVM wallet to vest GRS',
          chainAction: 'vest GRS',
          failureMessage: 'Vest failed',
          amountInput: amount,
          execute: () =>
            executeGrsVest({
              config,
              recipient: to,
              amountInput: amount,
              cliffSeconds,
              durationSeconds,
              decimals,
            }),
        })
        const href = grsExplorerTxUrl(config, result.hash)
        succeedLock({
          hash: result.hash,
          href,
          linkLabel: 'Etherscan',
          successLabel: 'Vest created.',
        })
        toastGrsSuccess(`Vested ${result.amountLabel} GRS`, config, result.hash, {
          href,
          linkLabel: 'Etherscan',
        })
      }
      setAmount('')
      refresh()
      navigateToGrsSection('vesting')
    } catch (vestError) {
      failLock(vestError, 'Vest failed')
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
                const claimRowPending = releasingId === row.id.toString() && claimPending
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
                          isDemo ||
                          !walletConnected ||
                          row.releasable === 0n ||
                          claimPending
                        }
                        onClick={() => {
                          void handleRelease(row.id)
                        }}
                      >
                        {claimRowPending
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

          {rows.length === 0 && !isDemo && !isLoading ? (
            <p className="grs-empty">No vesting schedules for this wallet.</p>
          ) : null}

          <ActionDepositNote
            isPending={claimPending}
            pendingLabel="Releasing vested GRS…"
            error={claimError}
            hash={claimHash}
            config={config}
            chainId={config?.kind === 'evm' ? config.chainId : undefined}
            successLabel={lastClaimTx?.successLabel ?? 'Released.'}
            txHref={claimHref}
            linkLabel={lastClaimTx?.linkLabel ?? explorerLinkLabel}
          >
            {note}
          </ActionDepositNote>
        </>
      ) : (
        <>
          <GraiAmountInput
            label="Vest"
            assets={assets}
            value={amount}
            onValueChange={(value) => {
              setAmount(normalizeDecimalInput(value, decimals))
            }}
            balanceLabel={walletConnected ? walletBalanceText : '—'}
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
              placeholder={chainKind === 'solana' ? 'Solana address' : '0x…'}
              onChange={(event) => {
                setRecipient(event.target.value)
              }}
            />
          </label>
          <GrsSubmit
            connected={walletConnected}
            disabled={
              isDemo ||
              !amount.trim() ||
              !isGrsRecipient(recipient.trim() || walletAddress, chainKind)
            }
            pending={lockPending}
            label="Vest GRS"
            onClick={() => {
              void handleVest()
            }}
          />
          <ActionDepositNote
            isPending={lockPending}
            pendingLabel="Vesting GRS…"
            error={lockError}
            hash={lockHash}
            config={config}
            chainId={config?.kind === 'evm' ? config.chainId : undefined}
            successLabel={lastLockTx?.successLabel ?? 'Vest created.'}
            txHref={lockHref}
            linkLabel={lastLockTx?.linkLabel ?? explorerLinkLabel}
          >
            {note}
          </ActionDepositNote>
        </>
      )}
    </>
  )
}
