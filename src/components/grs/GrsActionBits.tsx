import { toast } from 'react-toastify'
import { GraiTransactionToast } from '../grai/GraiTransactionToast'
import { GraiActionConnectWalletButton } from '../grai/GraiWalletAction'
import { shortenAddress } from '../../utils/shortenAddress'
import { grsExplorerTxUrl } from '../../grs/deployments'

export function GrsFeedback({
  isPending,
  pendingLabel,
  error,
  hash,
  chainId,
  successLabel,
}: {
  isPending: boolean
  pendingLabel: string
  error: string | null
  hash: string | null
  chainId: number | undefined
  successLabel: string
}) {
  if (isPending) {
    return <p className="grai-manage-feedback is-pending">{pendingLabel}</p>
  }
  if (error) {
    return <p className="grai-manage-feedback is-error">{error}</p>
  }
  if (hash) {
    const href = chainId ? grsExplorerTxUrl(chainId, hash) : null
    return (
      <p className="grai-manage-feedback is-success">
        {successLabel}{' '}
        {href ? (
          <a href={href} target="_blank" rel="noreferrer">
            {shortenAddress(hash)}
          </a>
        ) : (
          shortenAddress(hash)
        )}
      </p>
    )
  }
  return null
}

export function GrsSubmit({
  connected,
  disabled,
  pending,
  label,
  onClick,
}: {
  connected: boolean
  disabled: boolean
  pending: boolean
  label: string
  onClick: () => void
}) {
  if (!connected) return <GraiActionConnectWalletButton />
  return (
    <div className="grai-action-submit">
      <button type="button" className="grai-mint-btn" disabled={disabled || pending} onClick={onClick}>
        {pending ? 'Confirming…' : label}
      </button>
    </div>
  )
}

export function toastGrsSuccess(message: string, chainId: number, hash: string) {
  toast.success(<GraiTransactionToast message={message} explorerHref={grsExplorerTxUrl(chainId, hash)} />)
}
