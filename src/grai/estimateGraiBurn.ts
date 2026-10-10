import { Connection, PublicKey } from '@solana/web3.js'
import { decodeTokenAccountAmount, fetchAccountsByKey, getAccountData } from './accountBatch'
import type { GraiSolanaRuntime } from './deployments'
import { fetchGraiProtocol } from './fetchGraiProtocol'
import { resolveGraiAsset, type GraiAsset } from './knownMints'
import { NATIVE_MINT } from './knownMints'
import {
  decodeAssetConfigPriceFeed,
  decodeMintDecimals,
  decodeMintSupply,
  formatTokenBalance,
  parseTokenAmount,
} from './onchain'
import { parseOraclePriceFeed } from './oraclePrice'
import { assetConfigPda, vaultAtaPda } from './pdas'
import { depositValue, redeemAssetAmount, USD_SCALE } from './tokenomics'

export type GraiBurnOutputEstimate = {
  asset: GraiAsset
  amountLabel: string
  usdLabel: string | null
  usdRaw: bigint
}

function tryParseGraiAmount(amountInput: string, graiDecimals: number): bigint | null {
  const trimmed = amountInput.trim()
  if (!trimmed || trimmed === '.' || trimmed.endsWith('.')) return null

  try {
    return parseTokenAmount(trimmed, graiDecimals)
  } catch {
    return null
  }
}

const BURN_AMOUNT_MAX_FRACTION_DIGITS = 4
const BURN_USD_MAX_FRACTION_DIGITS = 2

function formatBurnAmountLabel(redeemRaw: bigint, decimals: number): string {
  if (redeemRaw <= 0n) return '0.0'
  const label = formatTokenBalance(redeemRaw, decimals, BURN_AMOUNT_MAX_FRACTION_DIGITS)
  return label.includes('.') ? label : `${label}.0`
}

function formatBurnUsdLabel(usdRaw: bigint): string | null {
  if (usdRaw <= 0n) return null
  const normalized = formatTokenBalance(usdRaw, USD_SCALE, BURN_USD_MAX_FRACTION_DIGITS)
  const [wholePart, fractionPart] = normalized.split('.')
  const wholeFormatted = Number(wholePart).toLocaleString()
  const usd = fractionPart ? `${wholeFormatted}.${fractionPart}` : wholeFormatted
  return `$${usd}`
}

export async function estimateGraiBurnOutputs(
  graiAmountInput: string,
  graiDecimals: number,
  connection: Connection,
  config: GraiSolanaRuntime,
): Promise<GraiBurnOutputEstimate[] | null> {
  const graiAmount = tryParseGraiAmount(graiAmountInput, graiDecimals)
  if (graiAmount === null) return null

  const protocol = await fetchGraiProtocol(connection, config.graiMint)
  const graiState = config.graiState
  const assetMints = protocol.assetMints
  const programId = config.programId

  const accountKeys: PublicKey[] = [graiState, config.graiMint]
  for (const mint of assetMints) {
    accountKeys.push(assetConfigPda(mint, programId), vaultAtaPda(mint, programId))
    if (mint.toBase58() !== NATIVE_MINT) {
      accountKeys.push(mint)
    }
  }

  const accounts = await fetchAccountsByKey(connection, accountKeys)
  const graiStateData = getAccountData(accounts, graiState)
  const graiMintData = getAccountData(accounts, config.graiMint)

  if (!graiStateData || !graiMintData) {
    throw new Error('Unable to load GRAI burn estimate data')
  }

  const totalSupply = decodeMintSupply(graiMintData)
  if (totalSupply <= 0n || graiAmount > totalSupply) {
    return assetMints.map((mint) => {
      const asset = resolveGraiAsset(mint.toBase58())
      return { asset, amountLabel: '0', usdLabel: null, usdRaw: 0n }
    })
  }

  const priceFeedKeys = assetMints.map((mint) => {
    const assetConfigData = getAccountData(accounts, assetConfigPda(mint, programId))
    return assetConfigData ? decodeAssetConfigPriceFeed(assetConfigData) : null
  })

  const uniquePriceFeedKeys = [
    ...new Map(
      priceFeedKeys.filter((key): key is PublicKey => key !== null).map((key) => [key.toBase58(), key]),
    ).values(),
  ]
  const priceFeedAccounts = await fetchAccountsByKey(connection, uniquePriceFeedKeys)

  return assetMints.map((mint, index) => {
    const asset = resolveGraiAsset(mint.toBase58())
    const isNativeSol = mint.toBase58() === NATIVE_MINT
    const mintData = isNativeSol ? null : getAccountData(accounts, mint)
    const decimals = isNativeSol ? 9 : mintData ? decodeMintDecimals(mintData) : 0

    const vaultAtaData = getAccountData(accounts, vaultAtaPda(mint, programId))
    const idleRaw = vaultAtaData ? decodeTokenAccountAmount(vaultAtaData) : 0n
    const redeemRaw = redeemAssetAmount(graiAmount, totalSupply, idleRaw)

    let usdRaw = 0n
    const priceFeedKey = priceFeedKeys[index]
    if (redeemRaw > 0n && priceFeedKey) {
      try {
        const priceFeedAccount = priceFeedAccounts.get(priceFeedKey.toBase58())
        if (priceFeedAccount) {
          const oracle = parseOraclePriceFeed(priceFeedAccount)
          usdRaw = depositValue(redeemRaw, decimals, oracle.price, oracle.decimals)
        }
      } catch {
        usdRaw = 0n
      }
    }

    return {
      asset,
      amountLabel: formatBurnAmountLabel(redeemRaw, decimals),
      usdLabel: formatBurnUsdLabel(usdRaw),
      usdRaw,
    }
  })
}
