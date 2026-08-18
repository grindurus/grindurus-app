import { useEffect, useMemo, useState } from 'react'
import { erc20Abi, formatEther, isAddress } from 'viem'
import { GraiAmountInput } from '../grai/GraiAmountInput'
import { GraiFieldInfoButton } from '../grai/GraiFieldInfo'
import { useEvmWallet } from '../../hooks/useEvmWallet'
import { useGrsEvmTransaction } from '../../hooks/useGrsEvmTransaction'
import { formatTokenBalance, normalizeDecimalInput, parseTokenAmount } from '../../grai/onchain'
import { assetUrl } from '../../utils/appPaths'
import {
  evmAddressToBytes32,
  parseSaleAsset,
  ZERO_BYTES32,
} from '../../grs/bytes32'
import {
  GRS_BRIDGE_DESTINATIONS,
  GRS_DECIMALS,
  isSolanaLzEid,
  isTestnetChainId,
} from '../../grs/constants'
import { executeGrsSale } from '../../grs/evm/executeTransactions'
import { createGrsEvmPublicClient } from '../../grs/evm/client'
import { quoteGrsSale } from '../../grs/evm/readProtocol'
import type { GrsEvmConfig } from '../../grs/deployments'
import type { GrsSnapshot } from '../../grs/evm/readProtocol'
import { GrsFeedback, GrsSubmit, toastGrsSuccess } from './GrsActionBits'

type Props = {
  config: GrsEvmConfig | null
  snapshot: GrsSnapshot | null
  refresh: () => void
}

function isNativeAssetInput(input: string): boolean {
  const trimmed = input.trim()
  return !trimmed || trimmed.toUpperCase() === 'ETH' || trimmed === '0' || /^0x0+$/i.test(trimmed)
}

