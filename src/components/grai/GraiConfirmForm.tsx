import { useCallback, useEffect, useState } from 'react'
import { zeroAddress } from 'viem'
import { toast } from 'react-toastify'
import { useGraiDeployment } from '../../grai/GraiDeploymentProvider'
import { graiAbi, grindersAbi } from '../../grai/evm/abi'
import { createGraiEvmPublicClient, resolveGraiContractAddress } from '../../grai/evm/client'
import { fetchGraiProtocol } from '../../grai/fetchGraiProtocol'
import { useActiveWallet } from '../../hooks/useActiveWallet'
import { useGraiLiquidate } from '../../hooks/useGraiLiquidate'
import { GraiActionConnectWalletButton } from './GraiWalletAction'
import { GraiTransactionToast } from './GraiTransactionToast'

export function GraiConfirmForm() {
  const { chainKind, evm, connection, solana, explorerTxUrl } = useGraiDeployment()
  const activeWallet = useActiveWallet()
  const { confirmLiquidation, isLiquidating, reset } = useGraiLiquidate()

  const [confirmed, setConfirmed] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const isWalletConnected = activeWallet.isConnected
  const isEvm = chainKind === 'evm'
  const isSolana = chainKind === 'solana'

  const refreshMeta = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      if (isEvm) {
        if (!evm) {
          setConfirmed(null)
          setLoadError('GRAI is not configured for this EVM network')
          return
        }
        const client = createGraiEvmPublicClient(evm)
        const graiAddress = resolveGraiContractAddress(evm)
        const grindersAddress = await client.readContract({
          address: graiAddress,
          abi: graiAbi,
          functionName: 'grinders',
        })
        if (!grindersAddress || grindersAddress === zeroAddress) {
          setConfirmed(null)
          setLoadError('Grinders is not set on this GRAI deployment')
          return
        }
        const next = await client.readContract({
          address: grindersAddress,
          abi: grindersAbi,
          functionName: 'confirmed',
        })
        setConfirmed(next)
        return
      }

      if (isSolana) {
        if (!connection || !solana) {
          setConfirmed(null)
          setLoadError('GRAI is not configured for this Solana cluster')
          return
        }
        const protocol = await fetchGraiProtocol(connection, solana.graiMint)
        setConfirmed(protocol.confirmed)
        return
      }

      setConfirmed(null)
      setLoadError('Confirm is not available on this network')
    } catch (error) {
      setConfirmed(null)
      setLoadError(error instanceof Error ? error.message : 'Failed to load Grinders confirm state')
    } finally {
      setIsLoading(false)
    }
  }, [connection, evm, isEvm, isSolana, solana])

  useEffect(() => {
    void refreshMeta()
  }, [refreshMeta])

  const handleSubmit = async () => {
    const toastId = toast.loading(confirmed ? 'Disarming owner confirm…' : 'Confirming liquidation…')
    try {
      const signature = await confirmLiquidation()
      toast.update(toastId, {
        render: (
          <GraiTransactionToast
            message={confirmed ? 'Owner confirm disarmed' : 'Owner confirm armed'}
            explorerHref={signature ? explorerTxUrl(signature) : null}
          />
        ),
        type: 'success',
        isLoading: false,
        autoClose: 8000,
      })
      reset()
      await refreshMeta()
    } catch (error) {
      toast.update(toastId, {
        render: error instanceof Error ? error.message : 'Confirm transaction failed',
        type: 'error',
        isLoading: false,
        autoClose: 8000,
      })
    }
  }

  return (
    <div className="grai-action-content">
      <div className="grai-action-metrics" aria-live="polite">
        <div className="grai-action-metric-row">
          <span className="grai-action-metric-label">Owner confirmed</span>
          <span className="grai-action-metric-value">
            {isLoading ? '…' : confirmed == null ? '—' : confirmed ? 'Yes' : 'No'}
          </span>
        </div>
      </div>

      {loadError ? <p className="grai-manage-feedback is-error">{loadError}</p> : null}

      <div className="grai-action-submit">
        {isWalletConnected ? (
          <button
            type="button"
            className="grai-mint-btn"
            disabled={isLiquidating || isLoading || confirmed == null}
            onClick={() => {
              void handleSubmit()
            }}
          >
            {isLiquidating ? 'Confirming…' : confirmed ? 'Disarm' : 'Confirm'}
          </button>
        ) : (
          <GraiActionConnectWalletButton />
        )}
      </div>

      <p className="grai-action-deposit-note">
        Toggles the Grinders-owner limb of GRAI 2-of-2 liquidation. Only the Grinders owner can
        call this.
      </p>
    </div>
  )
}
