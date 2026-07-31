import { Connection, PublicKey } from '@solana/web3.js'
import { fetchAccountsByKey, getAccountData } from './accountBatch'
import type { GraiSolanaRuntime } from './deployments'
import {
  decodeAssetConfigPriceFeed,
  decodeMintSupply,
  parseTokenAmount,
} from './onchain'
import { parseOraclePriceFeed } from './oraclePrice'
import { assetConfigPda } from './pdas'
import { depositValue, graiMintAmount } from './tokenomics'

function readU128LE(buf: Buffer, offset: number): bigint {
  let value = 0n
  for (let i = 0; i < 16; i += 1) {
    value |= BigInt(buf[offset + i]!) << BigInt(i * 8)
  }
  return value
}

function decodeGraiStateTotalValue(data: Buffer): bigint {
  // After disc(8) + authority/treasury/grinders/bribe (128) → total_value at 136.
  return readU128LE(data, 136)
}

function tryParseDepositAmount(amountInput: string, assetDecimals: number): bigint | null {
  const trimmed = amountInput.trim()
  if (!trimmed || trimmed === '.' || trimmed.endsWith('.')) return null

  try {
    return parseTokenAmount(trimmed, assetDecimals)
  } catch {
    return null
  }
}

export type GraiMintEstimate = {
  graiRaw: bigint
  /** @deprecated Senior vault removed — always 0. */
  seniorRaw: bigint
  /** Full deposit sent to Grinders (new GRAI model). */
  juniorRaw: bigint
  seniorUsdRaw: bigint
  juniorUsdRaw: bigint
}

export async function estimateGraiMintOutput(
  assetMint: PublicKey,
  amountInput: string,
  assetDecimals: number,
  connection: Connection,
  config: GraiSolanaRuntime,
): Promise<GraiMintEstimate | null> {
  const depositAmount = tryParseDepositAmount(amountInput, assetDecimals)
  if (depositAmount === null) return null

  const graiState = config.graiState
  const assetConfig = assetConfigPda(assetMint, config.programId)

  const accounts = await fetchAccountsByKey(connection, [graiState, config.graiMint, assetConfig])
  const graiStateData = getAccountData(accounts, graiState)
  const graiMintData = getAccountData(accounts, config.graiMint)
  const assetConfigData = getAccountData(accounts, assetConfig)

  if (!graiStateData || !graiMintData || !assetConfigData) {
    throw new Error('Unable to load GRAI mint estimate data')
  }

  const priceFeedKey = decodeAssetConfigPriceFeed(assetConfigData)
  const priceFeedAccounts = await fetchAccountsByKey(connection, [priceFeedKey])
  const priceFeedAccount = priceFeedAccounts.get(priceFeedKey.toBase58())

  if (!priceFeedAccount) {
    throw new Error('Unable to load price feed for mint estimate')
  }

  const totalValue = decodeGraiStateTotalValue(graiStateData)
  const totalSupply = decodeMintSupply(graiMintData)
  const oracle = parseOraclePriceFeed(priceFeedAccount)

  const depositValueUsd = depositValue(
    depositAmount,
    assetDecimals,
    oracle.price,
    oracle.decimals,
  )
  const graiRaw = graiMintAmount(depositValueUsd, totalSupply, totalValue)
  // Entire deposit goes to Grinders (no senior mint split).
  const juniorUsdRaw = depositValueUsd

  return {
    graiRaw,
    seniorRaw: 0n,
    juniorRaw: depositAmount,
    seniorUsdRaw: 0n,
    juniorUsdRaw,
  }
}
