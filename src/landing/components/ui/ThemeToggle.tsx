import { useState, useEffect } from 'react'

type Theme = 'light' | 'dark'

function readSavedTheme(): Theme {
  const saved = localStorage.getItem('theme')
  return saved === 'light' ? 'light' : 'dark'
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readSavedTheme)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  const icon = theme === 'light' ? '☀️' : '🌙'

  const options: { value: Theme; icon: string; label: string }[] = [
    { value: 'light', icon: '☀️', label: 'Light' },
    { value: 'dark', icon: '🌙', label: 'Dark' },
  ]

  return (
    <div className="relative">
      <button
        className="w-[42px] h-[42px] flex items-center justify-center rounded-lg border-2 border-brand-pink bg-white/10 text-lg transition-all duration-200 hover:scale-105 hover:bg-gradient-to-br hover:from-brand-pink hover:to-brand-red"
        onClick={() => setOpen((o) => !o)}
      >
        {icon}
      </button>

      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 z-50 min-w-[140px] rounded-xl border border-black/10 dark:border-white/10 bg-[#f0f0f0] dark:bg-[#1a1a1a] p-1.5 flex flex-col gap-1 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setTheme(opt.value)
                setOpen(false)
              }}
              className={[
                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left w-full transition-all duration-150',
                theme === opt.value
                  ? 'text-white'
                  : 'text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5',
              ].join(' ')}
              style={theme === opt.value ? { background: 'linear-gradient(135deg,#ff69b4,#ff1493)' } : undefined}
            >
              <span>{opt.icon}</span>
              <span className="font-mono">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
