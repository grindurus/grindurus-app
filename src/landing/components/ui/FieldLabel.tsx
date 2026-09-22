export function FieldLabel({ children, className = "mb-2" }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={`block font-mono text-xs text-white/40 uppercase tracking-widest font-bold ${className}`}>
      {children}
    </span>
  )
}
