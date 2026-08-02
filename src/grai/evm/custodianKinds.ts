import { keccak256, stringToHex, type Hex } from 'viem'

export type CustodianKindOption = {
  id: 'cow' | 'lifi' | 'explicit_swap'
  label: string
  kindHash: Hex
  source: string
}

function kindHash(label: string): Hex {
  return keccak256(stringToHex(label))
}

/** Known GrindURUS custodian kind hashes (must match on-chain `custodianKind()`). */
export const KNOWN_CUSTODIAN_KINDS: readonly CustodianKindOption[] = [
  {
    id: 'cow',
    label: 'CoW',
    kindHash: kindHash('grindurus.custodian.cow'),
    source: 'grindurus.custodian.cow',
  },
  {
    id: 'lifi',
    label: 'LiFi',
    kindHash: kindHash('grindurus.custodian.lifi'),
    source: 'grindurus.custodian.lifi',
  },
  {
    id: 'explicit_swap',
    label: 'Explicit Swap',
    kindHash: kindHash('grindurus.custodian.explicit_swap'),
    source: 'grindurus.custodian.explicit_swap',
  },
] as const
