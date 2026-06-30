export const GRAI_DECIMALS = 9
export const USD_SCALE = 9
export const MINT_SPLIT_BPS_MAX = 10_000

function pow10(decimals: number): bigint {
  return 10n ** BigInt(decimals)
}

export function depositValue(
  depositAmount: bigint,
  assetDecimals: number,
  price: bigint,
  priceDecimals: number,
): bigint {
  if (depositAmount <= 0n || price <= 0n) return 0n

  const numerator = depositAmount * price * pow10(USD_SCALE)
  const denominator = pow10(assetDecimals) * pow10(priceDecimals)
  return numerator / denominator
}

export function graiMintAmount(
  depositValueUsd: bigint,
  totalSupply: bigint,
  totalValue: bigint,
): bigint {
  if (depositValueUsd <= 0n) return 0n
  if (totalSupply === 0n || totalValue === 0n) return depositValueUsd
  return (depositValueUsd * totalSupply) / totalValue
}

export function graiBurnValue(
  graiAmount: bigint,
  totalSupply: bigint,
  totalValue: bigint,
): bigint {
  if (graiAmount <= 0n || totalSupply <= 0n) return 0n
  return (graiAmount * totalValue) / totalSupply
}

/** `redeem = grai_amount * idle / total_supply` — matches on-chain burn redemption. */
export function redeemAssetAmount(
  graiAmount: bigint,
  totalSupply: bigint,
  idleAmount: bigint,
): bigint {
  if (graiAmount <= 0n || totalSupply <= 0n || idleAmount <= 0n) return 0n

  const redeem = (graiAmount * idleAmount) / totalSupply
  if (redeem <= 0n || redeem > idleAmount) return 0n
  return redeem
}

/** `senior = amount * split_bps / 10_000`, remainder to junior vault — matches on-chain mint. */
export function mintSplit(amount: bigint, mintSplitBps: number): [bigint, bigint] {
  if (mintSplitBps < 0 || mintSplitBps > MINT_SPLIT_BPS_MAX) {
    throw new Error('Invalid mint split')
  }

  const senior = (amount * BigInt(mintSplitBps)) / BigInt(MINT_SPLIT_BPS_MAX)
  const junior = amount - senior
  return [senior, junior]
}

/** `senior = amount * split_bps / 10_000`, remainder to treasury — matches on-chain distribute. */
export function yieldSplit(amount: bigint, yieldSplitBps: number): [bigint, bigint] {
  if (yieldSplitBps < 0 || yieldSplitBps > MINT_SPLIT_BPS_MAX) {
    throw new Error('Invalid yield split')
  }

  const senior = (amount * BigInt(yieldSplitBps)) / BigInt(MINT_SPLIT_BPS_MAX)
  const treasury = amount - senior
  return [senior, treasury]
}
