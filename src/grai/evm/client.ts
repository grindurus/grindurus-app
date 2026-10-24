import { createPublicClient } from 'viem'
import { arbitrum, base, baseSepolia, mainnet, sepolia } from 'wagmi/chains'
import type { GraiEvmConfig } from '../deployments'
import { evmHttpTransport } from '../../wallets/evmTransports'

const CHAINS = [mainnet, base, arbitrum, sepolia, baseSepolia] as const

/** Multicall3 packs concurrent contract reads into one `eth_call` (then JSON-RPC batch). */
const MULTICALL_BATCH = { multicall: { batchSize: 1024, wait: 50 } } as const

/** Per-chain cache (widened — viem client generics differ by chain). */
const clientByChainId = new Map<number, ReturnType<typeof createPublicClient>>()

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
