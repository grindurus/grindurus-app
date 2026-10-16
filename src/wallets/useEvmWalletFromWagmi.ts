import { useAccount, useDisconnect, useChainId, useSwitchChain, useConnect } from 'wagmi'
import { mainnet, base, arbitrum, polygon, sepolia } from 'wagmi/chains'
import { useMemo, useCallback, useState, useEffect } from 'react'
import type { EvmWalletSnapshot } from './evmWalletTypes'
import { useWalletContext } from './walletContext'
import {
  evmChainMatchesNetworkEnv,
  preferredEvmChainId,
  preferredMainnetEvmChain,
} from './networkEnv'

const chainNames: Record<number, string> = {
  [mainnet.id]: 'Ethereum',
  [base.id]: 'Base',
  [arbitrum.id]: 'Arbitrum',
  [polygon.id]: 'Polygon',
  [sepolia.id]: 'Sepolia',
}

const ALL_SUPPORTED_CHAINS = [
  { id: mainnet.id, name: 'Ethereum', icon: '⟠' },
  { id: base.id, name: 'Base', icon: '🔵' },
  { id: arbitrum.id, name: 'Arbitrum', icon: '🔷' },
  { id: polygon.id, name: 'Polygon', icon: '⬡' },
  { id: sepolia.id, name: 'Sepolia', icon: '🧪' },
] as const

export function useEvmWalletFromWagmi(): EvmWalletSnapshot {
  const { address, isConnected, isConnecting, connector } = useAccount()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { switchChain, switchChainAsync } = useSwitchChain()
  const { connectors, connectAsync: wagmiConnectAsync } = useConnect()
  const {
    evmChain,
    networkEnv,
    setSolanaCluster,
    setEvmChain,
  } = useWalletContext()
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
    () =>
      ALL_SUPPORTED_CHAINS.filter((chain) => evmChainMatchesNetworkEnv(chain.id, networkEnv)).map(
        (chain) => ({ ...chain }),
      ),
    [networkEnv],
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

  const connectOnMainnet = useCallback(
    (connector: (typeof connectors)[number]) => {
      const mainnetEvm = preferredMainnetEvmChain(evmChain)
      const chainId = preferredEvmChainId(mainnetEvm, 'mainnet')
      setSolanaCluster('mainnet-beta')
      setEvmChain(mainnetEvm)
      void wagmiConnectAsync({ connector, chainId })
        .then(async () => {
          if (switchChainAsync) {
            try {
              await switchChainAsync({ chainId })
            } catch {
              // User rejected the switch or the wallet cannot change networks here.
            }
          }
        })
        .catch((error: unknown) => {
          console.error('WalletConnect connect failed:', error)
        })
    },
    [evmChain, setEvmChain, setSolanaCluster, switchChainAsync, wagmiConnectAsync],
  )

  const connect = useCallback(() => {
    if (!walletConnectConnector) return false
    connectOnMainnet(walletConnectConnector)
    return true
  }, [connectOnMainnet, walletConnectConnector])

  const connectWalletConnect = useCallback(() => {
    if (!walletConnectConnector) return false
    connectOnMainnet(walletConnectConnector)
    return true
  }, [connectOnMainnet, walletConnectConnector])

  const connectWithConnector = useCallback(
    async (connectorId: string, preferredChainId?: number) => {
      const found = connectors.find((c) => c.uid === connectorId || c.id === connectorId)
      if (!found) {
        throw new Error(`Connector not found: ${connectorId}`)
      }
      const chainId = preferredChainId
      await wagmiConnectAsync(chainId != null ? { connector: found, chainId } : { connector: found })
      // Some wallets ignore chainId on connect — switch after the session is up.
      if (chainId != null && switchChainAsync) {
        try {
          await switchChainAsync({ chainId })
        } catch {
          // User rejected the switch or the wallet cannot change networks here.
        }
      }
    },
    [connectors, wagmiConnectAsync, switchChainAsync],
  )

  const connectorSnapshot = useMemo(() => {
    if (!connector) return undefined
    const icon =
      typeof (connector as { icon?: unknown }).icon === 'string'
        ? (connector as { icon: string }).icon
        : undefined
    return {
      id: connector.id,
      name: connector.name,
      uid: connector.uid,
      icon,
    }
  }, [connector])

  return useMemo(
    () => ({
      address,
      shortAddress,
      isConnected,
      isConnecting,
      chainId,
      chainName,
      connector: connectorSnapshot,
      connectors: detectedConnectors,
      supportedChains,
      canOpenConnectModal,
      connect,
      connectWalletConnect,
      connectWithConnector,
      disconnect,
      switchToChain,
      switchToChainAsync,
    }),
    [
      address,
      shortAddress,
      isConnected,
      isConnecting,
      chainId,
      chainName,
      connectorSnapshot,
      detectedConnectors,
      supportedChains,
      canOpenConnectModal,
      connect,
      connectWalletConnect,
      connectWithConnector,
      disconnect,
      switchToChain,
      switchToChainAsync,
    ],
  )
}
