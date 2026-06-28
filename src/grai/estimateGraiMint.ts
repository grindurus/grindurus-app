import { Connection, PublicKey } from '@solana/web3.js'
import { fetchAccountsByKey, getAccountData } from './accountBatch'
import type { GraiSolanaConfig } from './deployments'
import { graiStatePda } from './deployments'
import { decodeMintSupply, decodeSeniorVaultPriceFeed, parseTokenAmount } from './onchain'
import { parseOraclePriceFeed } from './oraclePrice'
import { seniorVaultPda } from './pdas'
import { depositValue, graiMintAmount } from './tokenomics'

function readU128LE(buf: Buffer, offset: number): bigint {
  let value = 0n
  for (let i = 0; i < 16; i += 1) {
    value |= BigInt(buf[offset + i]!) << BigInt(i * 8)
  }
  return value
}

function decodeGraiStateTotalValue(data: Buffer): bigint {
  return readU128LE(data, 40)
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

export async function estimateGraiMintOutput(
  assetMint: PublicKey,
  amountInput: string,
  assetDecimals: number,
  connection: Connection,
  config: GraiSolanaConfig,
): Promise<bigint | null> {
  const depositAmount = tryParseDepositAmount(amountInput, assetDecimals)
  if (depositAmount === null) return null

  const graiState = graiStatePda(config.programId)
  const seniorVault = seniorVaultPda(assetMint, config.programId)

  const accounts = await fetchAccountsByKey(connection, [graiState, config.graiMint, seniorVault])
  const graiStateData = getAccountData(accounts, graiState)
  const graiMintData = getAccountData(accounts, config.graiMint)
  const seniorVaultData = getAccountData(accounts, seniorVault)

  if (!graiStateData || !graiMintData || !seniorVaultData) {
    throw new Error('Unable to load GRAI mint estimate data')
  }

  const priceFeedKey = decodeSeniorVaultPriceFeed(seniorVaultData)
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
  return graiMintAmount(depositValueUsd, totalSupply, totalValue)
}
