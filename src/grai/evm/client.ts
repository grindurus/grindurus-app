import { createPublicClient } from 'viem'
import { arbitrum, base, baseSepolia, mainnet, sepolia } from 'wagmi/chains'
import type { GraiEvmConfig } from '../deployments'
import { evmHttpTransport } from '../../providers/evmTransports'

const CHAINS = [mainnet, base, arbitrum, sepolia, baseSepolia] as const

export function resolveGraiContractAddress(config: GraiEvmConfig): `0x${string}` {
  const address = config.protocolAddress ?? config.graiToken
  if (!address) {
    throw new Error('GRAI EVM contract address is not configured')
  }
  return address
}

export function createGraiEvmPublicClient(config: GraiEvmConfig) {
  const chain = CHAINS.find((item) => item.id === config.chainId)
  if (!chain) {
    throw new Error(`Unsupported EVM chain id: ${config.chainId}`)
  }

  return createPublicClient({
    chain,
    transport: evmHttpTransport(chain.id),
  })
}
