import { createGraiRegistryConnection, GRAI_MINT } from './constants'
import { decodeMintDecimals, decodeMintSupply, formatTokenBalance } from './onchain'

export type GraiMintSupply = {
  raw: bigint
  decimals: number
  label: string
}

export async function fetchGraiMintSupply(): Promise<GraiMintSupply> {
  const connection = createGraiRegistryConnection()
  const account = await connection.getAccountInfo(GRAI_MINT)
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
