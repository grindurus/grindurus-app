import { Connection, PublicKey } from '@solana/web3.js'
import { decodeTokenAccountAmount, fetchAccountsByKey, getAccountData } from './accountBatch'
import type { GraiSolanaConfig } from './deployments'
import { fetchGraiProtocol } from './fetchGraiProtocol'
import { decodeMintDecimals } from './onchain'
import { NATIVE_MINT } from './knownMints'
import { getAssociatedTokenAddress } from './pdas'

export type CustodyAssetBalances = {
  balanceRaw: bigint
  /** Issuance ledger removed — always 0; track Allocate/Deallocate off-chain. */
  allocatedRaw: bigint
  /** Yield tracking lives on GRAI Position PDA; always 0 here. */
  yieldRaw: bigint
  decimals: number
}

export async function fetchCustodyWalletBalances(
  connection: Connection,
  config: GraiSolanaConfig,
  custodyWallet: PublicKey,
): Promise<Record<string, CustodyAssetBalances>> {
  const protocol = await fetchGraiProtocol(connection, config.graiMint)
  const assetMints = protocol.assetMints

  const accountKeys: PublicKey[] = []
  for (const mint of assetMints) {
    accountKeys.push(getAssociatedTokenAddress(mint, custodyWallet))
    if (mint.toBase58() !== NATIVE_MINT) {
      accountKeys.push(mint)
    }
  }

  const accounts = await fetchAccountsByKey(connection, accountKeys)

  const entries = assetMints.map((mint) => {
    const custodyAta = getAssociatedTokenAddress(mint, custodyWallet)
    const isNativeSol = mint.toBase58() === NATIVE_MINT

    const custodyAtaData = getAccountData(accounts, custodyAta)
    const mintData = isNativeSol ? null : getAccountData(accounts, mint)

    const decimals = isNativeSol ? 9 : mintData ? decodeMintDecimals(mintData) : 0

    return [
      mint.toBase58(),
      {
        balanceRaw: custodyAtaData ? decodeTokenAccountAmount(custodyAtaData) : 0n,
        allocatedRaw: 0n,
        yieldRaw: 0n,
        decimals,
      },
    ] as const
  })

  return Object.fromEntries(entries)
}
