import { useEffect, useMemo, useState } from 'react'
import { formatEther } from 'viem'
import { GraiAmountInput } from '../grai/GraiAmountInput'
import { GraiFieldInfoButton } from '../grai/GraiFieldInfo'
import { useEvmWallet } from '../../hooks/useEvmWallet'
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

export function GrsBridgePanel({ config, snapshot, isLoading, refresh }: Props) {
  const evmWallet = useEvmWallet()
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
          <select
            className="grai-mint-referrer-input"
            value={fromChainId}
            onChange={(event) => {
              void handleFromChange(Number(event.target.value))
            }}
            aria-label="Source chain"
          >
            {fromNetworks.map((network) => (
              <option key={network.chainId} value={network.chainId}>
                {network.name}
              </option>
            ))}
          </select>
        </label>
        <span className="grs-route-arrow" aria-hidden="true">
          →
        </span>
        <label className="grai-mint-referrer-field">
          <span className="grai-mint-referrer-label-row">
            <span className="grai-mint-referrer-label">To</span>
            <GraiFieldInfoButton hint="Destination OFT peer. GRS on the far side is the same token, not a new mint." />
          </span>
          <select
            className="grai-mint-referrer-input"
            value={selectedDest?.eid ?? ''}
            disabled={destinations.length === 0}
            onChange={(event) => {
              setDstEid(Number(event.target.value))
              reset()
            }}
            aria-label="Destination chain"
          >
            {destinations.length === 0 ? <option value="">No destinations</option> : null}
            {destinations.map((dest) => (
              <option key={dest.eid} value={dest.eid}>
                {dest.name}
              </option>
            ))}
          </select>
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
        label={selectedDest ? `Bridge to ${selectedDest.name}` : 'Bridge'}
        onClick={() => {
          void handleBridge()
        }}
      />
    </>
  )
}
