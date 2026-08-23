import { erc20Abi, getAddress } from 'viem'
import {
  LZ_EID_META,
  NATIVE_QUOTE,
  TOKEN_SALES_BUCKET,
  normalizeTokenSalesCap,
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
  /** Spoke sale priced with an EVM address packed as pubkey — Solana buy cannot pay. */
  unpayableEvmAsset?: boolean
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
  /** TokenSales inventory on the home chain: contract GRS balance (uncapped bucket). */
  tokenSalesRemaining: bigint | null
  /** Home TokenSales `spent[TokenSales]` (lifetime accounting). */
  tokenSalesSpent: bigint | null
  /** Home TokenSales soft policy size (`type(uint256).max` on-chain = uncapped). */
  tokenSalesCap: bigint | null
  /** Decimals for `tokenSalesRemaining` / spent / cap (home OFT decimals). */
  tokenSalesDecimals: number | null
  allocations: GrsAllocation[] | null
  balance: bigint
  peers: GrsPeer[]
  /** Peers from the home OFT (`getPeers`) — used for sale destinations. */
  homePeers: GrsPeer[]
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
  const listed: GrsSale[] = []

  for (let offset = 0n; ; offset += SALE_PAGE) {
    let page: readonly {
      asset: `0x${string}`
      assetAmount: bigint
      grsAmount: bigint
      recipient: `0x${string}`
    }[]
    try {
      page = await client.readContract({
        address: config.address,
        abi: grsAbi,
        functionName: 'getSales',
        args: [offset, SALE_PAGE],
      })
    } catch {
      // UnknownSale when offset is past the book (incl. empty book at offset 0).
      break
    }
    if (page.length === 0) break

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
    if (BigInt(page.length) < SALE_PAGE) break
  }
  return listed
}

async function fetchWalletVestings(
  config: GrsEvmConfig,
  owner: `0x${string}` | undefined,
): Promise<{ vestings: GrsVesting[]; vestingCount: bigint }> {
  const client = createGrsEvmPublicClient(config)
  if (!owner) return { vestings: [], vestingCount: 0n }

  const ownerLower = owner.toLowerCase()
  const vestings: GrsVesting[] = []
  let vestingCount = 0n

  for (let offset = 0n; offset < VESTING_SCAN_CAP; offset += VESTING_PAGE) {
    let page: readonly {
      id: bigint
      bucket: number | bigint
      funder: `0x${string}`
      beneficiary: `0x${string}`
      allocation: bigint
      released: bigint
      start: bigint | number
      cliffEnd: bigint | number
      end: bigint | number
    }[]
    try {
      page = await client.readContract({
        address: config.address,
        abi: grsAbi,
        functionName: 'getVestings',
        args: [offset, VESTING_PAGE],
      })
    } catch {
      break
    }
    if (page.length === 0) break
    vestingCount = offset + BigInt(page.length)

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
    if (BigInt(page.length) < VESTING_PAGE) break
  }

  vestings.sort((a, b) => {
    if (b.releasable !== a.releasable) return b.releasable > a.releasable ? 1 : -1
    return Number(a.id - b.id)
  })

  return { vestings, vestingCount }
}

export type HomeTokenSalesInventory = {
  remaining: bigint
  spent: bigint
  cap: bigint
  decimals: number
  homeChain: GrsEvmConfig
}

