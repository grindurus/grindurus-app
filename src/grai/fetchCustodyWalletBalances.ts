import { Connection, PublicKey } from '@solana/web3.js'
import { decodeTokenAccountAmount, fetchAccountsByKey, getAccountData } from './accountBatch'
import type { GraiSolanaConfig } from './deployments'
import { fetchGraiStateAssetMints } from './graiStateCache'
import { decodeMintDecimals } from './onchain'
import { NATIVE_MINT } from './knownMints'
import { custodyAllocationPda, getAssociatedTokenAddress } from './pdas'

export type CustodyAssetBalances = {
  balanceRaw: bigint
  allocatedRaw: bigint
  yieldRaw: bigint
  decimals: number
}

function decodeCustodyAllocation(data: Buffer): { allocatedRaw: bigint; yieldRaw: bigint } {
  return {
    allocatedRaw: data.readBigUInt64LE(8),
    yieldRaw: data.readBigUInt64LE(16),
  }
}

export async function fetchCustodyWalletBalances(
  connection: Connection,
  config: GraiSolanaConfig,
  custodyWallet: PublicKey,
): Promise<Record<string, CustodyAssetBalances>> {
  const assetMints = await fetchGraiStateAssetMints(connection, config)
  const programId = config.programId

  const accountKeys: PublicKey[] = []
  for (const mint of assetMints) {
    accountKeys.push(getAssociatedTokenAddress(mint, custodyWallet))
    accountKeys.push(custodyAllocationPda(custodyWallet, mint, programId))
    if (mint.toBase58() !== NATIVE_MINT) {
      accountKeys.push(mint)
    }
  }

  const accounts = await fetchAccountsByKey(connection, accountKeys)

  const entries = assetMints.map((mint) => {
    const custodyAta = getAssociatedTokenAddress(mint, custodyWallet)
    const custodyAllocation = custodyAllocationPda(custodyWallet, mint, programId)
    const isNativeSol = mint.toBase58() === NATIVE_MINT

    const custodyAtaData = getAccountData(accounts, custodyAta)
    const custodyAllocationData = getAccountData(accounts, custodyAllocation)
    const mintData = isNativeSol ? null : getAccountData(accounts, mint)

    const decimals = isNativeSol ? 9 : mintData ? decodeMintDecimals(mintData) : 0
    const allocation =
      custodyAllocationData && custodyAllocationData.length >= 24
        ? decodeCustodyAllocation(custodyAllocationData)
        : { allocatedRaw: 0n, yieldRaw: 0n }

    return [
      mint.toBase58(),
      {
        balanceRaw: custodyAtaData ? decodeTokenAccountAmount(custodyAtaData) : 0n,
        allocatedRaw: allocation.allocatedRaw,
        yieldRaw: allocation.yieldRaw,
        decimals,
      },
    ] as const
  })

  return Object.fromEntries(entries)
}
