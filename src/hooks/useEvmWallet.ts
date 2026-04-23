import { useAccount, useDisconnect, useChainId, useSwitchChain, useConnect } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { mainnet, base, arbitrum, sepolia, baseSepolia } from 'wagmi/chains'
import { useMemo, useCallback, useState, useEffect } from 'react'

const chainNames: Record<number, string> = {
  [mainnet.id]: 'Ethereum',
  [base.id]: 'Base',
  [arbitrum.id]: 'Arbitrum',
  [sepolia.id]: 'Sepolia',
  [baseSepolia.id]: 'Base Sepolia',
}

export function useEvmWallet() {
  const { address, isConnected, isConnecting, connector } = useAccount()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { switchChain, switchChainAsync } = useSwitchChain()
  const { openConnectModal } = useConnectModal()
  const { connectors, connect: wagmiConnect } = useConnect()
  const [installedConnectors, setInstalledConnectors] = useState<string[]>([])

  useEffect(() => {
    const checkConnectors = async () => {
      const installed: string[] = []
      for (const c of connectors) {
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
    checkConnectors()
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
      { id: baseSepolia.id, name: 'Base Sepolia', icon: '🔷' },
    ],
    []
  )

  const detectedConnectors = useMemo(() => {
    const filtered = connectors.filter((c) => {
      if (c.type === 'injected' && c.name === 'Injected') return false
      return installedConnectors.includes(c.uid)
    })
    const seen = new Set<string>()
    return filtered.filter((c) => {
      if (seen.has(c.name)) return false
      seen.add(c.name)
      return true
    })
  }, [connectors, installedConnectors])

  const switchToChain = useCallback(
    (targetChainId: number) => {
      if (switchChain) {
        switchChain({ chainId: targetChainId })
      }
    },
    [switchChain]
  )

  const switchToChainAsync = useCallback(
    async (targetChainId: number) => {
      if (!switchChainAsync) {
        throw new Error('This wallet does not support switching networks from the app.')
      }
      await switchChainAsync({ chainId: targetChainId })
    },
    [switchChainAsync]
  )

  const connect = useCallback(() => {
    if (openConnectModal) {
      openConnectModal()
    }
  }, [openConnectModal])

  const connectWithConnector = useCallback(
    (connectorId: string) => {
      const found = connectors.find((c) => c.id === connectorId || c.uid === connectorId)
      if (found) {
        wagmiConnect({ connector: found })
      }
    },
    [connectors, wagmiConnect]
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
    connect,
    connectWithConnector,
    disconnect,
    switchToChain,
    switchToChainAsync,
  }
}
