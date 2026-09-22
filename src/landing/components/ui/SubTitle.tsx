interface SubTitleProps {
  children: React.ReactNode
  className?: string
}

export function SubTitle({ children, className } : SubTitleProps) {
  return (
    <h3 className={`font-mono font-bold text-3xl text-white ${className ?? ""}`}>
      {children}
    </h3>
  )
}
