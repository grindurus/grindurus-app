import { Connection, PublicKey } from '@solana/web3.js'
import { decodeTokenAccountAmount, fetchAccountsByKey, getAccountData } from './accountBatch'
import type { GraiSolanaConfig } from './deployments'
import { fetchGraiProtocol } from './fetchGraiProtocol'
import { decodeMintDecimals } from './onchain'
import { NATIVE_MINT } from './knownMints'
import { allocationPda, getAssociatedTokenAddress } from './pdas'
import { resolveSolanaGrindersProgramId } from './solanaAllocateCustody'

export type CustodyAssetBalances = {
  balanceRaw: bigint
  allocatedRaw: bigint
  /** Yield tracking lives on GRAI Position PDA; always 0 here. */
  yieldRaw: bigint
  decimals: number
}

/** Grinders Allocation: disc(8) + allocated_amount(u64) + bump(u8). */
function decodeAllocation(data: Buffer): { allocatedRaw: bigint } {
  return {
    allocatedRaw: data.readBigUInt64LE(8),
  }
}

export async function fetchCustodyWalletBalances(
  connection: Connection,
  config: GraiSolanaConfig,
  custodyWallet: PublicKey,
): Promise<Record<string, CustodyAssetBalances>> {
  const protocol = await fetchGraiProtocol(connection, config.graiMint)
  const assetMints = protocol.assetMints
  const grindersProgram = resolveSolanaGrindersProgramId(config.cluster)

  const accountKeys: PublicKey[] = []
  for (const mint of assetMints) {
    accountKeys.push(getAssociatedTokenAddress(mint, custodyWallet))
    accountKeys.push(allocationPda(custodyWallet, mint, grindersProgram))
    if (mint.toBase58() !== NATIVE_MINT) {
      accountKeys.push(mint)
    }
  }

  const accounts = await fetchAccountsByKey(connection, accountKeys)

  const entries = assetMints.map((mint) => {
    const custodyAta = getAssociatedTokenAddress(mint, custodyWallet)
    const allocation = allocationPda(custodyWallet, mint, grindersProgram)
    const isNativeSol = mint.toBase58() === NATIVE_MINT

    const custodyAtaData = getAccountData(accounts, custodyAta)
    const allocationData = getAccountData(accounts, allocation)
    const mintData = isNativeSol ? null : getAccountData(accounts, mint)

    const decimals = isNativeSol ? 9 : mintData ? decodeMintDecimals(mintData) : 0
    const allocatedRaw =
      allocationData && allocationData.length >= 16
        ? decodeAllocation(allocationData).allocatedRaw
        : 0n

    return [
      mint.toBase58(),
      {
        balanceRaw: custodyAtaData ? decodeTokenAccountAmount(custodyAtaData) : 0n,
        allocatedRaw,
        yieldRaw: 0n,
        decimals,
      },
    ] as const
  })

  return Object.fromEntries(entries)
}
