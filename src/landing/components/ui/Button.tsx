import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'

type ButtonProps = {
  href?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
  noGradient?: boolean
} & ButtonHTMLAttributes<HTMLButtonElement> &
  AnchorHTMLAttributes<HTMLAnchorElement>

const sizeClasses = {
  sm: 'text-sm px-4 sm:px-6 py-2 sm:py-2.5',
  md: 'text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-3.5',
  lg: 'text-base sm:text-lg px-8 sm:px-10 py-3.5 sm:py-4',
}

const baseClasses =
  'inline-flex items-center justify-center font-mono font-bold text-white no-underline rounded-xl transition-all duration-200 hover:opacity-80'

function isInternalPath(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//')
}

export function Button({
  href,
  children,
  size = 'lg',
  className = '',
  noGradient,
  ...props
}: ButtonProps) {
  const combinedClassName = [baseClasses, sizeClasses[size], className].filter(Boolean).join(' ')

  const style = !noGradient
    ? { background: 'linear-gradient(90deg, #ff69b4, #ff1493)' }
    : {}

  if (href) {
    if (isInternalPath(href)) {
      const { onClick, ...rest } = props as AnchorHTMLAttributes<HTMLAnchorElement>
      return (
        <Link to={href} className={combinedClassName} style={style} onClick={onClick} {...rest}>
          {children}
        </Link>
      )
    }
    return (
      <a
        href={href}
        className={combinedClassName}
        style={style}
        {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {children}
      </a>
    )
  }

  return (
    <button
      className={combinedClassName}
      style={style}
      {...(props as ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {children}
    </button>
  )
}
