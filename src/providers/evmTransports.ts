import { fallback, http, type Transport } from 'viem'
import { arbitrum, base, mainnet, sepolia } from 'wagmi/chains'

/** Optional override: `VITE_SEPOLIA_RPC_URL`, `VITE_ETHEREUM_RPC_URL`, … */
function envRpc(chainId: number): string | undefined {
  const byId: Record<number, string | undefined> = {
    [mainnet.id]: import.meta.env.VITE_ETHEREUM_RPC_URL,
    [base.id]: import.meta.env.VITE_BASE_RPC_URL,
    [arbitrum.id]: import.meta.env.VITE_ARBITRUM_RPC_URL,
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
}

/** Prefer env → public backups → chain default (`http()` / thirdweb). */
export function evmHttpTransport(chainId: number): Transport {
  const urls: string[] = []
  const fromEnv = envRpc(chainId)
  if (fromEnv) urls.push(fromEnv)
  for (const u of PUBLIC_FALLBACKS[chainId] ?? []) {
    if (!urls.includes(u)) urls.push(u)
  }
  const list = [...urls.map((u) => http(u)), http()]
  return list.length === 1 ? list[0]! : fallback(list)
}
