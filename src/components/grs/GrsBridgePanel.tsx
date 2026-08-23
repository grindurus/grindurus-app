import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { formatEther } from 'viem'
import { GraiAmountInput } from '../grai/GraiAmountInput'
import { GraiFieldInfoButton } from '../grai/GraiFieldInfo'
import { useEvmWallet } from '../../hooks/useEvmWallet'
import { useSolanaWallet } from '../../hooks/useSolanaWallet'
import { useGrsEvmTransaction } from '../../hooks/useGrsEvmTransaction'
import { useGrsSolanaTransaction } from '../../hooks/useGrsSolanaTransaction'
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
import { executeSolanaGrsBridge, quoteSolanaGrsBridge } from '../../grs/solana/bridge'
import {
  createGrsSolanaConnection,
  getDefaultGrsSolanaCluster,
  layerZeroScanTxUrl,
  listConfiguredGrsChains,
  resolveGrsEvmConfig,
  resolveGrsSolanaConfig,
  type GrsConfig,
} from '../../grs/deployments'
import type { GrsPeer, GrsSnapshot } from '../../grs/evm/readProtocol'
import { ActionDepositNote, usePersistedActionTx } from '../ActionTxFeedback'
import { GrsChainGlyph } from './GrsChainGlyph'
import { GrsSubmit, toastGrsSuccess } from './GrsActionBits'

type Props = {
  config: GrsConfig | null
  snapshot: GrsSnapshot | null
  isLoading: boolean
  refresh: () => void
  note?: ReactNode
}

const SOLANA_FROM = 'solana'

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
            const active = option.value === value
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

function formatSolFee(lamports: bigint): string {
  const whole = lamports / 1_000_000_000n
  const frac = (lamports % 1_000_000_000n).toString().padStart(9, '0').replace(/0+$/, '')
  return frac ? `${whole}.${frac} SOL` : `${whole} SOL`
}

