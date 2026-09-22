interface TitleProps {
  children: React.ReactNode
  className?: string
}

export function Title({ children, className } : TitleProps) {
  return (
    <h2 className={`font-mono font-black text-[clamp(2.2rem,4vw,3.5rem)] leading-[1.2] text-white mb-8 ${className ?? ""}`}>
      {children}
    </h2>
  )
}
