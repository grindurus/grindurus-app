import { erc20Abi, getAddress } from 'viem'
import {
  LZ_EID_META,
  NATIVE_QUOTE,
  TOKEN_SALES_BUCKET,
  isSolanaLzEid,
  lzEndpointLabel,
} from '../constants'
import type { GrsEvmConfig } from '../deployments'
import { listConfiguredGrsChains } from '../deployments'
import { grsAbi } from './abi'
import { createGrsEvmPublicClient } from './client'
import { isNativeEvmAsset, resolveEvmGraiAsset } from '../../grai/evm/knownAssets'

export type GrsPeer = {
  eid: number
  peer: `0x${string}`
  name: string
  solana: boolean
  chainId?: number
}

export type GrsSale = {
  id: bigint
  asset: `0x${string}`
  assetAmount: bigint
  grsAmount: bigint
  recipient: `0x${string}`
  quoteSymbol: string
  quoteDecimals: number
  quoteIcon: string
  native: boolean
}

export type GrsVesting = {
  id: bigint
  bucket: number
  funder: `0x${string}`
  beneficiary: `0x${string}`
  allocation: bigint
  released: bigint
  start: number
  cliffEnd: number
  end: number
  releasable: bigint
}

export type GrsAllocation = {
  bucket: number
  cap: bigint
  spent: bigint
  remaining: bigint
  gate: number
  cliffMonths: number
  linearMonths: number
}

export type GrsSnapshot = {
  home: boolean
  decimals: number
  maxSupply: bigint
  tokenSalesRemaining: bigint | null
  allocations: GrsAllocation[] | null
  balance: bigint
  peers: GrsPeer[]
  sales: GrsSale[]
  vestings: GrsVesting[]
  vestingCount: bigint
  homeChain: GrsEvmConfig | null
}

const SALE_PAGE = 50n
const VESTING_PAGE = 100n
const VESTING_SCAN_CAP = 2000n

function quoteBytes32ToAddress(quote: `0x${string}`): `0x${string}` {
  return getAddress(`0x${quote.slice(-40)}`)
}

function isNativeQuote(quote: string): boolean {
  return /^0x0+$/i.test(quote)
}

function wordToPayee(word: `0x${string}`): `0x${string}` {
  if (isNativeQuote(word)) return '0x0000000000000000000000000000000000000000'
  const high = word.startsWith('0x') ? word.slice(2, -40) : word.slice(0, -40)
  if (/^0+$/i.test(high)) return quoteBytes32ToAddress(word)
  return word
}

async function readQuoteMeta(
  config: GrsEvmConfig,
  quote: `0x${string}`,
): Promise<{ symbol: string; decimals: number; icon: string }> {
  if (isNativeEvmAsset(quote)) {
    return { symbol: 'ETH', decimals: 18, icon: resolveEvmGraiAsset(quote).icon.src }
  }

  const client = createGrsEvmPublicClient(config)
  const known = resolveEvmGraiAsset(quote)
  const [decimals, symbol] = await Promise.all([
    client.readContract({ address: quote, abi: erc20Abi, functionName: 'decimals' }).catch(() => 18),
    client.readContract({ address: quote, abi: erc20Abi, functionName: 'symbol' }).catch(() => known.symbol),
  ])

  return {
    symbol: String(symbol),
    decimals: Number(decimals),
    icon: known.icon.src,
  }
}

