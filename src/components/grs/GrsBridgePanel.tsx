import { useEffect, useMemo, useRef, useState } from 'react'
import { formatEther } from 'viem'
import { GraiAmountInput } from '../grai/GraiAmountInput'
import { GraiFieldInfoButton } from '../grai/GraiFieldInfo'
import { useEvmWallet } from '../../hooks/useEvmWallet'
import { useSolanaWallet } from '../../hooks/useSolanaWallet'
import { useGrsEvmTransaction } from '../../hooks/useGrsEvmTransaction'
import { useWalletContext } from '../../providers/AppWalletProvider'
import { formatTokenBalance, normalizeDecimalInput, parseTokenAmount } from '../../grai/onchain'
import { assetUrl } from '../../utils/appPaths'
import {
  GRS_BRIDGE_DESTINATIONS,
  GRS_BRIDGE_SOURCES,
  GRS_DECIMALS,
  LZ_EID_BY_CHAIN_ID,
  isSolanaLzEid,
  isTestnetChainId,
  type GrsBridgeDestination,
} from '../../grs/constants'
import { parseBridgeRecipient, validateBridgeRecipient } from '../../grs/bytes32'
import { executeGrsBridge } from '../../grs/evm/executeTransactions'
import { quoteGrsBridge } from '../../grs/evm/readProtocol'
import { listConfiguredGrsChains, type GrsEvmConfig } from '../../grs/deployments'
import type { GrsPeer, GrsSnapshot } from '../../grs/evm/readProtocol'
import { SolanaLogomark } from '../SolanaLogomark'
import { EvmChainListIcon } from '../WalletNetworkSelect'
import { GrsFeedback, GrsSubmit, toastGrsSuccess } from './GrsActionBits'

type Props = {
  config: GrsEvmConfig | null
  snapshot: GrsSnapshot | null
  isLoading: boolean
  refresh: () => void
}

function peerToDest(peer: GrsPeer): GrsBridgeDestination {
  return { eid: peer.eid, name: peer.name, chainId: peer.chainId, solana: peer.solana }
}

function chainIconClass(name: string, solana?: boolean): string {
  if (solana || /solana/i.test(name)) return 'solana'
  if (/arbitrum/i.test(name)) return 'arbitrum'
  if (/base/i.test(name)) return 'base'
  if (/sepolia/i.test(name)) return 'sepolia'
  return 'ethereum'
}

function GrsChainGlyph({ name, solana }: { name: string; solana?: boolean }) {
  if (solana || /solana/i.test(name)) return <SolanaLogomark size={16} />
  if (/arbitrum/i.test(name)) return <EvmChainListIcon name="Arbitrum" />
  if (/base/i.test(name)) return <EvmChainListIcon name="Base" />
  if (/sepolia/i.test(name)) return <EvmChainListIcon name="Sepolia" />
  return <EvmChainListIcon name="Ethereum" />
}

type GrsChainOption = { value: string; name: string; solana?: boolean }

