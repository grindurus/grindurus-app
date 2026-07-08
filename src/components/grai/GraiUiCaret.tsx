type Props = {
  className?: string
}

export function GraiUiCaret({ className }: Props) {
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M1 1.25L5 4.75L9 1.25"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
