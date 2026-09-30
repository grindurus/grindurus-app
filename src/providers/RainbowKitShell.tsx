import { ReactNode, useEffect, useMemo, useState } from 'react'
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit'
import { mainnet, base, arbitrum, polygon, sepolia } from 'wagmi/chains'
import '@rainbow-me/rainbowkit/styles.css'
import '../rainbowkit-fix.css'
import { startScrollLockGapPatch } from '../utils/patchScrollLockGap'
import { useWalletContext } from './walletContext'
import {
  networkEnvFromSolanaCluster,
  preferredEvmChainId,
} from '../wallet/networkEnv'
import { RainbowKitConnectBridge } from './RainbowKitConnectBridge'
import { RainbowKitLoadingOverlay } from './RainbowKitLoadingOverlay'

function useDataThemeIsDark() {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark',
  )
  useEffect(() => {
    const el = document.documentElement
    const sync = () => setIsDark(el.getAttribute('data-theme') === 'dark')
    const obs = new MutationObserver(sync)
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return isDark
}

export function RainbowKitShell({ children }: { children: ReactNode }) {
  useEffect(() => startScrollLockGapPatch(), [])
  const isDark = useDataThemeIsDark()
  const { evmChain, solanaCluster } = useWalletContext()
  const initialChainId = preferredEvmChainId(
    evmChain,
    networkEnvFromSolanaCluster(solanaCluster),
  )
  const initialChain = useMemo(() => {
    if (initialChainId === sepolia.id) return sepolia
    if (initialChainId === base.id) return base
    if (initialChainId === arbitrum.id) return arbitrum
    if (initialChainId === polygon.id) return polygon
    return mainnet
  }, [initialChainId])
  const rkTheme = isDark
    ? darkTheme({
        accentColor: '#ff69b4',
        accentColorForeground: 'white',
        borderRadius: 'medium',
        fontStack: 'system',
      })
    : lightTheme({
        accentColor: '#ff69b4',
        accentColorForeground: 'white',
        borderRadius: 'medium',
        fontStack: 'system',
      })

  return (
    <RainbowKitProvider
      theme={rkTheme}
      modalSize="compact"
      locale="en-US"
      initialChain={initialChain}
    >
      <RainbowKitConnectBridge />
      <RainbowKitLoadingOverlay />
      {children}
    </RainbowKitProvider>
  )
}
