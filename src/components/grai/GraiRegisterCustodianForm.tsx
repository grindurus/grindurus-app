import { useCallback, useEffect, useState } from 'react'
import { isAddress, zeroAddress } from 'viem'
import { toast } from 'react-toastify'
import { useGraiDeployment } from '../../grai/GraiDeploymentProvider'
import { graiAbi, grindersAbi } from '../../grai/evm/abi'
import { createGraiEvmPublicClient, resolveGraiContractAddress } from '../../grai/evm/client'
import { useActiveWallet } from '../../hooks/useActiveWallet'
import { useEvmWallet } from '../../hooks/useEvmWallet'
import { useGraiGrindersRegister } from '../../hooks/useGraiGrindersRegister'
import { shortenAddress } from '../../utils/shortenAddress'
import { GraiActionConnectWalletButton } from './GraiWalletAction'
import { GraiTransactionToast } from './GraiTransactionToast'

type GrindersRegisterMeta = {
  grindersAddress: `0x${string}`
  owner: `0x${string}`
  nextId: bigint
}

export function GraiRegisterCustodianForm() {
  const { chainKind, evm, explorerTxUrl } = useGraiDeployment()
  const activeWallet = useActiveWallet()
  const evmWallet = useEvmWallet()
  const { register, isRegistering, reset } = useGraiGrindersRegister()

  const [custodianInput, setCustodianInput] = useState('')
  const [ownerInput, setOwnerInput] = useState('')
  const [alreadyRegistered, setAlreadyRegistered] = useState<boolean | null>(null)
  const [meta, setMeta] = useState<GrindersRegisterMeta | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const isWalletConnected = activeWallet.isConnected
  const isEvm = chainKind === 'evm'
  const walletAddress = isEvm && isWalletConnected ? evmWallet.address || null : null

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

      const [owner, nextId] = await Promise.all([
        client.readContract({ address: grindersAddress, abi: grindersAbi, functionName: 'owner' }),
        client.readContract({
          address: grindersAddress,
          abi: grindersAbi,
          functionName: 'totalSupply',
        }),
      ])

      setMeta({ grindersAddress, owner, nextId })
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

  useEffect(() => {
    if (!isEvm || !evm || !meta) {
      setAlreadyRegistered(null)
      return
    }

    const trimmed = custodianInput.trim()
    if (!isAddress(trimmed) || trimmed === zeroAddress) {
      setAlreadyRegistered(null)
      return
    }

    let cancelled = false
    const client = createGraiEvmPublicClient(evm)
    void client
      .readContract({
        address: meta.grindersAddress,
        abi: grindersAbi,
        functionName: 'isCustodian',
        args: [trimmed as `0x${string}`],
      })
      .then((registered) => {
        if (!cancelled) setAlreadyRegistered(registered)
      })
      .catch(() => {
        if (!cancelled) setAlreadyRegistered(null)
      })

    return () => {
      cancelled = true
    }
  }, [custodianInput, evm, isEvm, meta])

  const isOwner = Boolean(
    walletAddress && meta && walletAddress.toLowerCase() === meta.owner.toLowerCase(),
  )

  const canSubmit =
    isEvm &&
    isWalletConnected &&
    !isRegistering &&
    !isLoading &&
    Boolean(meta) &&
    isOwner &&
    isAddress(custodianInput.trim()) &&
    custodianInput.trim().toLowerCase() !== zeroAddress &&
    alreadyRegistered !== true

  const handleUseConnectedOwner = () => {
    if (!walletAddress) return
    setOwnerInput(walletAddress)
    reset()
  }

  const handleSubmit = async () => {
    const toastId = toast.loading('Registering custodian…')
    try {
      const signature = await register({
        custodianInput,
        ownerInput,
      })
      toast.update(toastId, {
        render: (
          <GraiTransactionToast
            message="Custodian registered"
            explorerHref={signature ? explorerTxUrl(signature) : null}
          />
        ),
        type: 'success',
        isLoading: false,
        autoClose: 8000,
        closeOnClick: true,
      })
      setCustodianInput('')
      void refreshMeta()
    } catch (error) {
      toast.update(toastId, {
        render: error instanceof Error ? error.message : 'Grinders register transaction failed',
        type: 'error',
        isLoading: false,
        autoClose: 8000,
        closeOnClick: true,
      })
    }
  }

  return (
    <div className="grai-manage-mint-custodian-form" id="grai-manage-register-custodian">
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

      <div className="grai-mint-amount-block grai-manage-register-card">
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
                  <path d="M12 3l7 4v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V7l7-4z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </span>
              Custodian proxy
            </span>
            {alreadyRegistered === true ? (
              <span className="grai-manage-register-status is-error">Registered</span>
            ) : alreadyRegistered === false ? (
              <span className="grai-manage-register-status is-ok">Available</span>
            ) : null}
          </div>

          <label className="grai-manage-mint-field" htmlFor="grai-register-custodian-address">
            <span className="grai-field-label">Address</span>
            <div className="grai-manage-mint-asset-input-wrap">
              <input
                id="grai-register-custodian-address"
                type="text"
                className="grai-input grai-manage-mint-asset-input"
                placeholder="0x… pre-deployed proxy"
                value={custodianInput}
                onChange={(event) => {
                  setCustodianInput(event.target.value)
                  reset()
                }}
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          </label>

          <label className="grai-manage-mint-field" htmlFor="grai-register-custodian-owner">
            <span className="grai-field-label">NFT owner</span>
            <div className="grai-input-with-suffix has-max">
              <input
                id="grai-register-custodian-owner"
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
        </div>
      </div>

      {loadError && <p className="grai-manage-feedback is-error">{loadError}</p>}
      {!isLoading && meta && !isOwner && isWalletConnected && (
        <p className="grai-manage-feedback is-error">
          Connected wallet is not the Grinders owner.
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
                ? 'Switch to an EVM network to register a custodian'
                : !meta
                  ? loadError ?? 'Grinders unavailable'
                  : !isOwner
                    ? 'Only the Grinders owner can register'
                    : alreadyRegistered
                      ? 'Custodian is already registered'
                      : undefined
            }
            onClick={() => {
              void handleSubmit()
            }}
          >
            {isRegistering ? 'Registering…' : 'Register custodian'}
          </button>
        ) : (
          <GraiActionConnectWalletButton />
        )}
        <span className="grai-liquidation-step-hint">
          Registers a pre-deployed custodian whose <code>grinders()</code> points at this Grinders
          contract, then mints NFT #{' '}
          {isLoading ? '…' : (meta?.nextId.toString() ?? '—')}. Empty owner uses the protocol owner.
        </span>
      </div>
    </div>
  )
}
