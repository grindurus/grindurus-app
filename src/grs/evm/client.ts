import { createPublicClient } from 'viem'
import { arbitrum, base, baseSepolia, mainnet, sepolia } from 'wagmi/chains'
import type { GrsEvmConfig } from '../deployments'
import { evmHttpTransport } from '../../wallets/evmTransports'

const CHAINS = [mainnet, base, arbitrum, sepolia, baseSepolia] as const

const MULTICALL_BATCH = { multicall: { batchSize: 1024, wait: 50 } } as const

const clientByChainId = new Map<number, ReturnType<typeof createPublicClient>>()

export function createGrsEvmPublicClient(config: GrsEvmConfig) {
  const chain = CHAINS.find((item) => item.id === config.chainId)
  if (!chain) {
    throw new Error(`Unsupported EVM chain id: ${config.chainId}`)
  }

  const cached = clientByChainId.get(chain.id)
  if (cached) return cached as ReturnType<typeof createPublicClient>

  const client = createPublicClient({
    chain,
    transport: evmHttpTransport(chain.id),
    batch: MULTICALL_BATCH,
  })
  clientByChainId.set(chain.id, client as ReturnType<typeof createPublicClient>)
  return client
}