export function GrsBridgePanel({ config, snapshot, isLoading, refresh, note }: Props) {
  const evmWallet = useEvmWallet()
  const solanaWallet = useSolanaWallet()
  const { setSelectedChainType, setSolanaCluster } = useWalletContext()
  const evmTx = useGrsEvmTransaction()
  const solTx = useGrsSolanaTransaction()
  const { lastTx, lastError, begin, succeed, fail } = usePersistedActionTx()
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [fromPick, setFromPick] = useState<string | null>(null)
  const [dstEid, setDstEid] = useState<number | null>(null)
  const [nativeFee, setNativeFee] = useState<bigint | null>(null)
  const [feeError, setFeeError] = useState<string | null>(null)

  const solanaConfig =
    config?.kind === 'solana' ? config : resolveGrsSolanaConfig(getDefaultGrsSolanaCluster())

  const fromNetworks = useMemo(() => {
    const configured = listConfiguredGrsChains().map((item) => ({
      value: String(item.chainId),
      name: item.chainName,
      solana: false as boolean,
    }))
    const listed = configured.length > 0 ? configured : GRS_BRIDGE_SOURCES.map((s) => ({
      value: String(s.chainId),
      name: s.name,
      solana: false,
    }))
    const withSolana = solanaConfig
      ? [
          ...listed,
          {
            value: SOLANA_FROM,
            name: solanaConfig.cluster === 'mainnet-beta' ? 'Solana' : `Solana ${solanaConfig.cluster}`,
            solana: true,
          },
        ]
      : listed
    return withSolana
  }, [solanaConfig])

  const fromValue = useMemo(() => {
    if (fromPick) return fromPick
    if (config?.kind === 'solana') return SOLANA_FROM
    if (evmWallet.isConnected && evmWallet.chainId) return String(evmWallet.chainId)
    if (config?.kind === 'evm') return String(config.chainId)
    if (solanaWallet.isConnected && solanaConfig) return SOLANA_FROM
    return fromNetworks[0]?.value ?? String(11155111)
  }, [
    config,
    evmWallet.chainId,
    evmWallet.isConnected,
    fromNetworks,
    fromPick,
    solanaConfig,
    solanaWallet.isConnected,
  ])

  const sourceIsSolana = fromValue === SOLANA_FROM
  const fromChainId = sourceIsSolana ? null : Number(fromValue)
  const fromEid =
    fromChainId != null
      ? LZ_EID_BY_CHAIN_ID[fromChainId]
      : sourceIsSolana
        ? solanaConfig?.cluster === 'mainnet-beta'
          ? 30168
          : 40168
        : undefined
  const activeConfig: GrsConfig | null = sourceIsSolana
    ? solanaConfig
    : fromChainId != null
      ? resolveGrsEvmConfig(fromChainId)
      : null
  const decimals =
    activeConfig?.kind === 'solana'
      ? (snapshot?.decimals ?? 9)
      : (snapshot?.decimals ?? GRS_DECIMALS)

  const destinations = useMemo(() => {
    const live = (snapshot?.peers ?? []).map(peerToDest)
    const catalog = live.length > 0 ? live : GRS_BRIDGE_DESTINATIONS
    const testnet = sourceIsSolana
      ? solanaConfig?.cluster !== 'mainnet-beta'
      : isTestnetChainId(fromChainId ?? 11155111)
    return catalog.filter((dest) => {
      if (fromEid && dest.eid === fromEid) return false
      if (sourceIsSolana && (dest.solana || isSolanaLzEid(dest.eid))) return false
      if (!sourceIsSolana && dest.chainId && fromChainId && dest.chainId === fromChainId) return false
      if (dest.chainId) return isTestnetChainId(dest.chainId) === testnet
      if (dest.solana) return dest.eid === (testnet ? 40168 : 30168)
      return true
    })
  }, [fromChainId, fromEid, snapshot?.peers, solanaConfig?.cluster, sourceIsSolana])

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

  const isPending = sourceIsSolana ? solTx.isPending : evmTx.isPending
  const liveError = sourceIsSolana ? solTx.error : evmTx.error
  const error = liveError ?? lastError
  const feedbackHash = lastTx?.hash ?? (sourceIsSolana ? solTx.lastSignature : evmTx.lastHash)
  const clearLiveTx = () => {
    evmTx.reset()
    solTx.reset()
  }

  useEffect(() => {
    if (selectedDest && dstEid !== selectedDest.eid) setDstEid(selectedDest.eid)
  }, [dstEid, selectedDest])

  const handleFromChange = async (value: string) => {
    clearLiveTx()
    setFromPick(value)
    if (value === SOLANA_FROM) {
      setSelectedChainType('solana')
      if (solanaConfig) setSolanaCluster(solanaConfig.cluster)
      return
    }
    const chainId = Number(value)
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
        if (trimmed && validateBridgeRecipient(trimmed, true, destName).ok) return current
        return solanaWallet.address || ''
      }
      if (!trimmed || !validateBridgeRecipient(trimmed, false, destName).ok) {
        return evmWallet.address ?? ''
      }
      return current
    })
  }, [destIsSolana, destName, evmWallet.address, solanaWallet.address])

  useEffect(() => {
    if (!selectedDest) {
      setNativeFee(null)
      return
    }
    let cancelled = false
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          if (!amount.trim() || amount === '0' || amount === '0.' || !recipientReady) {
            if (!cancelled) {
              setNativeFee(null)
              setFeeError(null)
            }
            return
          }
          const amountLD = parseTokenAmount(amount, decimals)
          if (sourceIsSolana) {
            if (!solanaConfig || !solanaWallet.publicKey) {
              if (!cancelled) {
                setNativeFee(null)
                setFeeError(null)
              }
              return
            }
            const to = parseBridgeRecipient(recipient, destIsSolana, destName)
            const fee = await quoteSolanaGrsBridge({
              connection: createGrsSolanaConnection(solanaConfig),
              config: solanaConfig,
              payer: solanaWallet.publicKey,
              dstEid: selectedDest.eid,
              to: new Uint8Array(Buffer.from(to.slice(2), 'hex')),
              amountLd: amountLD,
            })
            if (!cancelled) {
              setNativeFee(fee)
              setFeeError(null)
            }
            return
          }
          if (!activeConfig || activeConfig.kind !== 'evm') {
            if (!cancelled) setNativeFee(null)
            return
          }
          const to = parseBridgeRecipient(recipient, destIsSolana, destName)
          const fee = await quoteGrsBridge(activeConfig, selectedDest.eid, to, amountLD)
          if (!cancelled) {
            setNativeFee(fee)
            setFeeError(null)
          }
        } catch (quoteError) {
          if (!cancelled) {
            setNativeFee(null)
            setFeeError(quoteError instanceof Error ? quoteError.message : 'Could not quote LayerZero fee')
          }
        }
      })()
    }, 280)

    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [
    activeConfig,
    amount,
    decimals,
    destIsSolana,
    destName,
    recipient,
    recipientReady,
    selectedDest,
    solanaConfig,
    solanaWallet.publicKey,
    sourceIsSolana,
  ])

  const balanceLabel = snapshot ? formatTokenBalance(snapshot.balance, decimals, 6) : '0'
  const maxAmount = snapshot ? formatTokenBalance(snapshot.balance, decimals) : '0'
  const tokenAddress =
    activeConfig?.kind === 'solana'
      ? activeConfig.mint.toBase58()
      : activeConfig?.kind === 'evm'
        ? activeConfig.address
        : 'grs'
  const assets = useMemo(
    () => [{ icon: assetUrl('logo.png'), symbol: 'GRS', address: tokenAddress }],
    [tokenAddress],
  )

  const lzScanTestnet = sourceIsSolana
    ? solanaConfig?.cluster !== 'mainnet-beta'
    : isTestnetChainId(fromChainId ?? 0)
  const feedbackHref =
    lastTx?.href ?? (feedbackHash ? layerZeroScanTxUrl(feedbackHash, lzScanTestnet) : null)

  const handleBridge = async () => {
    if (!selectedDest) return
    begin()
    clearLiveTx()
    try {
      if (sourceIsSolana) {
        if (!solanaConfig) throw new Error('Solana GRS is not configured')
        const toHex = parseBridgeRecipient(recipient, destIsSolana, destName)
        const to = new Uint8Array(Buffer.from(toHex.slice(2), 'hex'))
        const result = await solTx.run({
          connectMessage: 'Connect a Solana wallet to bridge GRS',
          clusterAction: 'bridge GRS',
          failureMessage: 'Bridge failed',
          amountInput: amount,
          execute: (ctx) =>
            executeSolanaGrsBridge({
              ...ctx,
              dstEid: selectedDest.eid,
              to,
              amountInput: amount,
              decimals,
            }),
        })
        const href = layerZeroScanTxUrl(result.signature, lzScanTestnet)
        succeed({ hash: result.signature, href, successLabel: 'Bridge sent.', linkLabel: 'LayerZero Scan' })
        toastGrsSuccess(
          `Bridged ${result.amountLabel} GRS to ${selectedDest.name}`,
          solanaConfig,
          result.signature,
          {
            href,
            linkLabel: 'View on LayerZero Scan',
          },
        )
      } else {
        if (!activeConfig || activeConfig.kind !== 'evm') throw new Error('Select an EVM GRS source')
        const result = await evmTx.run({
          config: activeConfig,
          connectMessage: 'Connect an EVM wallet to bridge GRS',
          chainAction: 'bridge GRS',
          failureMessage: 'Bridge failed',
          amountInput: amount,
          execute: () =>
            executeGrsBridge({
              config: activeConfig,
              dstEid: selectedDest.eid,
              destIsSolana,
              destName,
              recipientInput: recipient,
              amountInput: amount,
              decimals,
            }),
        })
        const href = layerZeroScanTxUrl(result.hash, isTestnetChainId(activeConfig.chainId))
        succeed({ hash: result.hash, href, successLabel: 'Bridge sent.', linkLabel: 'LayerZero Scan' })
        toastGrsSuccess(
          `Bridged ${result.amountLabel} GRS to ${selectedDest.name}`,
          activeConfig.chainId,
          result.hash,
          {
            href,
            linkLabel: 'View on LayerZero Scan',
          },
        )
      }
      setAmount('')
      refresh()
    } catch (bridgeError) {
      fail(bridgeError, 'Bridge failed')
    }
  }

  const walletConnected = sourceIsSolana ? solanaWallet.isConnected : evmWallet.isConnected

  return (
    <>
      <div className="grs-route-row">
        <label className="grai-mint-referrer-field">
          <span className="grai-mint-referrer-label-row">
            <span className="grai-mint-referrer-label">From</span>
            <GraiFieldInfoButton hint="Source chain (home or spoke). OFT burn/lock here and credit on destination." />
          </span>
          <GrsChainSelect
            value={fromValue}
            ariaLabel="Source chain"
            options={fromNetworks}
            onChange={(next) => {
              void handleFromChange(next)
            }}
          />
        </label>
        <span className="grs-route-arrow" aria-hidden="true">
          →
        </span>
        <label className="grai-mint-referrer-field">
          <span className="grai-mint-referrer-label-row">
            <span className="grai-mint-referrer-label">To</span>
            <GraiFieldInfoButton hint="Destination OFT peer. Same GRS supply — mint/burn across chains." />
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
        }}
        balanceLabel={`${balanceLabel} GRS`}
        maxAmount={maxAmount}
        decimals={decimals}
        disabled={!activeConfig}
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
                : `Paste a ${destName ?? 'destination'} EVM address (0x…).`
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
                : 'Use connected EVM wallet'
            }
            aria-label={destIsSolana ? 'Fill connected Solana address' : 'Fill connected EVM address'}
            onClick={() => {
              if (!meAddress) return
              setRecipient(meAddress)
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
              hint="Native gas paid to LayerZero for the OFT send (ETH on EVM sources, SOL on Solana)."
            />
            <span className="grai-action-metric-label">LZ fee</span>
          </span>
          <span className="grai-action-metric-value">
            {nativeFee != null
              ? sourceIsSolana
                ? formatSolFee(nativeFee)
                : `${formatEther(nativeFee)} ETH`
              : isLoading
                ? '…'
                : '—'}
          </span>
        </div>
      </div>

      {feeError ? (
        <p className="grai-manage-feedback is-error" role="alert">
          {feeError}
        </p>
      ) : null}

      <GrsSubmit
        connected={walletConnected}
        disabled={!activeConfig || !selectedDest || !amount.trim() || !recipientReady}
        pending={isPending}
        label="Bridge"
        onClick={() => {
          void handleBridge()
        }}
      />

      <ActionDepositNote
        isPending={isPending}
        pendingLabel="Bridging GRS…"
        error={error}
        hash={feedbackHash}
        config={activeConfig}
        chainId={activeConfig?.kind === 'evm' ? activeConfig.chainId : undefined}
        successLabel={lastTx?.successLabel ?? 'Bridge sent.'}
        txHref={feedbackHref}
        linkLabel={lastTx?.linkLabel ?? 'LayerZero Scan'}
      >
        {note}
      </ActionDepositNote>
    </>
  )
}
