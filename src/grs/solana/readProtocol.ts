import { Connection, PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddress } from '../../grai/pdas'
import { isSolanaLzEid, lzEndpointLabel, LZ_EID_META } from '../constants'
import type { GrsSolanaConfig } from '../deployments'
import type { GrsPeer, GrsSale, GrsSnapshot, GrsVesting } from '../evm/readProtocol'
import { fetchHomeGrsPeers, fetchHomeTokenSalesInventory } from '../evm/readProtocol'
import {
  decodeGrsConfig,
  decodePeerRegistry,
  decodeSaleAccount,
  decodeSaleRegistry,
  decodeVesting,
  quoteSaleCost,
  vestedAt,
} from './layout'
import { resolveSolanaSaleQuoteMeta } from './quoteAssets'
import { resolveGrsSolanaPdas, salePda, vestingPda } from './pdas'

/** Solana local decimals (1 GRS = 1e9). */
export const GRS_SOLANA_DECIMALS = 9

const ZERO = PublicKey.default

function asEvmish(address: string): `0x${string}` {
  return address as `0x${string}`
}

async function tokenAccountAmountByAta(
  connection: Connection,
  ata: PublicKey,
): Promise<bigint> {
  const info = await connection.getTokenAccountBalance(ata).catch(() => null)
  if (!info?.value?.amount) return 0n
  return BigInt(info.value.amount)
}

async function tokenAccountAmount(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey,
): Promise<bigint> {
  return tokenAccountAmountByAta(connection, getAssociatedTokenAddress(mint, owner))
}

