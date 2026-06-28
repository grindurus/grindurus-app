import { Connection, PublicKey } from '@solana/web3.js'
import { decodeTokenAccountAmount, fetchAccountsByKey, getAccountData } from './accountBatch'
import type { GraiSolanaConfig } from './deployments'
import { fetchGraiStateAssetMints } from './graiStateCache'
import { decodeSeniorVaultPriceFeed, decodeSeniorVaultTotalValue, decodeMintDecimals } from './onchain'
import { parseOraclePriceFeed } from './oraclePrice'
import { NATIVE_MINT } from './knownMints'
import { juniorVaultAtaPda, juniorVaultPda, seniorVaultAtaPda, seniorVaultPda } from './pdas'
import { depositValue } from './tokenomics'

export type GraiAssetVaultBalances = {
  seniorRaw: bigint
  juniorRaw: bigint
  allocatedRaw: bigint
  decimals: number
  /** Senior vault attributed NAV in USD (9 decimals). */
  navUsdRaw: bigint
  /** Senior vault idle balance priced in USD (9 decimals). */
  seniorUsdRaw: bigint
  /** Junior vault idle balance priced in USD (9 decimals). */
  juniorUsdRaw: bigint
}

function decodeJuniorVaultActiveAmount(data: Buffer): bigint {
  return data.readBigUInt64LE(40)
}

function parseAssetVaultBalances(
  assetMint: PublicKey,
  accounts: Awaited<ReturnType<typeof fetchAccountsByKey>>,
  programId: PublicKey,
): GraiAssetVaultBalances {
  const seniorAta = seniorVaultAtaPda(assetMint, programId)
  const juniorAta = juniorVaultAtaPda(assetMint, programId)
  const seniorVault = seniorVaultPda(assetMint, programId)
  const juniorVault = juniorVaultPda(assetMint, programId)
  const isNativeSol = assetMint.toBase58() === NATIVE_MINT

  const seniorAtaData = getAccountData(accounts, seniorAta)
  const juniorAtaData = getAccountData(accounts, juniorAta)
  const seniorVaultData = getAccountData(accounts, seniorVault)
  const juniorVaultData = getAccountData(accounts, juniorVault)

  const mintData = isNativeSol ? null : getAccountData(accounts, assetMint)
  const decimals = isNativeSol
    ? 9
    : mintData
      ? decodeMintDecimals(mintData)
      : 0

  const navUsdRaw =
    seniorVaultData && seniorVaultData.length >= 93
      ? decodeSeniorVaultTotalValue(seniorVaultData)
      : 0n

  const allocatedRaw =
    juniorVaultData && juniorVaultData.length >= 48
      ? decodeJuniorVaultActiveAmount(juniorVaultData)
      : 0n

  return {
    seniorRaw: seniorAtaData ? decodeTokenAccountAmount(seniorAtaData) : 0n,
    juniorRaw: juniorAtaData ? decodeTokenAccountAmount(juniorAtaData) : 0n,
    allocatedRaw,
    decimals,
    navUsdRaw,
    seniorUsdRaw: 0n,
    juniorUsdRaw: 0n,
  }
}

function priceVaultBalanceUsd(
  balanceRaw: bigint,
  decimals: number,
  priceFeedKey: PublicKey | null,
  priceFeedAccounts: Awaited<ReturnType<typeof fetchAccountsByKey>>,
): bigint {
  if (balanceRaw <= 0n || !priceFeedKey) return 0n

  try {
    const priceFeedAccount = priceFeedAccounts.get(priceFeedKey.toBase58())
    if (!priceFeedAccount) return 0n
    const oracle = parseOraclePriceFeed(priceFeedAccount)
    return depositValue(balanceRaw, decimals, oracle.price, oracle.decimals)
  } catch {
    return 0n
  }
}

export async function fetchGraiVaultBalances(
  connection: Connection,
  config: GraiSolanaConfig,
): Promise<Record<string, GraiAssetVaultBalances>> {
  const assetMints = await fetchGraiStateAssetMints(connection, config)
  const programId = config.programId

  const accountKeys: PublicKey[] = []
  for (const mint of assetMints) {
    accountKeys.push(
      seniorVaultAtaPda(mint, programId),
      juniorVaultAtaPda(mint, programId),
      seniorVaultPda(mint, programId),
      juniorVaultPda(mint, programId),
    )
    if (mint.toBase58() !== NATIVE_MINT) {
      accountKeys.push(mint)
    }
  }

  const accounts = await fetchAccountsByKey(connection, accountKeys)

  const priceFeedKeys = assetMints.map((mint) => {
    const seniorVaultData = getAccountData(accounts, seniorVaultPda(mint, programId))
    return seniorVaultData ? decodeSeniorVaultPriceFeed(seniorVaultData) : null
  })

  const uniquePriceFeedKeys = [
    ...new Map(
      priceFeedKeys.filter((key): key is PublicKey => key !== null).map((key) => [key.toBase58(), key]),
    ).values(),
  ]
  const priceFeedAccounts =
    uniquePriceFeedKeys.length > 0 ? await fetchAccountsByKey(connection, uniquePriceFeedKeys) : new Map()

  const entries = assetMints.map((mint, index) => {
    const balances = parseAssetVaultBalances(mint, accounts, programId)
    const priceFeedKey = priceFeedKeys[index] ?? null
    const seniorUsdRaw = priceVaultBalanceUsd(
      balances.seniorRaw,
      balances.decimals,
      priceFeedKey,
      priceFeedAccounts,
    )
    const juniorUsdRaw = priceVaultBalanceUsd(
      balances.juniorRaw,
      balances.decimals,
      priceFeedKey,
      priceFeedAccounts,
    )
    return [mint.toBase58(), { ...balances, seniorUsdRaw, juniorUsdRaw }] as const
  })

  return Object.fromEntries(entries)
}
