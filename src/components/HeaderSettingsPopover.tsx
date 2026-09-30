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
import { useWalletContext } from '../providers/walletContext'
import { useEvmWallet } from '../hooks/useEvmWallet'
import {
  networkEnvFromSolanaCluster,
  preferredEvmChainId,
  type NetworkEnv,
} from '../wallet/networkEnv'
import './HeaderSettingsPopover.css'

type Theme = 'light' | 'dark'

function readSavedTheme(): Theme {
  const saved = localStorage.getItem('theme')
  if (saved === 'light') return 'light'
  // Default dark (also migrates legacy "system").
  return 'dark'
}

function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: T
  options: { value: T; icon: JSX.Element; label: string }[]
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}) {
  const activeIndex = options.findIndex((option) => option.value === value)

  return (
    <div
      className={`header-settings-segmented${activeIndex === 1 ? ' is-second-active' : ''}${className ? ` ${className}` : ''}`}
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
  const { solanaCluster, setSolanaCluster, setEvmChain } = useWalletContext()
  const evmWallet = useEvmWallet()
  const rootRef = useRef<HTMLDivElement>(null)

  const networkEnv: NetworkEnv = networkEnvFromSolanaCluster(solanaCluster)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
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

  const handleNetworkEnvChange = (value: NetworkEnv) => {
    if (value === 'mainnet') {
      setSolanaCluster('mainnet-beta')
      setEvmChain('ethereum')
      if (evmWallet.isConnected) {
        void evmWallet.switchToChainAsync(preferredEvmChainId('ethereum', 'mainnet')).catch(() => {
          evmWallet.switchToChain(preferredEvmChainId('ethereum', 'mainnet'))
        })
      }
      return
    }
    setSolanaCluster('devnet')
    setEvmChain('sepolia')
    if (evmWallet.isConnected) {
      void evmWallet.switchToChainAsync(preferredEvmChainId('sepolia', 'testnet')).catch(() => {
        evmWallet.switchToChain(preferredEvmChainId('sepolia', 'testnet'))
      })
    }
  }

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
        <div className="header-settings-row header-settings-row--network">
          <SegmentedToggle
            value={networkEnv}
            className="header-settings-segmented--network"
            options={[
              {
                value: 'mainnet',
                icon: <span className="header-settings-segment-text">Mainnet</span>,
                label: 'Mainnet',
              },
              {
                value: 'testnet',
                icon: <span className="header-settings-segment-text">Testnet</span>,
                label: 'Testnet (Solana Devnet / Sepolia)',
              },
            ]}
            onChange={handleNetworkEnvChange}
            ariaLabel="Network"
          />
        </div>
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
