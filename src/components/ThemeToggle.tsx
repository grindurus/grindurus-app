import { useState, useEffect } from 'react'

type Theme = 'light' | 'dark'

function readSavedTheme(): Theme {
  const saved = localStorage.getItem('theme')
  if (saved === 'light' || saved === 'dark') return saved
  return 'dark'
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readSavedTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <div className="theme-toggle">
      <button
        className="theme-toggle-btn"
        onClick={() => {
          setTheme((current) => (current === 'light' ? 'dark' : 'light'))
        }}
      >
        {theme === 'light' ? '☀️' : '🌑'}
      </button>
      <div className="theme-dropdown">
        <button
          className={`theme-option ${theme === 'light' ? 'active' : ''}`}
          onClick={() => setTheme('light')}
        >
          <span>☀️</span>
          <span>Light</span>
        </button>
        <button
          className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
          onClick={() => setTheme('dark')}
        >
          <span>🌑</span>
          <span>Dark</span>
        </button>
      </div>
    </div>
  )
}