export function GrsListSalePanel({ config, snapshot, refresh }: Props) {
  const evmWallet = useEvmWallet()
  const { run, reset, error, lastHash, isPending } = useGrsEvmTransaction()
  const [grsAmount, setGrsAmount] = useState('')
  const [assetInput, setAssetInput] = useState('ETH')
  const [assetAmount, setAssetAmount] = useState('')
  const [assetDecimals, setAssetDecimals] = useState(18)
  const [recipient, setRecipient] = useState('')
  const [dstEid, setDstEid] = useState(0)
  const [nativeFee, setNativeFee] = useState<bigint | null>(null)

  const decimals = snapshot?.decimals ?? GRS_DECIMALS
  const remaining = snapshot?.tokenSalesRemaining ?? null
  const maxAmount = remaining != null && remaining > 0n ? formatTokenBalance(remaining, decimals) : ''
  const remainingLabel = remaining == null ? '—' : formatTokenBalance(remaining, decimals, 2)
  const nativeQuote = isNativeAssetInput(assetInput)
  const quoteSymbol = nativeQuote ? 'ETH' : 'token'

  const assets = useMemo(
    () => [{ icon: assetUrl('logo.png'), symbol: 'GRS', address: config?.address ?? 'grs' }],
    [config?.address],
  )

  const destinations = useMemo(() => {
    const live = snapshot?.peers ?? []
    const catalog =
      live.length > 0
        ? live.map((peer) => ({ eid: peer.eid, name: peer.name, chainId: peer.chainId, solana: peer.solana }))
        : GRS_BRIDGE_DESTINATIONS
    const homeId = config?.chainId
    const testnet = homeId ? isTestnetChainId(homeId) : false
    return catalog.filter((dest) => {
      if (dest.chainId && dest.chainId === homeId) return false
      if (dest.chainId) return isTestnetChainId(dest.chainId) === testnet
      if (dest.solana) return dest.eid === (testnet ? 40168 : 30168)
      return true
    })
  }, [config?.chainId, snapshot?.peers])

  useEffect(() => {
    if (nativeQuote || !config) {
      setAssetDecimals(18)
      return
    }
    const trimmed = assetInput.trim()
    if (!isAddress(trimmed)) {
      setAssetDecimals(18)
      return
    }
    let cancelled = false
    const client = createGrsEvmPublicClient(config)
    void client
      .readContract({
        address: trimmed,
        abi: erc20Abi,
        functionName: 'decimals',
      })
      .then((value) => {
        if (!cancelled) setAssetDecimals(Number(value))
      })
      .catch(() => {
        if (!cancelled) setAssetDecimals(18)
      })
    return () => {
      cancelled = true
    }
  }, [assetInput, config, nativeQuote])

  useEffect(() => {
    if (!config || dstEid === 0) {
      setNativeFee(0n)
      return
    }
    let cancelled = false
    const handle = window.setTimeout(() => {
      try {
        if (!grsAmount.trim() || !assetAmount.trim()) {
          if (!cancelled) setNativeFee(null)
          return
        }
        const asset = parseSaleAsset(assetInput)
        const grsRaw = parseTokenAmount(grsAmount, decimals)
        const quoteRaw = parseTokenAmount(assetAmount, assetDecimals)
        const payee = recipient.trim() ? evmAddressToBytes32(recipient) : ZERO_BYTES32
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
  }, [assetAmount, assetDecimals, assetInput, config, decimals, dstEid, grsAmount, recipient])

  const handleList = async () => {
    if (!config) return
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
            decimals,
          }),
      })
      toastGrsSuccess(`Listed ${result.amountLabel} GRS`, config.chainId, result.hash)
      setGrsAmount('')
      setAssetAmount('')
      refresh()
    } catch {
      /* status captured */
    }
  }

  const recipientOk = !recipient.trim() || isAddress(recipient.trim())
  const destIsSolana = isSolanaLzEid(dstEid)
  const canSubmit =
    Boolean(config) &&
    Boolean(snapshot?.home) &&
    grsAmount.trim() !== '' &&
    assetAmount.trim() !== '' &&
    recipientOk &&
    !destIsSolana

  return (
    <>
      {snapshot && !snapshot.home ? (
        <p className="grs-preview-note">sale() is home-only. Switch to the home chain to list.</p>
      ) : null}

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
          <span className="grai-mint-referrer-label">Quote asset</span>
          <GraiFieldInfoButton hint="sale.asset: bytes32(0) is native ETH. Else left-padded ERC-20 address." />
        </span>
        <input
          className="grai-mint-referrer-input"
          value={assetInput}
          spellCheck={false}
          placeholder="ETH or 0x…"
          onChange={(event) => {
            setAssetInput(event.target.value)
            reset()
          }}
        />
      </label>

      <label className="grai-mint-referrer-field">
        <span className="grai-mint-referrer-label-row">
          <span className="grai-mint-referrer-label">Quote amount</span>
          <GraiFieldInfoButton hint="sale.assetAmount: remaining quote units the seller wants for remaining GRS." />
        </span>
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
      </label>

      <label className="grai-mint-referrer-field">
        <span className="grai-mint-referrer-label-row">
          <span className="grai-mint-referrer-label">Proceeds recipient</span>
          <GraiFieldInfoButton hint="sale.recipient: bytes32(0) pays owner() at buy. EVM address left-padded." />
        </span>
        <input
          className={`grai-mint-referrer-input${recipientOk ? '' : ' is-invalid'}`}
          value={recipient}
          spellCheck={false}
          placeholder="owner() · 0x…"
          onChange={(event) => {
            setRecipient(event.target.value)
            reset()
          }}
        />
      </label>

      <label className="grai-mint-referrer-field">
        <span className="grai-mint-referrer-label-row">
          <span className="grai-mint-referrer-label">Destination</span>
          <GraiFieldInfoButton hint="sale.dstEid: 0 keeps the lot on home. Else burns TokenSales GRS and LZ-publishes so the spoke mints escrow." />
        </span>
        <select
          className="grai-mint-referrer-input"
          value={dstEid}
          onChange={(event) => {
            setDstEid(Number(event.target.value))
            reset()
          }}
          aria-label="Sale destination"
        >
          <option value={0}>Home (local)</option>
          {destinations.map((dest) => (
            <option key={dest.eid} value={dest.eid}>
              {dest.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grai-action-metrics" aria-live="polite">
        <div className="grai-action-metric-row">
          <span className="grai-action-metric-label">You ask</span>
          <span className="grai-action-metric-value">
            {assetAmount.trim() ? `${assetAmount} ${quoteSymbol}` : `— ${quoteSymbol}`}
          </span>
        </div>
        {dstEid !== 0 ? (
          <div className="grai-action-metric-row">
            <span className="grai-action-metric-label">LZ fee</span>
            <span className="grai-action-metric-value">
              {nativeFee == null ? '—' : `${formatEther(nativeFee)} ETH`}
            </span>
          </div>
        ) : null}
      </div>

      {destIsSolana ? (
        <p className="grai-manage-feedback is-error">
          EVM sale() can publish to an EVM spoke. Solana listings use the Solana program.
        </p>
      ) : null}

      <GrsFeedback
        isPending={isPending}
        pendingLabel="Listing sale…"
        error={error}
        hash={lastHash}
        chainId={config?.chainId}
        successLabel="Sale listed."
      />

      <GrsSubmit
        connected={evmWallet.isConnected}
        disabled={!canSubmit}
        pending={isPending}
        label={dstEid === 0 ? 'List sale' : 'Publish sale'}
        onClick={() => {
          void handleList()
        }}
      />
    </>
  )
}