async function fetchAllSales(config: GrsEvmConfig): Promise<GrsSale[]> {
  const client = createGrsEvmPublicClient(config)
  const count = await client.readContract({
    address: config.address,
    abi: grsAbi,
    functionName: 'saleCount',
  })
  if (count === 0n) return []

  const listed: GrsSale[] = []
  for (let offset = 0n; offset < count; offset += SALE_PAGE) {
    const page = await client.readContract({
      address: config.address,
      abi: grsAbi,
      functionName: 'getSales',
      args: [offset, SALE_PAGE],
    })
    const metas = await Promise.all(
      page.map(async (row) => {
        const native = isNativeQuote(row.asset)
        const token = native ? NATIVE_QUOTE : quoteBytes32ToAddress(row.asset)
        return {
          ...(await readQuoteMeta(config, token)),
          native,
          token,
        }
      }),
    )
    page.forEach((row, index) => {
      const id = offset + BigInt(index) + 1n
      if (row.assetAmount === 0n || row.grsAmount === 0n) return
      listed.push({
        id,
        asset: metas[index].token,
        assetAmount: row.assetAmount,
        recipient: wordToPayee(row.recipient),
        grsAmount: row.grsAmount,
        quoteSymbol: metas[index].symbol,
        quoteDecimals: metas[index].decimals,
        quoteIcon: metas[index].icon,
        native: metas[index].native,
      })
    })
  }
  return listed
}

async function fetchWalletVestings(
  config: GrsEvmConfig,
  owner: `0x${string}` | undefined,
): Promise<{ vestings: GrsVesting[]; vestingCount: bigint }> {
  const client = createGrsEvmPublicClient(config)
  const vestingCount = await client.readContract({
    address: config.address,
    abi: grsAbi,
    functionName: 'vestingCount',
  })
  if (!owner || vestingCount === 0n) return { vestings: [], vestingCount }

  const ownerLower = owner.toLowerCase()
  const vestings: GrsVesting[] = []
  const scanTo = vestingCount > VESTING_SCAN_CAP ? VESTING_SCAN_CAP : vestingCount

  for (let offset = 0n; offset < scanTo; offset += VESTING_PAGE) {
    const page = await client.readContract({
      address: config.address,
      abi: grsAbi,
      functionName: 'getVestings',
      args: [offset, VESTING_PAGE],
    })
    const mine = page.filter(
      (row) =>
        row.beneficiary.toLowerCase() === ownerLower || row.funder.toLowerCase() === ownerLower,
    )
    const amounts = await Promise.all(
      mine.map((row) =>
        client.readContract({
          address: config.address,
          abi: grsAbi,
          functionName: 'releasable',
          args: [row.id],
        }),
      ),
    )
    mine.forEach((row, index) => {
      vestings.push({
        id: row.id,
        bucket: Number(row.bucket),
        funder: getAddress(row.funder),
        beneficiary: getAddress(row.beneficiary),
        allocation: row.allocation,
        released: row.released,
        start: Number(row.start),
        cliffEnd: Number(row.cliffEnd),
        end: Number(row.end),
        releasable: amounts[index],
      })
    })
  }

  vestings.sort((a, b) => {
    if (b.releasable !== a.releasable) return b.releasable > a.releasable ? 1 : -1
    return Number(a.id - b.id)
  })

  return { vestings, vestingCount }
}

async function resolveHomeChain(current: GrsEvmConfig, isHome: boolean): Promise<GrsEvmConfig | null> {
  if (isHome) return current
  const candidates = listConfiguredGrsChains()
  const results = await Promise.all(
    candidates.map(async (item) => {
      try {
        const client = createGrsEvmPublicClient(item)
        const home = await client.readContract({
          address: item.address,
          abi: grsAbi,
          functionName: 'home',
        })
        return home ? item : null
      } catch {
        return null
      }
    }),
  )
  return results.find((item): item is GrsEvmConfig => item !== null) ?? null
}

async function fetchAllocations(config: GrsEvmConfig): Promise<GrsAllocation[] | null> {
  const client = createGrsEvmPublicClient(config)
  try {
    const listed = await client.readContract({
      address: config.address,
      abi: grsAbi,
      functionName: 'getAllocations',
    })
    return listed.map((row) => ({
      bucket: Number(row.bucket),
      cap: row.cap,
      spent: row.spent,
      remaining: row.remaining,
      gate: Number(row.gate),
      cliffMonths: Number(row.cliffMonths),
      linearMonths: Number(row.linearMonths),
    }))
  } catch {
    return null
  }
}

