import { ReactNode, useEffect, useState } from 'react'
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import '../rainbowkit-fix.css'
import { startScrollLockGapPatch } from '../utils/patchScrollLockGap'

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
    <RainbowKitProvider theme={rkTheme} modalSize="compact" locale="en-US">
      {children}
    </RainbowKitProvider>
  )
}
