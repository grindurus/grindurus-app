import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { useWalletContext } from './walletContext'

const WALLET_CONNECT_PENDING_MAX_MS = 12_000

function isWalletConnectClickTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target.closest('[data-testid="wallet-option-walletConnect"]')) return true
  if (target.closest('[data-testid^="wallet-option-"]')?.getAttribute('data-testid')?.includes('walletconnect')) {
    return true
  }
  return Boolean(target.closest('[data-testid="wallet-button-walletConnect"]'))
}

function isWalletConnectUiReady(): boolean {
  if (
    document.querySelector(
      'w3m-modal, wcm-modal, appkit-modal, w3m-container, [data-testid="w3m-modal-overlay"], [data-testid="wcm-modal"]',
    )
  ) {
    return true
  }

  const modalRoots = document.querySelectorAll('[role="dialog"], [aria-modal="true"]')
  for (const modal of modalRoots) {
    if (modal.querySelector('canvas, w3m-qrcode, [data-testid*="qr"], [class*="_1vwt0cg0"]')) {
      return true
    }
  }

  return false
}

function findConnectModalHost(): HTMLElement | null {
  const title = document.getElementById('rk_connect_title')
  const host = title?.closest('[role="dialog"]')?.querySelector('[role="document"]')
  return host instanceof HTMLElement ? host : null
}

function LoadingOverlay({ label }: { label: string }) {
  return (
    <div className="rainbowkit-connect-loading-overlay" role="status" aria-live="polite" aria-busy="true">
      <span className="rainbowkit-connect-loading-spinner" aria-hidden="true" />
      <span className="rainbowkit-connect-loading-label">{label}</span>
    </div>
  )
}

/** Loading feedback while RainbowKit / WalletConnect initializes, before QR UI is ready. */
export function RainbowKitLoadingOverlay() {
  const { connectModalOpen } = useConnectModal()
  const { isConnected } = useAccount()
  const { pendingWalletConnectOpen } = useWalletContext()
  const [walletConnectPending, setWalletConnectPending] = useState(false)
  const [walletConnectUiReady, setWalletConnectUiReady] = useState(false)
  const [modalHost, setModalHost] = useState<HTMLElement | null>(null)

  const showBootstrapLoading = pendingWalletConnectOpen && !connectModalOpen
  const showModalLoading = walletConnectPending && !walletConnectUiReady && !isConnected
  const showLoading = showBootstrapLoading || showModalLoading

  const resolveModalHost = useCallback(() => {
    const host = findConnectModalHost()
    if (!host) {
      setModalHost(null)
      return
    }
    if (getComputedStyle(host).position === 'static') {
      host.style.position = 'relative'
    }
    setModalHost(host)
  }, [])

  useEffect(() => {
    if (!connectModalOpen) {
      setWalletConnectPending(false)
      setWalletConnectUiReady(false)
      setModalHost(null)
      return
    }

    const onClick = (event: MouseEvent) => {
      if (isWalletConnectClickTarget(event.target)) {
        setWalletConnectPending(true)
        setWalletConnectUiReady(false)
      }
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [connectModalOpen])

  useEffect(() => {
    if (isConnected) {
      setWalletConnectPending(false)
      setWalletConnectUiReady(false)
    }
  }, [isConnected])

  useEffect(() => {
    if (!walletConnectPending || walletConnectUiReady) return

    const syncReadyState = () => {
      if (isWalletConnectUiReady()) {
        setWalletConnectUiReady(true)
        setWalletConnectPending(false)
      }
    }

    syncReadyState()
    const intervalId = window.setInterval(syncReadyState, 120)
    const timeoutId = window.setTimeout(() => {
      setWalletConnectPending(false)
      setWalletConnectUiReady(true)
    }, WALLET_CONNECT_PENDING_MAX_MS)

    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
    }
  }, [walletConnectPending, walletConnectUiReady])

  useEffect(() => {
    if (!showModalLoading) {
      setModalHost(null)
      return
    }

    resolveModalHost()
    const id = window.setInterval(resolveModalHost, 120)
    return () => window.clearInterval(id)
  }, [showModalLoading, resolveModalHost])

  if (!showLoading) return null

  const label = showBootstrapLoading ? 'Loading WalletConnect…' : 'Connecting WalletConnect…'

  if (showModalLoading && modalHost) {
    return createPortal(<LoadingOverlay label={label} />, modalHost)
  }

  return createPortal(<LoadingOverlay label={label} />, document.body)
}