export async function fetchSolanaGrsSnapshot(
  connection: Connection,
  config: GrsSolanaConfig,
  owner?: string | null,
): Promise<GrsSnapshot> {
  const pdas = resolveGrsSolanaPdas(config)
  const [grsInfo, saleInfo, peerInfo, mintInfo] = await connection.getMultipleAccountsInfo([
    pdas.grsConfig,
    pdas.saleRegistry,
    pdas.peerRegistry,
    config.mint,
  ])

  if (!grsInfo?.data) throw new Error('GRS config account missing on Solana')
  const grs = decodeGrsConfig(Buffer.from(grsInfo.data))

  const sales: GrsSale[] = []
  if (saleInfo?.data) {
    const registry = decodeSaleRegistry(Buffer.from(saleInfo.data))
    const count = Number(registry.saleCount)
    if (count > 0) {
      const keys = Array.from({ length: count }, (_, i) => salePda(config.oftStore, i + 1, config.programId))
      const infos = await connection.getMultipleAccountsInfo(keys)
      infos.forEach((info) => {
        if (!info?.data) return
        const row = decodeSaleAccount(Buffer.from(info.data))
        if (row.assetAmount === 0n || row.grsAmount === 0n) return
        const quote = resolveSolanaSaleQuoteMeta(row.asset)
        sales.push({
          id: row.id,
          asset: asEvmish(quote.native ? '0x0000000000000000000000000000000000000000' : row.asset.toBase58()),
          assetAmount: row.assetAmount,
          grsAmount: row.grsAmount,
          recipient: asEvmish(row.recipient.equals(ZERO) ? '' : row.recipient.toBase58()),
          quoteSymbol: quote.quoteSymbol,
          quoteDecimals: quote.quoteDecimals,
          quoteIcon: quote.quoteIcon,
          native: quote.native,
          unpayableEvmAsset: quote.unpayableEvmAsset,
        })
      })
    }
  }

  const peers: GrsPeer[] = []
  if (peerInfo?.data) {
    const registry = decodePeerRegistry(Buffer.from(peerInfo.data))
    for (const entry of registry.entries) {
      const meta = LZ_EID_META[entry.eid]
      peers.push({
        eid: entry.eid,
        peer: asEvmish(`0x${Buffer.from(entry.peer).toString('hex')}`),
        name: lzEndpointLabel(entry.eid),
        solana: isSolanaLzEid(entry.eid),
        chainId: meta?.chainId,
      })
    }
  }

  const vestingCount = grs.vestingCount
  const vestings: GrsVesting[] = []
  if (owner && vestingCount > 0n) {
    const ownerKey = new PublicKey(owner)
    const now = Math.floor(Date.now() / 1000)
    const ids: bigint[] = []
    const scanTo = vestingCount > 2000n ? 2000n : vestingCount
    for (let id = 1n; id <= scanTo; id++) ids.push(id)
    const keys = ids.map((id) => vestingPda(config.oftStore, id, config.programId))
    const infos = await connection.getMultipleAccountsInfo(keys)
    infos.forEach((info) => {
      if (!info?.data) return
      try {
        const row = decodeVesting(Buffer.from(info.data))
        if (!row.beneficiary.equals(ownerKey) && !row.funder.equals(ownerKey)) return
        const unlocked = vestedAt(row.allocation, row.cliffEnd, row.end, now)
        vestings.push({
          id: row.id,
          bucket: 11,
          funder: asEvmish(row.funder.toBase58()),
          beneficiary: asEvmish(row.beneficiary.toBase58()),
          allocation: row.allocation,
          released: row.released,
          start: row.start,
          cliffEnd: row.cliffEnd,
          end: row.end,
          releasable: unlocked > row.released ? unlocked - row.released : 0n,
        })
      } catch {
        /* skip corrupt */
      }
    })
  }

  const balance = owner ? await tokenAccountAmount(connection, config.mint, new PublicKey(owner)) : 0n
  const decimals =
    mintInfo?.data && mintInfo.data.length >= 45 ? mintInfo.data[44] : GRS_SOLANA_DECIMALS

  // Home TokenSales inventory: sale_escrow balance when this OFT is home (uncapped recycle bucket).
  // Spoke UI still reads the EVM home OFT for the global book.
  let tokenSalesRemaining: bigint | null = null
  let tokenSalesSpent: bigint | null = null
  let tokenSalesCap: bigint | null = null
  let tokenSalesDecimals: number | null = null
  let homePeers: GrsPeer[] = []
  let homeChain: GrsSnapshot['homeChain'] = null

  if (grs.home) {
    const escrowBal = await tokenAccountAmountByAta(connection, pdas.saleEscrow)
    tokenSalesRemaining = escrowBal
    tokenSalesSpent = grs.tokenSalesSpent
    tokenSalesCap = null // uncapped on-chain
    tokenSalesDecimals = Number(decimals)
  } else {
    const [homeInventory, homePeersPack] = await Promise.all([
      fetchHomeTokenSalesInventory().catch(() => null),
      fetchHomeGrsPeers().catch(() => ({ peers: [] as GrsPeer[], homeChain: null })),
    ])
    tokenSalesRemaining = homeInventory?.remaining ?? null
    tokenSalesSpent = homeInventory?.spent ?? null
    tokenSalesCap = homeInventory?.cap ?? null
    tokenSalesDecimals = homeInventory?.decimals ?? null
    homePeers = homePeersPack.peers
    homeChain = homeInventory?.homeChain ?? homePeersPack.homeChain ?? null
  }

  return {
    home: grs.home,
    decimals: Number(decimals),
    maxSupply: 1_000_000_000n * 10n ** BigInt(Number(decimals)),
    tokenSalesRemaining,
    tokenSalesSpent,
    tokenSalesCap,
    tokenSalesDecimals,
    allocations: null,
    balance,
    peers,
    homePeers,
    sales,
    vestings,
    vestingCount,
    homeChain,
  }
}

export function previewSolanaGrsBuy(
  sale: { grsAmount: bigint; assetAmount: bigint },
  amountLd: bigint,
): bigint {
  return quoteSaleCost(amountLd, sale.grsAmount, sale.assetAmount)
}
