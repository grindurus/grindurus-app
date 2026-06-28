export type GrinderConfig = {
  id: string
  name: string
  custodyWallet?: string
}

function envCustodyWallet(id: string): string | undefined {
  const value = import.meta.env[`VITE_${id.toUpperCase()}_CUSTODY_WALLET`]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export const KNOWN_GRINDERS: GrinderConfig[] = [
  { id: 'grinder1', name: 'grinder1', custodyWallet: envCustodyWallet('grinder1') },
  { id: 'grinder2', name: 'grinder2', custodyWallet: envCustodyWallet('grinder2') },
  { id: 'grinder3', name: 'grinder3', custodyWallet: envCustodyWallet('grinder3') },
  { id: 'grinder4', name: 'grinder4', custodyWallet: envCustodyWallet('grinder4') },
]
