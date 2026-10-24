import { fallback, http, type Transport } from 'viem'
import { arbitrum, base, mainnet, polygon, sepolia } from 'wagmi/chains'

/** Optional override: `VITE_SEPOLIA_RPC_URL`, `VITE_ETHEREUM_RPC_URL`, … */
function envRpc(chainId: number): string | undefined {
  const byId: Record<number, string | undefined> = {
    [mainnet.id]: import.meta.env.VITE_ETHEREUM_RPC_URL,
    [base.id]: import.meta.env.VITE_BASE_RPC_URL,
    [arbitrum.id]: import.meta.env.VITE_ARBITRUM_RPC_URL,
    [polygon.id]: import.meta.env.VITE_POLYGON_RPC_URL,
    [sepolia.id]: import.meta.env.VITE_SEPOLIA_RPC_URL,
  }
  const raw = byId[chainId]?.trim()
  return raw || undefined
}

/** Public endpoints when wagmi/viem default (often thirdweb) flakes in the browser. */
const PUBLIC_FALLBACKS: Partial<Record<number, string[]>> = {
  [sepolia.id]: [
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://rpc.ankr.com/eth_sepolia',
  ],
  [mainnet.id]: ['https://ethereum-rpc.publicnode.com'],
  [base.id]: ['https://base-rpc.publicnode.com'],
  [arbitrum.id]: ['https://arbitrum-one-rpc.publicnode.com'],
  [polygon.id]: ['https://polygon-bor-rpc.publicnode.com', 'https://polygon-rpc.com'],
}

/**
 * JSON-RPC 2.0 batching — coalesce concurrent `eth_*` into one POST.
 * Wider `wait` catches reads across async ticks / React effects.
 * @see https://www.jsonrpc.org/specification#batch
 */
const HTTP_BATCH = { batchSize: 100, wait: 50 } as const

function batchedHttp(url?: string): Transport {
  return http(url, { batch: HTTP_BATCH })
}

/** One transport instance per chain so batch schedulers are shared app-wide. */
const transportByChain = new Map<number, Transport>()

/** Prefer env → public backups → chain default (`http()` / thirdweb). */
export function evmHttpTransport(chainId: number): Transport {
  const cached = transportByChain.get(chainId)
  if (cached) return cached

  const urls: string[] = []
  const fromEnv = envRpc(chainId)
  if (fromEnv) urls.push(fromEnv)
  for (const u of PUBLIC_FALLBACKS[chainId] ?? []) {
    if (!urls.includes(u)) urls.push(u)
  }
  const list = [...urls.map((u) => batchedHttp(u)), batchedHttp()]
  const transport = list.length === 1 ? list[0]! : fallback(list)
  transportByChain.set(chainId, transport)
  return transport
}
