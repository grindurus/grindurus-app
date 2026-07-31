import type { Connection, PublicKey } from '@solana/web3.js'
import { graiStatePda } from './deployments'
import { formatTokenBalance, parseTokenAmount } from './onchain'
import { escrowPda } from './pdas'
import { GRAI_DECIMALS } from './tokenomics'
import type { EvmUnlockPreview } from './evm/estimateClaim'

const BPS = 10_000n

/** Bytes before `config` in GraiState (includes 8-byte Anchor discriminator). */
const GRAI_STATE_CONFIG_OFFSET =
  8 + // discriminator
  32 + // authority
  32 + // treasury
  32 + // grinders
  32 + // bribe_asset
  16 + // total_value
  8 + // total_locked
  8 + // total_voted
  1 + // liquidation
  1 + // confirmed
  8 // liquidation_at

/** Anchor Escrow: disc(8) + amount(u64) + voted(u64) + locked_at(i64) + … */
function decodeEscrow(data: Buffer): { amount: bigint; lockedAt: number } {
  if (data.length < 32) return { amount: 0n, lockedAt: 0 }
  return {
    amount: data.readBigUInt64LE(8),
    lockedAt: Number(data.readBigInt64LE(24)),
  }
}

/** `Config.unlock_fee_bps` (u16 @ +10) and `unlock_penalty_period` (u32 @ +24). */
function decodeUnlockConfig(graiStateData: Buffer): {
  unlockFeeBps: number
  unlockPenaltyPeriod: number
} {
  const base = GRAI_STATE_CONFIG_OFFSET
  if (graiStateData.length < base + 28) {
    return { unlockFeeBps: 0, unlockPenaltyPeriod: 0 }
  }
  return {
    unlockFeeBps: graiStateData.readUInt16LE(base + 10),
    unlockPenaltyPeriod: graiStateData.readUInt32LE(base + 24),
  }
}

function formatUnlockAmountLabel(amountRaw: bigint, decimals: number): string {
  if (amountRaw <= 0n) return '0.0'
  const label = formatTokenBalance(amountRaw, decimals, 4)
  return label.includes('.') ? label : `${label}.0`
}

/** Mirrors on-chain `tokenomics::preview_unlock` / EVM `previewUnlock`. */
export function previewSolanaUnlock(
  graiAmount: bigint,
  escrowAmount: bigint,
  lockedAt: number,
  unlockFeeBps: number,
  unlockPenaltyPeriod: number,
  timestamp: number,
): { unlockAmount: bigint; penalty: bigint } {
  if (unlockFeeBps === 0 || unlockPenaltyPeriod === 0 || graiAmount === 0n) {
    return { unlockAmount: graiAmount, penalty: 0n }
  }
  const elapsed = Math.max(0, timestamp - lockedAt)
  if (elapsed >= unlockPenaltyPeriod) {
    return { unlockAmount: graiAmount, penalty: 0n }
  }
  const penaltyBps =
    (BigInt(unlockFeeBps) * BigInt(unlockPenaltyPeriod - elapsed)) / BigInt(unlockPenaltyPeriod)
  const penalty = (graiAmount * penaltyBps) / BPS
  const unlockAmount = graiAmount > penalty ? graiAmount - penalty : 0n
  void escrowAmount
  return { unlockAmount, penalty }
}

export type SolanaLockedGrai = {
  locked: bigint
  lockedAt: number
  unlockFeeBps: number
  unlockPenaltyPeriod: number
  decimals: number
}

export async function fetchSolanaLockedGrai(
  connection: Connection,
  programId: PublicKey,
  owner: PublicKey,
): Promise<SolanaLockedGrai> {
  const escrow = escrowPda(owner, programId)
  const graiState = graiStatePda(programId)
  const [escrowInfo, stateInfo] = await connection.getMultipleAccountsInfo([escrow, graiState])

  const decimals = GRAI_DECIMALS
  if (!escrowInfo?.data) {
    const cfg = stateInfo?.data
      ? decodeUnlockConfig(Buffer.from(stateInfo.data))
      : { unlockFeeBps: 0, unlockPenaltyPeriod: 0 }
    return { locked: 0n, lockedAt: 0, ...cfg, decimals }
  }

  const { amount, lockedAt } = decodeEscrow(Buffer.from(escrowInfo.data))
  const cfg = stateInfo?.data
    ? decodeUnlockConfig(Buffer.from(stateInfo.data))
    : { unlockFeeBps: 0, unlockPenaltyPeriod: 0 }
  return { locked: amount, lockedAt, ...cfg, decimals }
}

/** Local preview matching Solana `preview_unlock` (same math as on-chain). */
export async function estimateSolanaUnlockPreview(
  connection: Connection,
  programId: PublicKey,
  owner: PublicKey,
  amountInput: string,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<EvmUnlockPreview & { locked: bigint }> {
  const escrow = await fetchSolanaLockedGrai(connection, programId, owner)
  const { locked, lockedAt, unlockFeeBps, unlockPenaltyPeriod, decimals } = escrow

  const secondsLeft =
    unlockPenaltyPeriod > 0 && lockedAt > 0
      ? Math.max(0, lockedAt + unlockPenaltyPeriod - nowSec)
      : 0

  let amountRaw = 0n
  const trimmed = amountInput.trim()
  if (trimmed) {
    try {
      amountRaw = parseTokenAmount(trimmed, decimals)
    } catch {
      amountRaw = 0n
    }
  }
  if (amountRaw > locked) amountRaw = locked

  const { unlockAmount, penalty } = previewSolanaUnlock(
    amountRaw,
    locked,
    lockedAt,
    unlockFeeBps,
    unlockPenaltyPeriod,
    nowSec,
  )

  return {
    locked,
    unlockAmount,
    penalty,
    unlockAmountLabel: formatUnlockAmountLabel(unlockAmount, decimals),
    penaltyLabel: formatUnlockAmountLabel(penalty, decimals),
    secondsLeft,
    unlockPenaltyPeriod,
    unlockFeeBps,
    lockedAt,
    decimals,
  }
}
