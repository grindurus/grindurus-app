import { PublicKey } from '@solana/web3.js'
import type { NormalizedCustodyHolding } from './custodyHoldings'
import type { CustodyAssetBalances } from './fetchCustodyWalletBalances'
import { grinderCustodyAddress, type GrinderConfig } from './grinders'

export type GrinderCustodyState = {
  id: string
  name: string
  custodyWallet: PublicKey | null
  custodyWalletAddress: string
  /** Live Solana on-chain balances keyed by mint (used by allocate / distribute txs). */
  balances: Record<string, CustodyAssetBalances>
  /** Merged backend + on-chain holdings for display (multi-network ready). */
  holdings: NormalizedCustodyHolding[]
}

export function parseCustodyWallet(value: string | undefined): PublicKey | null {
  if (!value?.trim()) return null
  try {
    return new PublicKey(value.trim())
  } catch {
    return null
  }
}

export function toGrinderCustodyRow(grinder: GrinderConfig): GrinderCustodyState {
  const custodyWallet = parseCustodyWallet(grinder.custodyWallet)
  return {
    id: grinder.id,
    name: grinder.name,
    custodyWallet,
    custodyWalletAddress: grinderCustodyAddress(grinder, custodyWallet),
    balances: {},
    holdings: [],
  }
}
