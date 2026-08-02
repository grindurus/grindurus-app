import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { useGraiDeployment } from '../../grai/GraiDeploymentProvider'
import { graiAbi, grindersAbi } from '../../grai/evm/abi'
import { createGraiEvmPublicClient, resolveGraiContractAddress } from '../../grai/evm/client'
import { useActiveWallet } from '../../hooks/useActiveWallet'
import { useGraiGrindersLiquidate } from '../../hooks/useGraiGrindersLiquidate'
import { GraiActionConnectWalletButton } from './GraiWalletAction'
import { GraiTransactionToast } from './GraiTransactionToast'

type GrindersLiquidateMeta = {
  grindersAddress: `0x${string}`
  totalSupply: bigint
  liquidationOpen: boolean
}

function normalizeIdInput(value: string): string {
  return value.replace(/[^\d]/g, '')
}

export function GraiLiquidateForm() {
  const { chainKind, evm, explorerTxUrl } = useGraiDeployment()
  const activeWallet = useActiveWallet()
  const { liquidate, isLiquidating, reset } = useGraiGrindersLiquidate()

  const [fromId, setFromId] = useState('0')
  const [toId, setToId] = useState('')
  const [meta, setMeta] = useState<GrindersLiquidateMeta | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const isWalletConnected = activeWallet.isConnected
  const isEvm = chainKind === 'evm'

  const refreshMeta = useCallback(async () => {
    if (!isEvm || !evm) {
      setMeta(null)
      setLoadError(isEvm ? 'GRAI is not configured for this EVM network' : null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setLoadError(null)
    try {
      const client = createGraiEvmPublicClient(evm)
      const graiAddress = resolveGraiContractAddress(evm)
      const [grindersAddress, liquidationOpen] = await Promise.all([
        client.readContract({ address: graiAddress, abi: graiAbi, functionName: 'grinders' }),
        client.readContract({ address: graiAddress, abi: graiAbi, functionName: 'liquidation' }),
      ])

      if (!grindersAddress || grindersAddress === '0x0000000000000000000000000000000000000000') {
        setMeta(null)
        setLoadError('Grinders is not set on this GRAI deployment')
        return
      }

      const totalSupply = await client.readContract({
        address: grindersAddress,
        abi: grindersAbi,
        functionName: 'totalSupply',
      })

      setMeta({ grindersAddress, totalSupply, liquidationOpen })
      setToId((prev) => (prev.trim() === '' ? totalSupply.toString() : prev))
    } catch (error) {
      setMeta(null)
      setLoadError(error instanceof Error ? error.message : 'Failed to load Grinders state')
    } finally {
      setIsLoading(false)
    }
  }, [evm, isEvm])

  useEffect(() => {
    void refreshMeta()
  }, [refreshMeta])

  const rangeMode = useMemo(() => {
    const from = fromId.trim()
    const to = toId.trim()
    if (!from || !to || !/^\d+$/.test(from) || !/^\d+$/.test(to)) {
      return { kind: 'custom' as const, label: null }
    }
    try {
      const fromBig = BigInt(from)
      const toBig = BigInt(to)
      if (fromBig >= toBig) {
        return { kind: 'idle' as const, label: 'Sweep idle Grinders balances into GRAI' }
      }
      const supply = meta?.totalSupply
      if (fromBig === 0n && supply !== undefined && toBig === supply) {
        return { kind: 'all' as const, label: `Liquidate custodians [0, ${to})` }
      }
      return { kind: 'custom' as const, label: `Liquidate custodians [${from}, ${to})` }
    } catch {
      return { kind: 'custom' as const, label: null }
    }
  }, [fromId, meta?.totalSupply, toId])

  const handleFillAll = () => {
    setFromId('0')
    setToId((meta?.totalSupply ?? 0n).toString())
    reset()
  }

  const handleFillIdle = () => {
    setFromId('0')
    setToId('0')
    reset()
  }

  const handleSubmit = async () => {
    const toastId = toast.loading('Liquidating custodians…')
    try {
      const signature = await liquidate({
        fromIdInput: fromId,
        toIdInput: toId,
      })
      toast.update(toastId, {
        render: (
          <GraiTransactionToast
            message="Grinders liquidate confirmed"
            explorerHref={signature ? explorerTxUrl(signature) : null}
          />
        ),
        type: 'success',
        isLoading: false,
        autoClose: 8000,
        closeOnClick: true,
      })
      void refreshMeta()
    } catch (error) {
      toast.update(toastId, {
        render: error instanceof Error ? error.message : 'Grinders liquidate transaction failed',
        type: 'error',
        isLoading: false,
        autoClose: 8000,
        closeOnClick: true,
      })
    }
  }

  const liquidationOpen = meta?.liquidationOpen ?? false
  const canSubmit =
    isEvm &&
    isWalletConnected &&
    !isLiquidating &&
    !isLoading &&
    Boolean(meta) &&
    liquidationOpen &&
    /^\d+$/.test(fromId.trim()) &&
    /^\d+$/.test(toId.trim())

  return (
    <div className="grai-liquidation-open grai-manage-liquidate-form" id="grai-manage-liquidate">
      <div className="grai-liquidation-open-panel is-open">
        <div className="grai-liquidation-open-panel-inner">
          <div className="grai-action-result-group grai-liquidation-yield-results">
            <div className="grai-action-result" aria-live="polite">
              <span className="grai-action-result-label-wrap">
                <span className="grai-action-result-label">Liquidation:</span>
              </span>
              <span className="grai-action-result-value">
                {isLoading ? '…' : meta ? (liquidationOpen ? 'Open' : 'Closed') : '—'}
              </span>
            </div>
            <div className="grai-action-result" aria-live="polite">
              <span className="grai-action-result-label-wrap">
                <span className="grai-action-result-label">Custodians:</span>
              </span>
              <span className="grai-action-result-value">
                {isLoading ? '…' : (meta?.totalSupply.toString() ?? '—')}
              </span>
            </div>
          </div>

          <div className="grai-mint-amount-block grai-manage-liquidate-range-card">
            <div className="grai-mint-amount-field">
              <div className="grai-mint-amount-header">
                <span className="grai-field-label grai-field-label--with-icon">
                  <span className="grai-field-label-icon" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 6h16" />
                      <path d="M4 12h10" />
                      <path d="M4 18h7" />
                    </svg>
                  </span>
                  Custodian range
                </span>
                {rangeMode.label ? (
                  <span className="grai-manage-liquidate-range-mode" aria-live="polite">
                    {rangeMode.kind === 'idle' ? 'Idle sweep' : rangeMode.kind === 'all' ? 'All' : 'Custom'}
                  </span>
                ) : null}
              </div>

              <div className="grai-manage-liquidate-range">
                <label className="grai-manage-liquidate-range-field" htmlFor="grai-liquidate-from-id">
                  <span className="grai-field-label">From</span>
                  <div className="grai-manage-liquidate-range-input-wrap">
                    <input
                      id="grai-liquidate-from-id"
                      type="text"
                      inputMode="numeric"
                      className="grai-input grai-manage-liquidate-range-input"
                      placeholder="0"
                      value={fromId}
                      onChange={(event) => {
                        setFromId(normalizeIdInput(event.target.value))
                        reset()
                      }}
                      spellCheck={false}
                      autoComplete="off"
                    />
                  </div>
                </label>

                <span className="grai-manage-liquidate-range-sep" aria-hidden="true">
                  →
                </span>

                <label className="grai-manage-liquidate-range-field" htmlFor="grai-liquidate-to-id">
                  <span className="grai-field-label">To</span>
                  <div className="grai-manage-liquidate-range-input-wrap">
                    <input
                      id="grai-liquidate-to-id"
                      type="text"
                      inputMode="numeric"
                      className="grai-input grai-manage-liquidate-range-input"
                      placeholder={meta ? meta.totalSupply.toString() : '0'}
                      value={toId}
                      onChange={(event) => {
                        setToId(normalizeIdInput(event.target.value))
                        reset()
                      }}
                      spellCheck={false}
                      autoComplete="off"
                    />
                  </div>
                </label>
              </div>

              <div className="grai-manage-liquidate-presets" role="group" aria-label="Liquidate range presets">
                <button
                  type="button"
                  className={`grai-manage-liquidate-preset-btn${rangeMode.kind === 'all' ? ' is-active' : ''}`}
                  onClick={handleFillAll}
                >
                  All custodians
                </button>
                <button
                  type="button"
                  className={`grai-manage-liquidate-preset-btn${rangeMode.kind === 'idle' ? ' is-active' : ''}`}
                  onClick={handleFillIdle}
                >
                  Sweep idle
                </button>
              </div>

              {rangeMode.label ? (
                <p className="grai-manage-liquidate-mode-hint" aria-live="polite">
                  {rangeMode.label}
                </p>
              ) : null}
            </div>
          </div>

          {loadError && <p className="grai-manage-feedback is-error">{loadError}</p>}

          <div className="grai-action-submit grai-liquidation-step-actions">
            {isWalletConnected ? (
              <button
                type="button"
                className="grai-mint-btn"
                disabled={!canSubmit}
                title={
                  !isEvm
                    ? 'Switch to an EVM network to liquidate custodians'
                    : !meta
                      ? loadError ?? 'Grinders unavailable'
                      : !liquidationOpen
                        ? 'Liquidation must be open on GRAI'
                        : undefined
                }
                onClick={() => {
                  void handleSubmit()
                }}
              >
                {isLiquidating ? 'Liquidating…' : 'Liquidate'}
              </button>
            ) : (
              <GraiActionConnectWalletButton />
            )}
            <span className="grai-liquidation-step-hint">
              Permissionless while GRAI liquidation is open. Range is half-open{' '}
              <code>[fromId, toId)</code>; if <code>fromId ≥ toId</code>, idle Grinders balances are
              swept instead.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
