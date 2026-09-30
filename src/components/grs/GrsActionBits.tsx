import { toast } from 'react-toastify'
import { PublicKey } from '@solana/web3.js'
import { isAddress } from 'viem'
import { GraiTransactionToast } from '../grai/GraiTransactionToast'
import { GraiActionConnectWalletButton } from '../grai/GraiWalletAction'
import { ActionTxFeedback, type ActionTxFeedbackProps } from '../ActionTxFeedback'
import { grsExplorerTxUrl, type GrsConfig } from '../../grs/deployments'

export {
  ActionTxFeedback,
  ActionDepositNote,
  usePersistedActionTx,
  copyTextToClipboard,
  extractTxHashFromText,
} from '../ActionTxFeedback'
export type { PersistedActionTx, ActionTxFeedbackProps } from '../ActionTxFeedback'

/** @deprecated Prefer ActionTxFeedback — kept for existing GRS imports. */
export function GrsFeedback(props: ActionTxFeedbackProps) {
  return <ActionTxFeedback {...props} />
}

export function isGrsRecipient(value: string, kind: 'evm' | 'solana' | null | undefined): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (kind === 'solana') {
    try {
      // eslint-disable-next-line no-new
      new PublicKey(trimmed)
      return true
    } catch {
      return false
    }
  }
  return isAddress(trimmed)
}

export function GrsSubmit({
  connected,
  disabled,
  pending,
  label,
  connectLabel,
  blockedLabel,
  onBeforeConnect,
  onClick,
}: {
  connected: boolean
  disabled: boolean
  pending: boolean
  label: string
  connectLabel?: string
  /** When set (and wallet connected), replaces Buy with a disabled CTA (e.g. empty amount). */
  blockedLabel?: string | null
  onBeforeConnect?: () => void
  onClick: () => void
}) {
  if (!connected) {
    return (
      <GraiActionConnectWalletButton label={connectLabel} onBeforeOpen={onBeforeConnect} />
    )
  }
  if (blockedLabel) {
    return (
      <div className="grai-action-submit">
        <button type="button" className="grai-mint-btn" disabled>
          {blockedLabel}
        </button>
      </div>
    )
  }
  return (
    <div className="grai-action-submit">
      <button type="button" className="grai-mint-btn" disabled={disabled || pending} onClick={onClick}>
        {pending ? 'Confirming…' : label}
      </button>
    </div>
  )
}

export function toastGrsSuccess(
  message: string,
  explorer: GrsConfig | number,
  hash: string,
  opts?: { href?: string | null; linkLabel?: string },
) {
  toast.success(
    <GraiTransactionToast
      message={message}
      explorerHref={opts?.href ?? grsExplorerTxUrl(explorer, hash)}
      linkLabel={opts?.linkLabel}
    />,
  )
}
