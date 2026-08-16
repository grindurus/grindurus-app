import { zeroAddress } from 'viem'
import type { GraiEvmConfig } from '../deployments'
import { graiAbi, treasuryAbi } from './abi'
import { createGraiEvmPublicClient, resolveGraiContractAddress } from './client'

export type EvmReferralBookEntry = {
  locker: `0x${string}`
  referrer: `0x${string}`
  /** Cashflow NFT owner (`ownerOf(uint160(locker))`). */
  owner: `0x${string}`
  value: bigint
  l1Value: bigint
  l2Value: bigint
}

export type GraiReferralTreeNode = {
  locker: `0x${string}`
  referrer: `0x${string}`
  owner: `0x${string}`
  value: bigint
  l1Value: bigint
  l2Value: bigint
  label?: string
  children: GraiReferralTreeNode[]
}

const PAGE_SIZE = 100n

export async function fetchEvmReferralBooks(config: GraiEvmConfig): Promise<EvmReferralBookEntry[]> {
  const client = createGraiEvmPublicClient(config)
  const graiAddress = resolveGraiContractAddress(config)
  const treasuryAddress = await client.readContract({
    address: graiAddress,
    abi: graiAbi,
    functionName: 'treasury',
  })
  if (!treasuryAddress || treasuryAddress === zeroAddress) return []

  const total = await client.readContract({
    address: treasuryAddress,
    abi: treasuryAbi,
    functionName: 'totalSupply',
  })
  if (total <= 0n) return []

  const rows: EvmReferralBookEntry[] = []
  for (let from = 0n; from < total; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE > total ? total : from + PAGE_SIZE
    const page = await client.readContract({
      address: treasuryAddress,
      abi: treasuryAbi,
      functionName: 'getReferralsData',
      args: [from, to],
    })
    for (const item of page) {
      rows.push({
        locker: item.locker,
        referrer: item.book.referrer,
        owner: item.ownerOf,
        value: item.book.value,
        l1Value: item.book.l1Value,
        l2Value: item.book.l2Value,
      })
    }
  }
  return rows
}

const SOLANA_PUBKEY_DEFAULT = '11111111111111111111111111111111'

function addressKey(address: string): string {
  return address.startsWith('0x') || address.startsWith('0X') ? address.toLowerCase() : address
}

function isRootReferrer(locker: string, referrer: string): boolean {
  const ref = addressKey(referrer)
  const loc = addressKey(locker)
  return !ref || ref === zeroAddress || ref === SOLANA_PUBKEY_DEFAULT || ref === loc
}

/** Build forest from sticky `referrerOf` edges. Self-roots and missing uplines become roots. */
export function buildReferralForest(entries: EvmReferralBookEntry[]): GraiReferralTreeNode[] {
  const byLocker = new Map<string, GraiReferralTreeNode>()

  for (const entry of entries) {
    const key = addressKey(entry.locker)
    byLocker.set(key, {
      locker: entry.locker,
      referrer: entry.referrer,
      owner: entry.owner,
      value: entry.value,
      l1Value: entry.l1Value,
      l2Value: entry.l2Value,
      children: [],
    })
  }

  const roots: GraiReferralTreeNode[] = []
  for (const node of byLocker.values()) {
    if (isRootReferrer(node.locker, node.referrer)) {
      roots.push(node)
      continue
    }
    const parent = byLocker.get(addressKey(node.referrer))
    if (!parent || parent === node) {
      roots.push(node)
      continue
    }
    parent.children.push(node)
  }

  const sortNodes = (nodes: GraiReferralTreeNode[]) => {
    nodes.sort((a, b) => {
      if (b.value !== a.value) return b.value > a.value ? 1 : -1
      return a.locker.localeCompare(b.locker)
    })
    for (const node of nodes) sortNodes(node.children)
  }
  sortNodes(roots)
  return roots
}

/** Docs-style illustration when the chain has no referral NFTs yet. */
export function buildExampleReferralForest(): GraiReferralTreeNode[] {
  const scale = 10n ** 6n
  const alice = '0xA11CE00000000000000000000000000000000001' as `0x${string}`
  const bob = '0xB0B0000000000000000000000000000000000002' as `0x${string}`
  const carol = '0xCA20100000000000000000000000000000000003' as `0x${string}`
  const dave = '0xDAVE000000000000000000000000000000000004' as `0x${string}`
  const eve = '0xEVE0000000000000000000000000000000000005' as `0x${string}`
  const frank = '0xF1A6000000000000000000000000000000000006' as `0x${string}`
  const grace = '0x61ACE00000000000000000000000000000000007' as `0x${string}`
  const hank = '0xHA60000000000000000000000000000000000008' as `0x${string}`
  const ivy = '0x1VY0000000000000000000000000000000000009' as `0x${string}`
  const vaho = '0xVAH00000000000000000000000000000000000A' as `0x${string}`
  /** Demo OTC buyer of Bob's cashflow NFT (tree seat still under Alice). */
  const otcBuyer = '0x07C00000000000000000000000000000000000B' as `0x${string}`

  const selfOwned = (locker: `0x${string}`): Pick<GraiReferralTreeNode, 'owner'> => ({
    owner: locker,
  })

  return [
    {
      locker: alice,
      referrer: alice,
      ...selfOwned(alice),
      value: 100n * scale,
      l1Value: 80n * scale,
      l2Value: 46n * scale,
      children: [
        {
          locker: bob,
          referrer: alice,
          owner: otcBuyer,
          value: 50n * scale,
          l1Value: 40n * scale,
          l2Value: 6n * scale,
          children: [
            {
              locker: carol,
              referrer: bob,
              ...selfOwned(carol),
              value: 25n * scale,
              l1Value: 0n,
              l2Value: 0n,
              children: [],
            },
            {
              locker: dave,
              referrer: bob,
              ...selfOwned(dave),
              value: 15n * scale,
              l1Value: 6n * scale,
              l2Value: 0n,
              children: [
                {
                  locker: vaho,
                  referrer: dave,
                  ...selfOwned(vaho),
                  value: 6n * scale,
                  l1Value: 0n,
                  l2Value: 0n,
                  children: [],
                },
              ],
            },
          ],
        },
        {
          locker: eve,
          referrer: alice,
          ...selfOwned(eve),
          value: 35n * scale,
          l1Value: 20n * scale,
          l2Value: 0n,
          children: [
            {
              locker: frank,
              referrer: eve,
              ...selfOwned(frank),
              value: 12n * scale,
              l1Value: 0n,
              l2Value: 0n,
              children: [],
            },
            {
              locker: grace,
              referrer: eve,
              ...selfOwned(grace),
              value: 8n * scale,
              l1Value: 0n,
              l2Value: 0n,
              children: [],
            },
          ],
        },
      ],
    },
    {
      locker: hank,
      referrer: hank,
      ...selfOwned(hank),
      value: 22n * scale,
      l1Value: 9n * scale,
      l2Value: 0n,
      children: [
        {
          locker: ivy,
          referrer: hank,
          ...selfOwned(ivy),
          value: 9n * scale,
          l1Value: 0n,
          l2Value: 0n,
          children: [],
        },
      ],
    },
  ]
}
