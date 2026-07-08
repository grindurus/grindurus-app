import { useEffect, useRef, useState } from 'react'
import {
  Moon,
  Settings,
  Sun,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { readSoundEnabled, writeSoundEnabled } from '../utils/soundPreference'
import './HeaderSettingsPopover.css'

type Theme = 'light' | 'dark'

function readSavedTheme(): Theme {
  const saved = localStorage.getItem('theme')
  if (saved === 'light' || saved === 'dark') return saved
  return 'dark'
}

function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: { value: T; icon: JSX.Element; label: string }[]
  onChange: (value: T) => void
  ariaLabel: string
}) {
  const activeIndex = options.findIndex((option) => option.value === value)

  return (
    <div
      className={`header-settings-segmented${activeIndex === 1 ? ' is-second-active' : ''}`}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`header-settings-segment${value === option.value ? ' is-active' : ''}`}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          aria-label={option.label}
          title={option.label}
        >
          {option.icon}
        </button>
      ))}
    </div>
  )
}

export function HeaderSettingsPopover() {
  const [isOpen, setIsOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(readSavedTheme)
  const [soundEnabled, setSoundEnabled] = useState(readSoundEnabled)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    writeSoundEnabled(soundEnabled)
  }, [soundEnabled])

  useEffect(() => {
    if (!isOpen) return
    const onDocumentClick = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', onDocumentClick)
    return () => document.removeEventListener('mousedown', onDocumentClick)
  }, [isOpen])

  return (
    <div className="header-settings" ref={rootRef}>
      <button
        type="button"
        className={`header-settings-trigger${isOpen ? ' is-open' : ''}`}
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={isOpen ? 'Close settings' : 'Settings'}
      >
        {isOpen ? <X size={18} strokeWidth={2.2} aria-hidden="true" /> : <Settings size={18} strokeWidth={2} aria-hidden="true" />}
      </button>

      <span className={`header-settings-trigger-tail${isOpen ? ' is-open' : ''}`} aria-hidden="true" />

      <div
        className={`header-settings-popover${isOpen ? ' is-open' : ''}`}
        role="dialog"
        aria-label="Settings"
        aria-hidden={!isOpen}
      >
        <div className="header-settings-row">
          <SegmentedToggle
            value={soundEnabled ? 'on' : 'off'}
            options={[
              { value: 'on', icon: <Volume2 size={16} strokeWidth={2} aria-hidden="true" />, label: 'Sound on' },
              { value: 'off', icon: <VolumeX size={16} strokeWidth={2} aria-hidden="true" />, label: 'Sound off' },
            ]}
            onChange={(value) => setSoundEnabled(value === 'on')}
            ariaLabel="Sound"
          />
          <SegmentedToggle
            value={theme}
            options={[
              { value: 'light', icon: <Sun size={16} strokeWidth={2} aria-hidden="true" />, label: 'Light mode' },
              { value: 'dark', icon: <Moon size={16} strokeWidth={2} aria-hidden="true" />, label: 'Dark mode' },
            ]}
            onChange={setTheme}
            ariaLabel="Theme"
          />
        </div>
      </div>
    </div>
  )
}
