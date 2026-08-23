import { useEffect } from 'react'
import { playBullSound } from '../../utils/playBullSound'

type Props = {
  message: string
  explorerHref?: string | null
  linkLabel?: string
}

export function GraiTransactionToast({ message, explorerHref, linkLabel }: Props) {
  useEffect(() => {
    void playBullSound()
  }, [])

  return (
    <span className="grai-tx-toast">
      <span>{message}</span>
      {explorerHref ? (
        <a href={explorerHref} target="_blank" rel="noreferrer">
          {linkLabel ?? 'View on explorer'}
        </a>
      ) : null}
    </span>
  )
}
