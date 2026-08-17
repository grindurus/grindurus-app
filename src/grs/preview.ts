import { getAddress } from 'viem'
import { NATIVE_EVM_ASSET } from '../grai/evm/constants'
import { resolveEvmGraiAsset } from '../grai/evm/knownAssets'
import { GRS_DECIMALS, NATIVE_QUOTE } from './constants'
import type { GrsSale, GrsVesting } from './evm/readProtocol'

const MONTH = 30 * 24 * 60 * 60
const E18 = 10n ** BigInt(GRS_DECIMALS)
const USDC = getAddress('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')

function grs(amount: bigint): bigint {
  return amount * E18
}

/** Preview counterparts of live parties. Checksummed, not deployed. */
export const MOCK_GRS_PARTIES = {
  foundation: getAddress('0x8f3c2a91b0d47e56c4a19b7e8d02f6c1a3e5b847'),
  treasury: getAddress('0x1e90c4a2b7d8356f9c0a4e1d8b3f2750c6a4d921'),
  coreTeam: getAddress('0x5b2d1f88c0a94e376d1c8a2b7e4f9053c6d0a214'),
  seedSpv: getAddress('0x9c70e2a1d4b6385f0e8c1a7d3b294f56a10c8e32'),
  advisors: getAddress('0x2a8f06c4d91e7b50a3c1f6e8d042b9754e6c0d18'),
  holder: getAddress('0xd81c4a0e6f27593b1c8e2d4a7f90536b0c1a8e24'),
} as const

const PARTY_NAMES: Record<string, string> = {
  [MOCK_GRS_PARTIES.foundation.toLowerCase()]: 'Foundation',
  [MOCK_GRS_PARTIES.treasury.toLowerCase()]: 'Treasury',
  [MOCK_GRS_PARTIES.coreTeam.toLowerCase()]: 'Core team multisig',
  [MOCK_GRS_PARTIES.seedSpv.toLowerCase()]: 'Pre-seed SPV',
  [MOCK_GRS_PARTIES.advisors.toLowerCase()]: 'Advisor pool',
  [MOCK_GRS_PARTIES.holder.toLowerCase()]: 'Holder vest',
}

function usdcMeta() {
  return resolveEvmGraiAsset(USDC)
}

function ethMeta() {
  return resolveEvmGraiAsset(NATIVE_EVM_ASSET)
}

function tokens(amount: bigint): bigint {
  return grs(amount)
}

/** Quote units due for `amount` GRS from remaining `assetAmount` / `remaining`. */
export function mockQuoteSaleCost(amount: bigint, remaining: bigint, assetAmount: bigint): bigint {
  if (amount === 0n || remaining === 0n || assetAmount === 0n) return 0n
  if (amount === remaining) return assetAmount
  return (amount * assetAmount) / remaining
}

export function partyName(address: string): string | undefined {
  return PARTY_NAMES[address.toLowerCase()]
}

const eth = ethMeta()
const usdc = usdcMeta()

/** Home TGE book: ETH + USDC public sales, proceeds to Foundation / Treasury. */
export const MOCK_GRS_SALES: GrsSale[] = [
  {
    id: 1n,
    asset: NATIVE_QUOTE,
    assetAmount: 80_000_000n * 40_000_000_000_000n,
    recipient: MOCK_GRS_PARTIES.foundation,
    grsAmount: grs(80_000_000n),
    quoteSymbol: eth.symbol,
    quoteDecimals: 18,
    quoteIcon: eth.icon.src,
    native: true,
  },
  {
    id: 2n,
    asset: USDC,
    assetAmount: 61_800_000n * 120_000n,
    recipient: MOCK_GRS_PARTIES.treasury,
    grsAmount: grs(61_800_000n),
    quoteSymbol: usdc.symbol,
    quoteDecimals: 6,
    quoteIcon: usdc.icon.src,
    native: false,
  },
]

export const MOCK_TOKEN_SALES_REMAINING = grs(141_800_000n)

function vestedAmount(allocation: bigint, cliffEnd: number, end: number, timestamp: number): bigint {
  if (timestamp < cliffEnd) return 0n
  if (end <= cliffEnd || timestamp >= end) return allocation
  return (allocation * BigInt(timestamp - cliffEnd)) / BigInt(end - cliffEnd)
}

function mockVest(row: {
  id: bigint
  bucket: number
  beneficiary: `0x${string}`
  allocation: bigint
  released: bigint
  start: number
  cliffMonths: number
  linearMonths: number
  now: number
}): GrsVesting {
  const cliffEnd = row.start + row.cliffMonths * MONTH
  const end = cliffEnd + row.linearMonths * MONTH
  const due = vestedAmount(row.allocation, cliffEnd, end, row.now)
  return {
    id: row.id,
    bucket: row.bucket,
    funder: MOCK_GRS_PARTIES.foundation,
    beneficiary: row.beneficiary,
    allocation: row.allocation,
    released: row.released,
    start: row.start,
    cliffEnd,
    end,
    releasable: due > row.released ? due - row.released : 0n,
  }
}

/** Grant book + one holder vest, relative to now so cliffs/unlocks look live. */
export function mockGrsVestings(now = Math.floor(Date.now() / 1000)): GrsVesting[] {
  return [
    mockVest({
      id: 1n,
      bucket: 4,
      beneficiary: MOCK_GRS_PARTIES.coreTeam,
      allocation: grs(12_500_000n),
      released: grs(400_000n),
      start: now - 14 * MONTH,
      cliffMonths: 12,
      linearMonths: 60,
      now,
    }),
    mockVest({
      id: 2n,
      bucket: 1,
      beneficiary: MOCK_GRS_PARTIES.seedSpv,
      allocation: grs(8_000_000n),
      released: 0n,
      start: now - 18 * MONTH,
      cliffMonths: 0,
      linearMonths: 24,
      now,
    }),
    mockVest({
      id: 3n,
      bucket: 5,
      beneficiary: MOCK_GRS_PARTIES.advisors,
      allocation: grs(2_000_000n),
      released: 0n,
      start: now - 8 * MONTH,
      cliffMonths: 6,
      linearMonths: 66,
      now,
    }),
    mockVest({
      id: 4n,
      bucket: 11,
      beneficiary: MOCK_GRS_PARTIES.holder,
      allocation: tokens(250_000n),
      released: tokens(20_000n),
      start: now - 90 * 24 * 60 * 60,
      cliffMonths: 0,
      linearMonths: 12,
      now,
    }),
  ]
}