function mapPeersRaw(
  peersRaw: readonly { eid: number | bigint; peer: `0x${string}` }[],
): GrsPeer[] {
  return peersRaw
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

/** Prefer an explicit home config, else discover from configured EVM GRS deployments. */
export async function resolveGrsHomeEvmConfig(
  preferredHome?: GrsEvmConfig | null,
): Promise<GrsEvmConfig | null> {
  if (preferredHome) return preferredHome
  const configured = listConfiguredGrsChains()
  for (const item of configured) {
    try {
      const client = createGrsEvmPublicClient(item)
      const isHome = await client.readContract({
        address: item.address,
        abi: grsAbi,
        functionName: 'home',
      })
      if (isHome) return item
    } catch {
      /* try next */
    }
  }
  return (
    configured.find((item) => item.chainId === 11155111) ??
    configured.find((item) => item.chainId === 1) ??
    configured[0] ??
    null
  )
}

/** LayerZero peers registered on the home OFT (`getPeers`). */
export async function fetchHomeGrsPeers(
  preferredHome?: GrsEvmConfig | null,
): Promise<{ peers: GrsPeer[]; homeChain: GrsEvmConfig | null }> {
  const home = await resolveGrsHomeEvmConfig(preferredHome)
  if (!home) return { peers: [], homeChain: null }
  try {
    const client = createGrsEvmPublicClient(home)
    const peersRaw = await client.readContract({
      address: home.address,
      abi: grsAbi,
      functionName: 'getPeers',
    })
    return { peers: mapPeersRaw(peersRaw), homeChain: home }
  } catch {
    return { peers: [], homeChain: home }
  }
}

/** TokenSales on home: sellable float is `remaining()` (`balance − vestingLocked`), not `capOf − spent`
 *  (`capOf(TokenSales)` is `type(uint256).max`). Soft UI cap is the 150M policy size. */
export async function fetchHomeTokenSalesInventory(
  preferredHome?: GrsEvmConfig | null,
): Promise<HomeTokenSalesInventory | null> {
  const home = await resolveGrsHomeEvmConfig(preferredHome)
  if (!home) return null

  const client = createGrsEvmPublicClient(home)
  try {
    const [remaining, spentAmt, capRaw, decimals] = await Promise.all([
      client.readContract({
        address: home.address,
        abi: grsAbi,
        functionName: 'remaining',
        args: [TOKEN_SALES_BUCKET],
      }),
      client.readContract({
        address: home.address,
        abi: grsAbi,
        functionName: 'spent',
        args: [TOKEN_SALES_BUCKET],
      }),
      client.readContract({
        address: home.address,
        abi: grsAbi,
        functionName: 'capOf',
        args: [TOKEN_SALES_BUCKET],
      }),
      client
        .readContract({ address: home.address, abi: grsAbi, functionName: 'decimals' })
        .catch(() => 18),
    ])
    const decimalsN = Number(decimals)
    return {
      remaining,
      spent: spentAmt,
      cap: normalizeTokenSalesCap(capRaw, decimalsN),
      decimals: decimalsN,
      homeChain: home,
    }
  } catch {
    try {
      const remaining = await client.readContract({
        address: home.address,
        abi: grsAbi,
        functionName: 'remaining',
        args: [TOKEN_SALES_BUCKET],
      })
      return {
        remaining,
        spent: 0n,
        cap: normalizeTokenSalesCap(0n, 18),
        decimals: 18,
        homeChain: home,
      }
    } catch {
      return null
    }
  }
}

async function fetchAllocations(config: GrsEvmConfig): Promise<GrsAllocation[] | null> {
  const client = createGrsEvmPublicClient(config)
  try {
    const listed = await client.readContract({
      address: config.address,
      abi: grsAbi,
      functionName: 'getAllocations',
    })
    return listed.map((row) => {
      const bucket = Number(row.bucket)
      const cap =
        bucket === TOKEN_SALES_BUCKET ? normalizeTokenSalesCap(row.cap) : row.cap
      return {
        bucket,
        cap,
        spent: row.spent,
        remaining: row.remaining,
        gate: Number(row.gate),
        cliffMonths: Number(row.cliffMonths),
        linearMonths: Number(row.linearMonths),
      }
    })
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
  const inventoryHome = home ? config : homeChain
  const [inventory, allocations, homePeersPack] = await Promise.all([
    fetchHomeTokenSalesInventory(inventoryHome),
    inventoryHome ? fetchAllocations(inventoryHome) : Promise.resolve(null),
    home ? Promise.resolve({ peers: mapPeersRaw(peersRaw), homeChain: config }) : fetchHomeGrsPeers(inventoryHome),
  ])
  const salesCapRaw =
    inventory?.cap ?? allocations?.find((row) => row.bucket === TOKEN_SALES_BUCKET)?.cap ?? null
  const salesCap = salesCapRaw != null ? normalizeTokenSalesCap(salesCapRaw) : null
  // Prefer live free float (`remaining`); never `capOf − spent` (TokenSales cap is uint256.max).
  const salesLeft =
    inventory?.remaining ??
    allocations?.find((row) => row.bucket === TOKEN_SALES_BUCKET)?.remaining ??
    null
  const salesSpent =
    inventory?.spent ?? allocations?.find((row) => row.bucket === TOKEN_SALES_BUCKET)?.spent ?? null

  const balance = owner
    ? await client.readContract({
        address: config.address,
        abi: grsAbi,
        functionName: 'balanceOf',
        args: [owner],
      })
    : 0n

  const peers = mapPeersRaw(peersRaw)

  return {
    home,
    decimals: Number(decimals),
    maxSupply,
    tokenSalesRemaining: salesLeft,
    tokenSalesSpent: salesSpent,
    tokenSalesCap: salesCap,
    tokenSalesDecimals: inventory?.decimals ?? (salesLeft != null ? Number(decimals) : null),
    allocations,
    balance,
    peers,
    homePeers: homePeersPack.peers,
    sales,
    vestings: vestingPack.vestings,
    vestingCount: vestingPack.vestingCount,
    homeChain: inventory?.homeChain ?? homePeersPack.homeChain ?? homeChain,
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
  try {
    return await client.readContract({
      address: config.address,
      abi: grsAbi,
      functionName: 'quoteBridge',
      args: [dstEid, to, amountLD],
    })
  } catch (error) {
    throw new Error(formatGrsQuoteError(error))
  }
}

export async function quoteGrsGrant(
  config: GrsEvmConfig,
  to: `0x${string}`,
  amount: bigint,
  start: bigint,
  cliffSeconds: bigint,
  durationSeconds: bigint,
  bucket: number,
  dstEid: number,
): Promise<bigint> {
  if (dstEid === 0) return 0n
  const client = createGrsEvmPublicClient(config)
  try {
    return await client.readContract({
      address: config.address,
      abi: grsAbi,
      functionName: 'quoteGrant',
      args: [to, amount, start, cliffSeconds, durationSeconds, bucket, dstEid],
    })
  } catch (error) {
    throw new Error(formatGrsQuoteError(error))
  }
}

/** Map raw quoteBridge / quoteSale reverts to short UI copy. */
export function formatGrsQuoteError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  if (/0x6592671c|LZ_ULN_InvalidWorkerOptions/i.test(raw)) {
    return 'LayerZero pathway for this destination is not wired (ULN worker options). setPeer alone is not enough — configure send library / DVN / executor + enforced options for this eid.'
  }
  if (/NoPeer|0xf6ff4fb7/i.test(raw)) {
    return 'No LayerZero peer for this destination. Run setPeer first.'
  }
  if (/SlippageExceeded|0x71c4efed/i.test(raw)) {
    return 'Amount has OFT dust — use a multiple of 10^(localDecimals − sharedDecimals).'
  }
  if (/InvalidRecipient/i.test(raw)) {
    return 'Recipient cannot be empty.'
  }
  const short = raw.match(/reverted with the following reason:\s*(.+)/i)?.[1]
  if (short) return short.trim()
  if (raw.length > 220) return `${raw.slice(0, 200).trim()}…`
  return raw || 'Could not quote LayerZero fee'
}

export async function quoteGrsSale(
  config: GrsEvmConfig,
  asset: `0x${string}`,
  assetAmount: bigint,
  grsAmount: bigint,
  recipient: `0x${string}`,
  dstEid: number,
): Promise<bigint> {
  const client = createGrsEvmPublicClient(config)
  return client.readContract({
    address: config.address,
    abi: grsAbi,
    functionName: 'quoteSale',
    args: [asset, assetAmount, grsAmount, recipient, dstEid],
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
