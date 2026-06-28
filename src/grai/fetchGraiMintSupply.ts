import type { Connection } from '@solana/web3.js'
import type { GraiSolanaConfig } from './deployments'
import { decodeMintDecimals, decodeMintSupply, formatTokenBalance } from './onchain'

export type GraiMintSupply = {
  raw: bigint
  decimals: number
  label: string
}

export async function fetchGraiMintSupply(
  connection: Connection,
  config: GraiSolanaConfig,
): Promise<GraiMintSupply> {
  const account = await connection.getAccountInfo(config.graiMint)
  if (!account?.data) {
    throw new Error('GRAI mint account not found')
  }

  const data = Buffer.from(account.data)
  const raw = decodeMintSupply(data)
  const decimals = decodeMintDecimals(data)

  return {
    raw,
    decimals,
    label: formatTokenBalance(raw, decimals, 4),
  }
}
