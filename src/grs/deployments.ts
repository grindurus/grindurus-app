import {
  evmExplorerAccountUrl,
  evmExplorerTokenUrl,
  evmExplorerTxUrl,
} from '../grai/deployments'

export type GrsEvmConfig = {
  kind: 'evm'
  chainId: number
  chainName: string
  address: `0x${string}`
}

const EVM_CHAINS = [
  { chainId: 1, chainName: 'Ethereum', envSuffix: 'ETHEREUM' },
  { chainId: 8453, chainName: 'Base', envSuffix: 'BASE' },
  { chainId: 42161, chainName: 'Arbitrum', envSuffix: 'ARBITRUM' },
  { chainId: 11155111, chainName: 'Sepolia', envSuffix: 'SEPOLIA' },
  { chainId: 84532, chainName: 'Base Sepolia', envSuffix: 'BASE_SEPOLIA' },
] as const

function readEnv(key: string): string | undefined {
  const value = (import.meta.env as Record<string, string | undefined>)[key]
  return value?.trim() || undefined
}

function isAddress(value: string | undefined): value is `0x${string}` {
  return Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value))
}

export function resolveGrsEvmConfig(chainId: number): GrsEvmConfig | null {
  const chain = EVM_CHAINS.find((item) => item.chainId === chainId)
  if (!chain) return null

  const address = readEnv(`VITE_GRS_${chain.envSuffix}_TOKEN`)
  if (!isAddress(address)) return null

  return {
    kind: 'evm',
    chainId: chain.chainId,
    chainName: chain.chainName,
    address,
  }
}

export function listConfiguredGrsChains(): GrsEvmConfig[] {
  return EVM_CHAINS.map((chain) => resolveGrsEvmConfig(chain.chainId)).filter(
    (config): config is GrsEvmConfig => config !== null,
  )
}

export function isGrsConfiguredAnywhere(): boolean {
  return listConfiguredGrsChains().length > 0
}

export function resolveGrsHomeChain(
  snapshot: { home: boolean; homeChain: GrsEvmConfig | null } | null,
  config: GrsEvmConfig | null,
  configuredChains: GrsEvmConfig[] = listConfiguredGrsChains(),
): GrsEvmConfig | null {
  if (snapshot?.home && config) return config
  if (snapshot?.homeChain) return snapshot.homeChain
  return (
    configuredChains.find((item) => item.chainId === 11155111) ??
    configuredChains.find((item) => item.chainId === 1) ??
    configuredChains[0] ??
    null
  )
}

export const grsExplorerTokenUrl = evmExplorerTokenUrl
export const grsExplorerTxUrl = evmExplorerTxUrl
export const grsExplorerAccountUrl = evmExplorerAccountUrl
