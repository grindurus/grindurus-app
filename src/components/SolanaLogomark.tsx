import solanaLogomark from '../assets/solana-logomark.svg'

type Props = {
  /** Render height in px; width follows the official logomark aspect (101×88). */
  size?: number
  className?: string
  title?: string
}

/** Official Solana logomark (three parallelograms + brand gradient). See https://solana.com/branding */
export function SolanaLogomark({ size = 20, className, title }: Props) {
  const height = size
  const width = Math.round((size * 101) / 88)
  return (
    <img
      src={solanaLogomark}
      alt={title ?? ''}
      width={width}
      height={height}
      className={className}
      decoding="async"
      aria-hidden={title ? undefined : true}
      style={{ objectFit: 'contain', display: 'block' }}
    />
  )
}
