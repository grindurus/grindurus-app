/**
 * TEMPORARY — GRS disables Mainnet in the header toggle until mainnet ships.
 *
 * To unlock later: set `false` (Header already no-ops when this is false).
 */
export const GRS_TESTNET_ONLY = true

export function isGrsTestnetPinned(): boolean {
  return GRS_TESTNET_ONLY
}
