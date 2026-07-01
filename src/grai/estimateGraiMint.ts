import { Connection, PublicKey } from '@solana/web3.js'
import { fetchAccountsByKey, getAccountData } from './accountBatch'
import type { GraiSolanaRuntime } from './deployments'
import { decodeMintSupply, decodeSeniorVaultMintSplit, decodeSeniorVaultPriceFeed, parseTokenAmount } from './onchain'
import { parseOraclePriceFeed } from './oraclePrice'
import { seniorVaultPda } from './pdas'
import { depositValue, graiMintAmount, mintSplit } from './tokenomics'

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

export type GraiMintEstimate = {
  graiRaw: bigint
  seniorRaw: bigint
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
  const graiRaw = graiMintAmount(depositValueUsd, totalSupply, totalValue)
  const mintSplitBps = decodeSeniorVaultMintSplit(seniorVaultData)
  const [seniorRaw, juniorRaw] = mintSplit(depositAmount, mintSplitBps)
  const seniorUsdRaw = depositValue(seniorRaw, assetDecimals, oracle.price, oracle.decimals)
  const juniorUsdRaw = depositValue(juniorRaw, assetDecimals, oracle.price, oracle.decimals)

  return { graiRaw, seniorRaw, juniorRaw, seniorUsdRaw, juniorUsdRaw }
}
