export type GrinderConfig = {
  id: string
  name: string
  custodyWallet?: string
}

export function grinderCustodyAddress(
  config: Pick<GrinderConfig, 'custodyWallet'>,
  parsedWallet: { toBase58(): string } | null = null,
): string {
  const configured = config.custodyWallet?.trim()
  if (configured) return configured
  return parsedWallet?.toBase58() ?? ''
}

function envCustodyWallet(id: string): string | undefined {
  const value = import.meta.env[`VITE_${id.toUpperCase()}_CUSTODY_WALLET`]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/** Shared dev custody wallet from `grindurus-solana/migrations/keys/`. Override per grinder via env. */
const SHARED_DEV_CUSTODY_WALLET = 'ESQJJhS9r19ddW9276dUz9GYGhgtNLWC7tRV1uDogtNK'

export function resolveGrinderCustodyWallet(id: string): string | undefined {
  return envCustodyWallet(id) ?? envCustodyWallet('default') ?? SHARED_DEV_CUSTODY_WALLET
}

export const KNOWN_GRINDERS: GrinderConfig[] = [
  { id: 'grinder1', name: 'grinder1', custodyWallet: resolveGrinderCustodyWallet('grinder1') },
  { id: 'grinder2', name: 'grinder2', custodyWallet: resolveGrinderCustodyWallet('grinder2') },
  { id: 'grinder3', name: 'grinder3', custodyWallet: resolveGrinderCustodyWallet('grinder3') },
  { id: 'grinder4', name: 'grinder4', custodyWallet: resolveGrinderCustodyWallet('grinder4') },
]
