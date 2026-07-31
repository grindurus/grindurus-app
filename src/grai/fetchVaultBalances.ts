import { Connection, PublicKey } from '@solana/web3.js'
import { decodeTokenAccountAmount, fetchAccountsByKey, getAccountData } from './accountBatch'
import type { GraiSolanaConfig } from './deployments'
import { fetchGraiProtocol } from './fetchGraiProtocol'
import { decodeAssetConfigPriceFeed, decodeMintDecimals } from './onchain'
import { parseOraclePriceFeed } from './oraclePrice'
import { NATIVE_MINT } from './knownMints'
import { assetConfigPda, vaultAtaPda } from './pdas'
import { depositValue } from './tokenomics'

export type GraiAssetVaultBalances = {
  seniorRaw: bigint
  juniorRaw: bigint
  allocatedRaw: bigint
  decimals: number
  /** Vault attributed NAV in USD (`USD_SCALE`). */
  navUsdRaw: bigint
  /** Vault idle balance priced in USD (`USD_SCALE`). */
  seniorUsdRaw: bigint
  /** @deprecated Junior vaults removed — always 0. */
  juniorUsdRaw: bigint
  /** @deprecated Allocated pool removed — always 0. */
  allocatedUsdRaw: bigint
}

/**
 * AssetConfig after 8-byte discriminator:
 * mint(32) feed(32) paused(1) id(4) acc_share(16) total_claimable(8) …
 */
function decodeAssetConfigTotalClaimable(data: Buffer): bigint {
  if (data.length < 101) return 0n
  return data.readBigUInt64LE(93)
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

/** Protocol vault balances for listed assets (`vault` PDA ATA + AssetConfig price feed). */
export async function fetchGraiVaultBalances(
  connection: Connection,
  config: GraiSolanaConfig,
): Promise<Record<string, GraiAssetVaultBalances>> {
  const protocol = await fetchGraiProtocol(connection, config.graiMint)
  const { programId, assetMints } = protocol

  const accountKeys: PublicKey[] = []
  for (const mint of assetMints) {
    accountKeys.push(vaultAtaPda(mint, programId), assetConfigPda(mint, programId))
    if (mint.toBase58() !== NATIVE_MINT) {
      accountKeys.push(mint)
    }
  }

  const accounts = await fetchAccountsByKey(connection, accountKeys)

  const priceFeedKeys = assetMints.map((mint) => {
    const assetConfigData = getAccountData(accounts, assetConfigPda(mint, programId))
    return assetConfigData ? decodeAssetConfigPriceFeed(assetConfigData) : null
  })

  const uniquePriceFeedKeys = [
    ...new Map(
      priceFeedKeys
        .filter((key): key is PublicKey => key !== null)
        .map((key) => [key.toBase58(), key]),
    ).values(),
  ]
  const priceFeedAccounts =
    uniquePriceFeedKeys.length > 0
      ? await fetchAccountsByKey(connection, uniquePriceFeedKeys)
      : new Map()

  const entries = assetMints.map((mint, index) => {
    const mintKey = mint.toBase58()
    const isNativeSol = mintKey === NATIVE_MINT
    const vaultData = getAccountData(accounts, vaultAtaPda(mint, programId))
    const assetConfigData = getAccountData(accounts, assetConfigPda(mint, programId))
    const mintData = isNativeSol ? null : getAccountData(accounts, mint)

    const decimals = isNativeSol ? 9 : mintData ? decodeMintDecimals(mintData) : 0
    const vaultRaw = vaultData ? decodeTokenAccountAmount(vaultData) : 0n
    const claimable = assetConfigData ? decodeAssetConfigTotalClaimable(assetConfigData) : 0n
    // Redeemable / basket display excludes claim reserve (EVM / on-chain redeemable_balance).
    const seniorRaw = vaultRaw > claimable ? vaultRaw - claimable : 0n

    const priceFeedKey = priceFeedKeys[index] ?? null
    const seniorUsdRaw = priceVaultBalanceUsd(
      seniorRaw,
      decimals,
      priceFeedKey,
      priceFeedAccounts,
    )

    return [
      mintKey,
      {
        seniorRaw,
        juniorRaw: 0n,
        allocatedRaw: 0n,
        decimals,
        navUsdRaw: seniorUsdRaw,
        seniorUsdRaw,
        juniorUsdRaw: 0n,
        allocatedUsdRaw: 0n,
      },
    ] as const
  })

  return Object.fromEntries(entries)
}
