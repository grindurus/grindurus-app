export const SOLANA_MAINNET_GENESIS = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
export const SOLANA_DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1'

export function evmChainIdToCaip2(chainId: number): string {
  return `eip155:${chainId}`
}

export function solanaClusterToCaip2(cluster: 'mainnet-beta' | 'devnet'): string {
  // MetaMask Multichain requires genesis-hash CAIP-2 (not `solana:devnet` alias).
  return cluster === 'mainnet-beta'
    ? `solana:${SOLANA_MAINNET_GENESIS}`
    : `solana:${SOLANA_DEVNET_GENESIS}`
}

export function normalizeCaip2Network(network?: string | null): string | null {
  const value = network?.trim()
  if (!value) return null

  if (value.startsWith('eip155:')) {
    const chainId = Number.parseInt(value.slice('eip155:'.length), 10)
    return Number.isFinite(chainId) ? evmChainIdToCaip2(chainId) : null
  }

  if (value.startsWith('solana:')) {
    const reference = value.slice('solana:'.length).toLowerCase()
    if (reference === 'mainnet' || reference === 'mainnet-beta') return 'solana:mainnet-beta'
    if (reference === 'devnet') return 'solana:devnet'
    if (reference === SOLANA_MAINNET_GENESIS.toLowerCase()) return 'solana:mainnet-beta'
    if (reference === SOLANA_DEVNET_GENESIS.toLowerCase()) return 'solana:devnet'
    return `solana:${reference}`
  }

  return null
}

export function caip2NetworksMatch(left?: string | null, right?: string | null): boolean {
  const normalizedLeft = normalizeCaip2Network(left)
  const normalizedRight = normalizeCaip2Network(right)
  if (!normalizedLeft || !normalizedRight) return false
  return normalizedLeft === normalizedRight
}

export function grinderRowMatchesCaip2Network(
  row: { network?: string },
  walletNetworkCaip2?: string | null,
): boolean {
  const grinderNetwork = row.network?.trim()
  if (!grinderNetwork || !walletNetworkCaip2) return false
  return caip2NetworksMatch(grinderNetwork, walletNetworkCaip2)
}
