import { useAccount, useDisconnect, useChainId, useSwitchChain, useConnect } from 'wagmi'
import { mainnet, base, arbitrum, sepolia } from 'wagmi/chains'
import { useMemo, useCallback, useState, useEffect } from 'react'
import type { EvmWalletSnapshot } from '../providers/evmWalletTypes'

const chainNames: Record<number, string> = {
  [mainnet.id]: 'Ethereum',
  [base.id]: 'Base',
  [arbitrum.id]: 'Arbitrum',
  [sepolia.id]: 'Sepolia',
}

export function useEvmWalletFromWagmi(): EvmWalletSnapshot {
  const { address, isConnected, isConnecting, connector } = useAccount()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { switchChain, switchChainAsync } = useSwitchChain()
  const { connectors, connectAsync: wagmiConnectAsync } = useConnect()
  const [installedConnectors, setInstalledConnectors] = useState<string[]>([])

  useEffect(() => {
    const checkConnectors = async () => {
      const installed: string[] = []
      for (const c of connectors) {
        if (c.type !== 'injected') continue
        try {
          const provider = await c.getProvider()
          if (provider) {
            installed.push(c.uid)
          }
        } catch {
          // Provider not available
        }
      }
      setInstalledConnectors(installed)
    }
    void checkConnectors()
  }, [connectors])

  const shortAddress = useMemo(() => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }, [address])

  const chainName = useMemo(() => {
    return chainNames[chainId] || 'Unknown'
  }, [chainId])

  const supportedChains = useMemo(
    () => [
      { id: mainnet.id, name: 'Ethereum', icon: '⟠' },
      { id: base.id, name: 'Base', icon: '🔵' },
      { id: arbitrum.id, name: 'Arbitrum', icon: '🔷' },
      { id: sepolia.id, name: 'Sepolia', icon: '🧪' },
    ],
    [],
  )

  const isCoinbaseConnector = useCallback((c: { id: string; name: string }) => {
    const id = c.id.toLowerCase()
    const name = c.name.toLowerCase()
    return id.includes('coinbase') || name.includes('coinbase')
  }, [])

  const isMetaMaskConnector = useCallback((c: { id: string; name: string }) => {
    const id = c.id.toLowerCase()
    const name = c.name.toLowerCase()
    return id.includes('metamask') || name.includes('metamask')
  }, [])

  const isWalletConnectConnector = useCallback((c: { id: string; name: string }) => {
    if (isMetaMaskConnector(c)) return false
    const id = c.id.toLowerCase()
    const name = c.name.toLowerCase()
    return id.includes('walletconnect') || name.includes('walletconnect')
  }, [isMetaMaskConnector])

  const detectedConnectors = useMemo(() => {
    const filtered = connectors.filter((c) => {
      if (isCoinbaseConnector(c)) return false
      // Always keep MetaMask (injected, SDK, or WalletConnect deep-link fallback).
      if (isMetaMaskConnector(c)) return true
      if (c.type === 'injected') {
        if (c.name === 'Injected') return false
        return installedConnectors.includes(c.uid)
      }
      return true
    })
    const seen = new Set<string>()
    const unique = filtered.filter((c) => {
      const key = isMetaMaskConnector(c) ? 'metamask' : c.name.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return unique.sort((a, b) => {
      const rank = (c: { id: string; name: string }) => {
        if (isMetaMaskConnector(c)) return 0
        if (isWalletConnectConnector(c)) return 2
        return 1
      }
      return rank(a) - rank(b)
    })
  }, [
    connectors,
    installedConnectors,
    isCoinbaseConnector,
    isMetaMaskConnector,
    isWalletConnectConnector,
  ])

  const switchToChain = useCallback(
    (targetChainId: number) => {
      if (switchChain) {
        switchChain({ chainId: targetChainId })
      }
    },
    [switchChain],
  )

  const switchToChainAsync = useCallback(
    async (targetChainId: number) => {
      if (!switchChainAsync) {
        throw new Error('This wallet does not support switching networks from the app.')
      }
      await switchChainAsync({ chainId: targetChainId })
    },
    [switchChainAsync],
  )

  const walletConnectConnector = useMemo(
    () =>
      connectors.find(
        (c) =>
          c.id.toLowerCase().includes('walletconnect') ||
          c.name.toLowerCase().includes('walletconnect'),
      ),
    [connectors],
  )

  const canOpenConnectModal = Boolean(walletConnectConnector)

  const connect = useCallback(() => {
    if (!walletConnectConnector) return false
    void wagmiConnectAsync({ connector: walletConnectConnector }).catch((error: unknown) => {
      console.error('WalletConnect connect failed:', error)
    })
    return true
  }, [walletConnectConnector, wagmiConnectAsync])

  const connectWalletConnect = useCallback(() => {
    if (!walletConnectConnector) return false

    void wagmiConnectAsync({ connector: walletConnectConnector }).catch((error: unknown) => {
      console.error('WalletConnect connect failed:', error)
    })
    return true
  }, [walletConnectConnector, wagmiConnectAsync])

  const connectWithConnector = useCallback(
    async (connectorId: string) => {
      const found = connectors.find((c) => c.uid === connectorId || c.id === connectorId)
      if (!found) {
        throw new Error(`Connector not found: ${connectorId}`)
      }
      await wagmiConnectAsync({ connector: found })
    },
    [connectors, wagmiConnectAsync],
  )

  return {
    address,
    shortAddress,
    isConnected,
    isConnecting,
    chainId,
    chainName,
    connector,
    connectors: detectedConnectors,
    supportedChains,
    canOpenConnectModal,
    connect,
    connectWalletConnect,
    connectWithConnector,
    disconnect,
    switchToChain,
    switchToChainAsync,
  }
}
