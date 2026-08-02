import { useCallback, useEffect, useMemo, useState } from 'react'
import { isAddress, zeroAddress } from 'viem'
import { toast } from 'react-toastify'
import { useGraiDeployment } from '../../grai/GraiDeploymentProvider'
import { graiAbi, grindersAbi } from '../../grai/evm/abi'
import { createGraiEvmPublicClient, resolveGraiContractAddress } from '../../grai/evm/client'
import { KNOWN_CUSTODIAN_KINDS, type CustodianKindOption } from '../../grai/evm/custodianKinds'
import { useActiveWallet } from '../../hooks/useActiveWallet'
import { useEvmWallet } from '../../hooks/useEvmWallet'
import { useGraiGrindersMint } from '../../hooks/useGraiGrindersMint'
import { shortenAddress } from '../../utils/shortenAddress'
import { GraiActionConnectWalletButton } from './GraiWalletAction'
import { GraiTransactionToast } from './GraiTransactionToast'

type KindAvailability = Record<CustodianKindOption['id'], boolean>

type GrindersMintMeta = {
  grindersAddress: `0x${string}`
  owner: `0x${string}`
  nextId: bigint
  kindAvailable: KindAvailability
}

export function GraiMintCustodianForm() {
  const { chainKind, evm, explorerTxUrl } = useGraiDeployment()
  const activeWallet = useActiveWallet()
  const evmWallet = useEvmWallet()
  const { mint, isMinting, reset } = useGraiGrindersMint()

  const [kindId, setKindId] = useState<CustodianKindOption['id']>('cow')
  const [ownerInput, setOwnerInput] = useState('')
  const [baseAsset, setBaseAsset] = useState('')
  const [quoteAsset, setQuoteAsset] = useState('')
  const [meta, setMeta] = useState<GrindersMintMeta | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const isWalletConnected = activeWallet.isConnected
  const isEvm = chainKind === 'evm'
  const walletAddress = isEvm && isWalletConnected ? evmWallet.address || null : null

  const selectedKind = useMemo(
    () => KNOWN_CUSTODIAN_KINDS.find((kind) => kind.id === kindId) ?? KNOWN_CUSTODIAN_KINDS[0],
    [kindId],
  )

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
      const grindersAddress = await client.readContract({
        address: graiAddress,
        abi: graiAbi,
        functionName: 'grinders',
      })

      if (!grindersAddress || grindersAddress === zeroAddress) {
        setMeta(null)
        setLoadError('Grinders is not set on this GRAI deployment')
        return
      }

      const [owner, nextId, ...impls] = await Promise.all([
        client.readContract({ address: grindersAddress, abi: grindersAbi, functionName: 'owner' }),
        client.readContract({
          address: grindersAddress,
          abi: grindersAbi,
          functionName: 'totalSupply',
        }),
        ...KNOWN_CUSTODIAN_KINDS.map((kind) =>
          client.readContract({
            address: grindersAddress,
            abi: grindersAbi,
            functionName: 'custodianImplementations',
            args: [kind.kindHash],
          }),
        ),
      ])

      const kindAvailable = KNOWN_CUSTODIAN_KINDS.reduce((acc, kind, index) => {
        const impl = impls[index]
        acc[kind.id] = Boolean(impl && impl !== zeroAddress)
        return acc
      }, {} as KindAvailability)

      setMeta({ grindersAddress, owner, nextId, kindAvailable })
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

  const isOwner = Boolean(
    walletAddress && meta && walletAddress.toLowerCase() === meta.owner.toLowerCase(),
  )

  const kindRegistered = meta ? meta.kindAvailable[selectedKind.id] : false

  const canSubmit =
    isEvm &&
    isWalletConnected &&
    !isMinting &&
    !isLoading &&
    Boolean(meta) &&
    isOwner &&
    kindRegistered &&
    isAddress(baseAsset.trim()) &&
    isAddress(quoteAsset.trim()) &&
    baseAsset.trim().toLowerCase() !== quoteAsset.trim().toLowerCase()

  const handleUseConnectedOwner = () => {
    if (!walletAddress) return
    setOwnerInput(walletAddress)
    reset()
  }

  const handleSubmit = async () => {
    const toastId = toast.loading('Minting custodian…')
    try {
      const signature = await mint({
        custodianKind: selectedKind.kindHash,
        ownerInput,
        baseAssetInput: baseAsset,
        quoteAssetInput: quoteAsset,
      })
      toast.update(toastId, {
        render: (
          <GraiTransactionToast
            message="Custodian minted"
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
        render: error instanceof Error ? error.message : 'Grinders mint transaction failed',
        type: 'error',
        isLoading: false,
        autoClose: 8000,
        closeOnClick: true,
      })
    }
  }

  return (
    <div className="grai-manage-mint-custodian-form" id="grai-manage-mint-custodian">
      <div className="grai-action-result-group grai-liquidation-yield-results">
        <div className="grai-action-result" aria-live="polite">
          <span className="grai-action-result-label-wrap">
            <span className="grai-action-result-label">Next ID:</span>
          </span>
          <span className="grai-action-result-value">
            {isLoading ? '…' : (meta?.nextId.toString() ?? '—')}
          </span>
        </div>
        <div className="grai-action-result" aria-live="polite">
          <span className="grai-action-result-label-wrap">
            <span className="grai-action-result-label">Owner:</span>
          </span>
          <span className="grai-action-result-value" title={meta?.owner}>
            {isLoading ? '…' : meta ? shortenAddress(meta.owner) : '—'}
          </span>
        </div>
      </div>

      <div className="grai-manage-mint-kind-field">
        <span className="grai-field-label" id="grai-mint-custodian-kind-label">
          Custodian kind
        </span>
        <div
          className="grai-manage-mint-kind-options"
          role="radiogroup"
          aria-labelledby="grai-mint-custodian-kind-label"
        >
          {KNOWN_CUSTODIAN_KINDS.map((kind) => {
            const available = meta?.kindAvailable[kind.id]
            return (
              <button
                key={kind.id}
                type="button"
                role="radio"
                aria-checked={kindId === kind.id}
                className={`grai-manage-mint-kind-btn${kindId === kind.id ? ' is-active' : ''}${
                  available === false ? ' is-unavailable' : ''
                }`}
                title={
                  available === false
                    ? `${kind.label} implementation is not registered`
                    : kind.source
                }
                onClick={() => {
                  setKindId(kind.id)
                  reset()
                }}
              >
                {kind.label}
                {available === false ? ' · unset' : ''}
              </button>
            )
          })}
        </div>
      </div>

      <label className="grai-manage-mint-field" htmlFor="grai-mint-custodian-owner">
        <span className="grai-field-label">NFT owner</span>
        <div className="grai-input-with-suffix has-max">
          <input
            id="grai-mint-custodian-owner"
            type="text"
            className="grai-input"
            placeholder="0x… (empty = protocol owner)"
            value={ownerInput}
            onChange={(event) => {
              setOwnerInput(event.target.value)
              reset()
            }}
            spellCheck={false}
            autoComplete="off"
          />
          <button
            type="button"
            className="grai-input-max-btn"
            disabled={!walletAddress}
            onClick={handleUseConnectedOwner}
          >
            ME
          </button>
        </div>
      </label>

      <div className="grai-mint-amount-block grai-manage-mint-assets-card">
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
                  <circle cx="9" cy="12" r="5" />
                  <circle cx="15" cy="12" r="5" />
                </svg>
              </span>
              Trading pair
            </span>
          </div>

          <div className="grai-manage-mint-assets">
            <label className="grai-manage-mint-asset-field" htmlFor="grai-mint-custodian-base">
              <span className="grai-field-label">Base</span>
              <div className="grai-manage-mint-asset-input-wrap">
                <input
                  id="grai-mint-custodian-base"
                  type="text"
                  className="grai-input grai-manage-mint-asset-input"
                  placeholder="0x… or 0x0"
                  value={baseAsset}
                  onChange={(event) => {
                    setBaseAsset(event.target.value)
                    reset()
                  }}
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
            </label>

            <span className="grai-manage-mint-assets-sep" aria-hidden="true">
              /
            </span>

            <label className="grai-manage-mint-asset-field" htmlFor="grai-mint-custodian-quote">
              <span className="grai-field-label">Quote</span>
              <div className="grai-manage-mint-asset-input-wrap">
                <input
                  id="grai-mint-custodian-quote"
                  type="text"
                  className="grai-input grai-manage-mint-asset-input"
                  placeholder="0x…"
                  value={quoteAsset}
                  onChange={(event) => {
                    setQuoteAsset(event.target.value)
                    reset()
                  }}
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
            </label>
          </div>
        </div>
      </div>

      {loadError && <p className="grai-manage-feedback is-error">{loadError}</p>}
      {!isLoading && meta && !isOwner && isWalletConnected && (
        <p className="grai-manage-feedback is-error">
          Connected wallet is not the Grinders owner.
        </p>
      )}
      {!isLoading && meta && !kindRegistered && (
        <p className="grai-manage-feedback is-error">
          {selectedKind.label} implementation is not registered on Grinders.
        </p>
      )}

      <div className="grai-action-submit grai-liquidation-step-actions">
        {isWalletConnected ? (
          <button
            type="button"
            className="grai-mint-btn"
            disabled={!canSubmit}
            title={
              !isEvm
                ? 'Switch to an EVM network to mint a custodian'
                : !meta
                  ? loadError ?? 'Grinders unavailable'
                  : !isOwner
                    ? 'Only the Grinders owner can mint'
                    : !kindRegistered
                      ? `${selectedKind.label} kind is not registered`
                      : undefined
            }
            onClick={() => {
              void handleSubmit()
            }}
          >
            {isMinting ? 'Minting…' : 'Mint custodian'}
          </button>
        ) : (
          <GraiActionConnectWalletButton />
        )}
        <span className="grai-liquidation-step-hint">
          Deploys a custodian proxy, mints Grinder NFT #{' '}
          {isLoading ? '…' : (meta?.nextId.toString() ?? '—')}, and sets base/quote. Empty owner uses
          the protocol owner.
        </span>
      </div>
    </div>
  )
}
