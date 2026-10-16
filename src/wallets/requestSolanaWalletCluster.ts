import type { WalletSolanaCluster } from './solanaWalletTypes'
import { SOLANA_DEVNET_CAIP2, SOLANA_MAINNET_CAIP2 } from './standardSignWithChain'

type SolanaProviderLike = {
  isPhantom?: boolean
  isSolflare?: boolean
  switchNetwork?: (network: string) => Promise<unknown>
  request?: (args: { method: string; params?: unknown }) => Promise<unknown>
}

function collectProviders(): SolanaProviderLike[] {
  if (typeof window === 'undefined') return []
  const w = window as Window & {
    phantom?: { solana?: SolanaProviderLike }
    solflare?: SolanaProviderLike
    backpack?: SolanaProviderLike
    solana?: SolanaProviderLike
  }
  const list = [w.phantom?.solana, w.solflare, w.backpack, w.solana]
  return list.filter((p): p is SolanaProviderLike => Boolean(p))
}

/**
 * Best-effort prompt for the injected Solana wallet to switch cluster.
 * Many wallets have no public API — returns false when none accepted the request.
 */
export async function requestSolanaWalletCluster(
  cluster: WalletSolanaCluster,
): Promise<boolean> {
  const network = cluster === 'devnet' ? 'devnet' : 'mainnet'
  const genesisHash = cluster === 'devnet' ? SOLANA_DEVNET_CAIP2 : SOLANA_MAINNET_CAIP2
  const chain = genesisHash

  for (const provider of collectProviders()) {
    if (typeof provider.switchNetwork === 'function') {
      try {
        await provider.switchNetwork(network)
        return true
      } catch {
        // try next shape
      }
    }

    if (typeof provider.request !== 'function') continue

    const attempts: Array<{ method: string; params?: unknown }> = [
      { method: 'wallet_switchNetwork', params: { network } },
      { method: 'wallet_changeNetwork', params: { network } },
      { method: 'switchNetwork', params: { network } },
      { method: 'changeNetwork', params: { network } },
      { method: 'wallet_switchChain', params: { chain } },
      { method: 'wallet_switchChain', params: { chainId: chain } },
    ]

    for (const attempt of attempts) {
      try {
        await provider.request(attempt)
        return true
      } catch {
        // try next
      }
    }
  }

  return false
}