function GrsChainSelect({
  value,
  options,
  onChange,
  ariaLabel,
  disabled,
}: {
  value: string
  options: GrsChainOption[]
  onChange: (value: string) => void
  ariaLabel: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value) ?? options[0] ?? null

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
    <div className={`grs-chain-select${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="grs-chain-select-trigger grai-mint-referrer-input"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (!disabled) setOpen((current) => !current)
        }}
      >
        {selected ? (
          <span className={`network-icon-svg ${chainIconClass(selected.name, selected.solana)}`} aria-hidden="true">
            <GrsChainGlyph name={selected.name} solana={selected.solana} />
          </span>
        ) : null}
        <span className="grs-chain-select-label">{selected?.name ?? '—'}</span>
        <svg className="grs-chain-select-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div className="grs-chain-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => {
            const active = option.value === selected?.value
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                className={`grs-chain-select-option${active ? ' is-active' : ''}`}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                <span className={`network-icon-svg ${chainIconClass(option.name, option.solana)}`} aria-hidden="true">
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

export function GrsBridgePanel({ config, snapshot, isLoading, refresh }: Props) {
  const evmWallet = useEvmWallet()
  const solanaWallet = useSolanaWallet()
  const { setSelectedChainType } = useWalletContext()
  const { run, reset, error, lastHash, isPending } = useGrsEvmTransaction()
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [fromPick, setFromPick] = useState<number | null>(null)
  const [dstEid, setDstEid] = useState<number | null>(null)
  const [nativeFee, setNativeFee] = useState<bigint | null>(null)
  const [feeError, setFeeError] = useState<string | null>(null)

  const fromNetworks = useMemo(() => {
    const configured = listConfiguredGrsChains().map((item) => ({
      chainId: item.chainId,
      name: item.chainName,
    }))
    const listed = configured.length > 0 ? configured : GRS_BRIDGE_SOURCES
    const currentId = evmWallet.isConnected ? evmWallet.chainId : (fromPick ?? config?.chainId)
    if (currentId && !listed.some((item) => item.chainId === currentId)) {
      return [
        {
          chainId: currentId,
          name: config?.chainName ?? evmWallet.chainName ?? `Chain ${currentId}`,
        },
        ...listed,
      ]
    }
    return listed
  }, [
    config?.chainId,
    config?.chainName,
    evmWallet.chainId,
    evmWallet.chainName,
    evmWallet.isConnected,
    fromPick,
  ])

  const fromChainId =
    (evmWallet.isConnected ? evmWallet.chainId : fromPick) ??
    config?.chainId ??
    fromNetworks[0]?.chainId ??
    1
  const fromEid = LZ_EID_BY_CHAIN_ID[fromChainId]
  const decimals = snapshot?.decimals ?? GRS_DECIMALS

  const destinations = useMemo(() => {
    const live = (snapshot?.peers ?? []).map(peerToDest)
    const catalog = live.length > 0 ? live : GRS_BRIDGE_DESTINATIONS
    const testnet = isTestnetChainId(fromChainId)
    return catalog.filter((dest) => {
      if (fromEid && dest.eid === fromEid) return false
      if (dest.chainId && dest.chainId === fromChainId) return false
      if (dest.chainId) return isTestnetChainId(dest.chainId) === testnet
      if (dest.solana) return dest.eid === (testnet ? 40168 : 30168)
      return true
    })
  }, [fromChainId, fromEid, snapshot?.peers])

  const selectedDest = destinations.find((dest) => dest.eid === dstEid) ?? destinations[0] ?? null
  const destIsSolana = selectedDest ? Boolean(selectedDest.solana) || isSolanaLzEid(selectedDest.eid) : false
  const destName = selectedDest?.name

  const recipientCheck = useMemo(
    () => validateBridgeRecipient(recipient, destIsSolana, destName),
    [destIsSolana, destName, recipient],
  )
  const recipientInvalid = recipient.trim().length > 0 && !recipientCheck.ok
  const recipientReady = recipientCheck.ok
  const meAddress = destIsSolana ? solanaWallet.address : evmWallet.address

  useEffect(() => {
    if (selectedDest && dstEid !== selectedDest.eid) setDstEid(selectedDest.eid)
  }, [dstEid, selectedDest])

  const handleFromChange = async (chainId: number) => {
    reset()
    setFromPick(chainId)
    setSelectedChainType('evm')
    if (evmWallet.isConnected && chainId !== evmWallet.chainId) {
      try {
        await evmWallet.switchToChainAsync(chainId)
      } catch {
        /* user rejected */
      }
    }
  }

  useEffect(() => {
    setRecipient((current) => {
      const trimmed = current.trim()
      if (destIsSolana) {
        return trimmed && validateBridgeRecipient(trimmed, true, destName).ok ? current : ''
      }
      if (!trimmed || !validateBridgeRecipient(trimmed, false, destName).ok) {
        return evmWallet.address ?? ''
      }
      return current
    })
  }, [destIsSolana, destName, evmWallet.address])

  useEffect(() => {
    if (!config || !selectedDest) {
      setNativeFee(null)
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
        const to = parseBridgeRecipient(recipient, destIsSolana, destName)
        const amountLD = parseTokenAmount(amount, decimals)
        void quoteGrsBridge(config, selectedDest.eid, to, amountLD)
          .then((fee) => {
            if (!cancelled) {
              setNativeFee(fee)
              setFeeError(null)
            }
          })
          .catch((quoteError) => {
            if (!cancelled) {
              setNativeFee(null)
              setFeeError(quoteError instanceof Error ? quoteError.message : 'Could not quote LayerZero fee')
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
  }, [amount, config, decimals, destIsSolana, destName, recipient, recipientReady, selectedDest])

  const balanceLabel = snapshot ? formatTokenBalance(snapshot.balance, decimals, 6) : '0'
  const maxAmount = snapshot ? formatTokenBalance(snapshot.balance, decimals) : '0'
  const assets = useMemo(
    () => [{ icon: assetUrl('logo.png'), symbol: 'GRS', address: config?.address ?? 'grs' }],
    [config?.address],
  )

  const handleBridge = async () => {
    if (!selectedDest) return
    reset()
    try {
      const result = await run({
        config,
        connectMessage: 'Connect an EVM wallet to bridge GRS',
        chainAction: 'bridge GRS',
        failureMessage: 'Bridge failed',
        amountInput: amount,
        execute: () =>
          executeGrsBridge({
            config: config!,
            dstEid: selectedDest.eid,
            destIsSolana,
            destName,
            recipientInput: recipient,
            amountInput: amount,
            decimals,
          }),
      })
      toastGrsSuccess(`Bridged ${result.amountLabel} GRS to ${selectedDest.name}`, config!.chainId, result.hash)
      setAmount('')
      refresh()
    } catch {
      /* status captured */
    }
  }

  return (
    <>
      <div className="grs-route-row">
        <label className="grai-mint-referrer-field">
          <span className="grai-mint-referrer-label-row">
            <span className="grai-mint-referrer-label">From</span>
            <GraiFieldInfoButton hint="Source chain. Choosing another network switches your wallet before the OFT send." />
          </span>
          <GrsChainSelect
            value={String(fromChainId)}
            ariaLabel="Source chain"
            options={fromNetworks.map((network) => ({
              value: String(network.chainId),
              name: network.name,
            }))}
            onChange={(next) => {
              void handleFromChange(Number(next))
            }}
          />
        </label>
        <span className="grs-route-arrow" aria-hidden="true">
          →
        </span>
        <label className="grai-mint-referrer-field">
          <span className="grai-mint-referrer-label-row">
            <span className="grai-mint-referrer-label">To</span>
            <GraiFieldInfoButton hint="Destination OFT peer. GRS on the far side is the same token, not a new mint." />
          </span>
          <GrsChainSelect
            value={selectedDest ? String(selectedDest.eid) : ''}
            ariaLabel="Destination chain"
            disabled={destinations.length === 0}
            options={
              destinations.length === 0
                ? [{ value: '', name: 'No destinations' }]
                : destinations.map((dest) => ({
                    value: String(dest.eid),
                    name: dest.name,
                    solana: dest.solana || isSolanaLzEid(dest.eid),
                  }))
            }
            onChange={(next) => {
              setDstEid(Number(next))
              reset()
            }}
          />
        </label>
      </div>

      <GraiAmountInput
        label="Amount"
        assets={assets}
        value={amount}
        onValueChange={(value) => {
          setAmount(normalizeDecimalInput(value, decimals))
          reset()
        }}
        balanceLabel={`${balanceLabel} GRS`}
        maxAmount={maxAmount}
        decimals={decimals}
        disabled={!config}
      />

      <label className={`grai-mint-referrer-field${recipientInvalid ? ' is-invalid' : ''}`}>
        <span className="grai-mint-referrer-label-row">
          <span className="grai-mint-referrer-label">
            Receiver on {destName ?? (destIsSolana ? 'Solana' : 'destination')}
          </span>
          <GraiFieldInfoButton
            hint={
              destIsSolana
                ? 'Paste a Solana wallet (base58). An EVM 0x address will not receive GRS on Solana.'
                : `Paste a ${destName ?? 'destination'} EVM address (0x…). A Solana address will not receive GRS on this chain.`
            }
          />
        </span>
        <div className={`grai-mint-referrer-input-row${recipientInvalid ? ' is-invalid' : ''}`}>
          <input
            className={`grai-mint-referrer-input${recipientInvalid ? ' is-invalid' : ''}`}
            value={recipient}
            spellCheck={false}
            autoComplete="off"
            placeholder={destIsSolana ? 'Solana address' : '0x…'}
            aria-invalid={recipientInvalid}
            aria-describedby={recipientInvalid ? 'grs-bridge-recipient-error' : undefined}
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
                ? 'Use connected Solana wallet'
                : 'Use connected EVM wallet'
            }
            aria-label={
              destIsSolana
                ? 'Fill connected Solana address'
                : 'Fill connected EVM address'
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
          <p id="grs-bridge-recipient-error" className="grai-mint-referrer-error" role="alert">
            {recipientCheck.message}
          </p>
        ) : null}
      </label>

      <div className="grai-action-metrics" aria-live="polite">
        <div className="grai-action-metric-row">
          <span className="grai-action-metric-label-wrap">
            <GraiFieldInfoButton
              className="grai-action-metric-label-info"
              hint="Native gas paid to LayerZero for the OFT send. Quoted on-chain from quoteBridge."
            />
            <span className="grai-action-metric-label">LZ fee</span>
          </span>
          <span className="grai-action-metric-value">
            {nativeFee != null
              ? `${formatEther(nativeFee)} ETH`
              : feeError
                ? '—'
                : isLoading
                  ? '…'
                  : '—'}
          </span>
        </div>
      </div>

      <GrsFeedback
        isPending={isPending}
        pendingLabel="Bridging GRS…"
        error={error}
        hash={lastHash}
        chainId={config?.chainId}
        successLabel="Bridge sent."
      />

      <GrsSubmit
        connected={evmWallet.isConnected}
        disabled={!config || !selectedDest || !amount.trim() || !recipientReady}
        pending={isPending}
        label="Bridge"
        onClick={() => {
          void handleBridge()
        }}
      />
    </>
  )
}