export async function fetchGrsSnapshot(
  config: GrsEvmConfig,
  owner?: `0x${string}`,
): Promise<GrsSnapshot> {
  const client = createGrsEvmPublicClient(config)
  const [home, decimals, maxSupply, peersRaw, sales, vestingPack] = await Promise.all([
    client.readContract({ address: config.address, abi: grsAbi, functionName: 'home' }),
    client.readContract({ address: config.address, abi: grsAbi, functionName: 'decimals' }).catch(() => 18),
    client.readContract({ address: config.address, abi: grsAbi, functionName: 'MAX_SUPPLY' }).catch(() => 0n),
    client.readContract({ address: config.address, abi: grsAbi, functionName: 'getPeers' }).catch(() => []),
    fetchAllSales(config).catch(() => [] as GrsSale[]),
    fetchWalletVestings(config, owner).catch(() => ({ vestings: [] as GrsVesting[], vestingCount: 0n })),
  ])

  const homeChain = await resolveHomeChain(config, home)
  const allocationSource = home ? config : homeChain
  const [tokenSalesRemaining, allocations] = await Promise.all([
    client
      .readContract({
        address: config.address,
        abi: grsAbi,
        functionName: 'remaining',
        args: [TOKEN_SALES_BUCKET],
      })
      .catch(() => null),
    allocationSource ? fetchAllocations(allocationSource) : Promise.resolve(null),
  ])
  const salesLeft =
    tokenSalesRemaining ?? allocations?.find((row) => row.bucket === TOKEN_SALES_BUCKET)?.remaining ?? null

  const balance = owner
    ? await client.readContract({
        address: config.address,
        abi: grsAbi,
        functionName: 'balanceOf',
        args: [owner],
      })
    : 0n

  const peers: GrsPeer[] = peersRaw
    .filter((row) => row.peer !== '0x0000000000000000000000000000000000000000000000000000000000000000')
    .map((row) => {
      const eid = Number(row.eid)
      return {
        eid,
        peer: row.peer,
        name: lzEndpointLabel(eid),
        solana: isSolanaLzEid(eid),
        chainId: LZ_EID_META[eid]?.chainId,
      }
    })

  return {
    home,
    decimals: Number(decimals),
    maxSupply,
    tokenSalesRemaining: salesLeft,
    allocations,
    balance,
    peers,
    sales,
    vestings: vestingPack.vestings,
    vestingCount: vestingPack.vestingCount,
    homeChain,
  }
}

export async function previewGrsBuy(
  config: GrsEvmConfig,
  saleId: bigint,
  amount: bigint,
): Promise<bigint> {
  const client = createGrsEvmPublicClient(config)
  return client.readContract({
    address: config.address,
    abi: grsAbi,
    functionName: 'previewBuy',
    args: [saleId, amount],
  })
}

export async function quoteGrsBridge(
  config: GrsEvmConfig,
  dstEid: number,
  to: `0x${string}`,
  amountLD: bigint,
): Promise<bigint> {
  const client = createGrsEvmPublicClient(config)
  return client.readContract({
    address: config.address,
    abi: grsAbi,
    functionName: 'quoteBridge',
    args: [dstEid, to, amountLD],
  })
}

export async function fetchQuoteWalletBalance(
  config: GrsEvmConfig,
  owner: `0x${string}`,
  quote: `0x${string}`,
): Promise<{ raw: bigint; maxRaw: bigint; decimals: number }> {
  const client = createGrsEvmPublicClient(config)
  if (quote.toLowerCase() === NATIVE_QUOTE) {
    const raw = await client.getBalance({ address: owner })
    const gasReserve = 2_000_000_000_000_000n
    return { raw, maxRaw: raw > gasReserve ? raw - gasReserve : 0n, decimals: 18 }
  }

  const [raw, decimals] = await Promise.all([
    client.readContract({
      address: quote,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [owner],
    }),
    client.readContract({
      address: quote,
      abi: erc20Abi,
      functionName: 'decimals',
    }),
  ])
  return { raw, maxRaw: raw, decimals: Number(decimals) }
}
