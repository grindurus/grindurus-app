import type { Connection, PublicKey } from '@solana/web3.js'
import { graiStatePda } from './deployments'
import { formatTokenBalance, parseTokenAmount } from './onchain'
import { escrowPda } from './pdas'
import { GRAI_DECIMALS } from './tokenomics'
import type { EvmUnlockPreview } from './evm/estimateClaim'
import { GRAI_STATE_CONFIG_OFFSET } from './fetchGraiProtocol'

const BPS = 10_000n

/** Anchor Escrow: disc(8) + amount(u64) + voted(u64) + … */
function decodeEscrow(data: Buffer): { amount: bigint } {
  if (data.length < 16) return { amount: 0n }
  return {
    amount: data.readBigUInt64LE(8),
  }
}

/** `Config.unlock_penalty_bps` (u16 @ +12) — flat fee, no time decay. */
function decodeUnlockPenaltyBps(graiStateData: Buffer): number {
  const base = GRAI_STATE_CONFIG_OFFSET
  if (graiStateData.length < base + 14) return 0
  return graiStateData.readUInt16LE(base + 12)
}

function formatUnlockAmountLabel(amountRaw: bigint, decimals: number): string {
  if (amountRaw <= 0n) return '0.0'
  const label = formatTokenBalance(amountRaw, decimals, 4)
  return label.includes('.') ? label : `${label}.0`
}

/**
 * Mirrors on-chain `tokenomics::preview_unlock` (flat `unlock_penalty_bps`).
 */
export function previewSolanaUnlock(
  graiAmount: bigint,
  escrowAmount: bigint,
  unlockPenaltyBps: number,
): { unlockAmount: bigint; penalty: bigint } {
  if (graiAmount > escrowAmount) {
    return { unlockAmount: 0n, penalty: 0n }
  }
  if (unlockPenaltyBps === 0 || graiAmount === 0n) {
    return { unlockAmount: graiAmount, penalty: 0n }
  }

  const minUnlock = (BPS + BigInt(unlockPenaltyBps) - 1n) / BigInt(unlockPenaltyBps)
  if (graiAmount < minUnlock) {
    return { unlockAmount: 0n, penalty: 0n }
  }

  const penalty = (graiAmount * BigInt(unlockPenaltyBps) + BPS - 1n) / BPS
  const unlockAmount = graiAmount > penalty ? graiAmount - penalty : 0n
  return { unlockAmount, penalty }
}

export type SolanaLockedGrai = {
  locked: bigint
  unlockPenaltyBps: number
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
  const unlockPenaltyBps = stateInfo?.data
    ? decodeUnlockPenaltyBps(Buffer.from(stateInfo.data))
    : 0
  if (!escrowInfo?.data) {
    return { locked: 0n, unlockPenaltyBps, decimals }
  }

  const { amount } = decodeEscrow(Buffer.from(escrowInfo.data))
  return { locked: amount, unlockPenaltyBps, decimals }
}

/** Local preview matching Solana `preview_unlock` (same math as on-chain). */
export async function estimateSolanaUnlockPreview(
  connection: Connection,
  programId: PublicKey,
  owner: PublicKey,
  amountInput: string,
  _nowSec = Math.floor(Date.now() / 1000),
): Promise<EvmUnlockPreview & { locked: bigint }> {
  const escrow = await fetchSolanaLockedGrai(connection, programId, owner)
  const { locked, unlockPenaltyBps, decimals } = escrow

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
    unlockPenaltyBps,
  )

  return {
    locked,
    unlockAmount,
    penalty,
    unlockAmountLabel: formatUnlockAmountLabel(unlockAmount, decimals),
    penaltyLabel: formatUnlockAmountLabel(penalty, decimals),
    secondsLeft: 0,
    unlockPenaltyBps,
    decimals,
  }
}
