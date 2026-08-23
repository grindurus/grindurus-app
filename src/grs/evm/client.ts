import { createPublicClient } from 'viem'
import { arbitrum, base, baseSepolia, mainnet, sepolia } from 'wagmi/chains'
import type { GrsEvmConfig } from '../deployments'
import { evmHttpTransport } from '../../providers/evmTransports'

const CHAINS = [mainnet, base, arbitrum, sepolia, baseSepolia] as const

export function createGrsEvmPublicClient(config: GrsEvmConfig) {
  const chain = CHAINS.find((item) => item.id === config.chainId)
  if (!chain) {
    throw new Error(`Unsupported EVM chain id: ${config.chainId}`)
  }

  return createPublicClient({
    chain,
    transport: evmHttpTransport(chain.id),
  })
}
