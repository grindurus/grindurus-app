import { Connection, PublicKey } from '@solana/web3.js'
import type { GraiSolanaConfig } from './deployments'
import { fetchGraiProtocol } from './fetchGraiProtocol'
import { resolveGraiAsset } from './knownMints'
import { decodeMintDecimals } from './onchain'
import { escrowPda, getAssociatedTokenAddress } from './pdas'
import { GRAI_DECIMALS } from './tokenomics'
import type { EvmLiquidationVoteState, EvmVoterEntry } from './evm/readProtocol'

const BPS = 10_000n
/** Match on-chain `get_voters(from, to)` page size for escrow fetches. */
export const SOLANA_VOTERS_PAGE_SIZE = 10

/** Anchor Escrow: disc(8) + amount(u64) + voted(u64) + locked_at(i64) + … */
function decodeEscrow(data: Buffer): { amount: bigint; voted: bigint } {
  if (data.length < 24) return { amount: 0n, voted: 0n }
  return {
    amount: data.readBigUInt64LE(8),
    voted: data.readBigUInt64LE(16),
  }
}

function decodeTokenAmount(data: Buffer): bigint {
  // SPL Token account: amount at offset 64 (u64 LE)
  if (data.length < 72) return 0n
  return data.readBigUInt64LE(64)
}

function hasQuorum(totalVoted: bigint, totalSupply: bigint, quorumBps: number): boolean {
  return totalVoted * BPS >= totalSupply * BigInt(quorumBps)
}

/**
 * Load `voters[fromId, toId)` escrow snapshots (voted GRAI), analogous to EVM `getVoters`.
 */
export async function fetchSolanaVotersPage(
  connection: Connection,
  programId: PublicKey,
  voterOwners: PublicKey[],
  fromId: number,
  toId: number,
): Promise<EvmVoterEntry[]> {
  if (fromId >= toId) return []
  const slice = voterOwners.slice(fromId, Math.min(toId, voterOwners.length))
  if (slice.length === 0) return []

  const escrowKeys = slice.map((owner) => escrowPda(owner, programId))
  const infos = await connection.getMultipleAccountsInfo(escrowKeys)

  const entries: EvmVoterEntry[] = []
  for (let i = 0; i < slice.length; i += 1) {
    const info = infos[i]
    if (!info?.data) continue
    const { voted } = decodeEscrow(Buffer.from(info.data))
    if (voted <= 0n) continue
    entries.push({
      address: slice[i]!.toBase58() as `0x${string}`,
      escrowGrai: voted,
    })
  }
  return entries
}

/**
 * Solana mirror of `fetchEvmLiquidationVoteState` — protocol vote/quorum fields from `GraiState`
 * plus voter pages of {@link SOLANA_VOTERS_PAGE_SIZE} escrow reads.
 */
export async function fetchSolanaLiquidationVoteState(
  connection: Connection,
  config: GraiSolanaConfig,
  owner: PublicKey | null,
): Promise<EvmLiquidationVoteState> {
  const protocol = await fetchGraiProtocol(connection, config.graiMint, { bypassCache: true })

  let walletGrai = 0n
  let lockedGrai = 0n
  let votedGrai = 0n

  if (owner) {
    const escrow = escrowPda(owner, protocol.programId)
    const ata = getAssociatedTokenAddress(protocol.graiMint, owner)
    const [escrowInfo, ataInfo] = await connection.getMultipleAccountsInfo([escrow, ata])
    if (escrowInfo?.data) {
      const decoded = decodeEscrow(Buffer.from(escrowInfo.data))
      lockedGrai = decoded.amount
      votedGrai = decoded.voted
    }
    if (ataInfo?.data) {
      walletGrai = decodeTokenAmount(Buffer.from(ataInfo.data))
    }
  }

  const totalVoted = protocol.totalVoted
  const totalSupply = protocol.mintSupply.raw
  const quorumBps = protocol.config.quorumBps

  const voterOwners = protocol.voters
  const voterEntries: EvmVoterEntry[] = []
  for (let from = 0; from < voterOwners.length; from += SOLANA_VOTERS_PAGE_SIZE) {
    const page = await fetchSolanaVotersPage(
      connection,
      protocol.programId,
      voterOwners,
      from,
      from + SOLANA_VOTERS_PAGE_SIZE,
    )
    voterEntries.push(...page)
  }

  // `GraiState.bribe_asset` (decoded as settlementAsset) — payment mint for bribes.
  const bribeAsset = protocol.settlementAsset
  const bribeUnset = bribeAsset.equals(PublicKey.default)
  let settlementSymbol = '—'
  let settlementDecimals = 6
  if (!bribeUnset) {
    settlementSymbol = resolveGraiAsset(bribeAsset.toBase58()).symbol
    const bribeMintInfo = await connection.getAccountInfo(bribeAsset)
    if (bribeMintInfo?.data) {
      settlementDecimals = decodeMintDecimals(Buffer.from(bribeMintInfo.data))
    }
  }

  return {
    graiDecimals: protocol.mintSupply.decimals || GRAI_DECIMALS,
    walletGrai,
    lockedGrai,
    votedGrai,
    totalVoted,
    totalSupply,
    totalValue: protocol.totalValue,
    hasQuorum: hasQuorum(totalVoted, totalSupply, quorumBps),
    confirmed: protocol.confirmed,
    liquidationOpen: protocol.liquidation,
    settlementAsset: bribeAsset.toBase58() as `0x${string}`,
    settlementDecimals,
    settlementSymbol,
    bribePremiumBps: protocol.config.bribePremiumBps,
    liquidationQuorumBps: quorumBps,
    voters: voterEntries.map((v) => v.address),
    voterEntries,
    listedAssets: [],
  }
}
