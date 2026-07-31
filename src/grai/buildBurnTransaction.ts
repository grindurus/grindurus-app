import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import type { GraiSolanaRuntime } from './deployments'
import { fetchMintDecimals, parseTokenAmount, formatTokenBalance } from './onchain'

export type BuildBurnTransactionParams = {
  burner: PublicKey
  graiAmount: bigint
  connection: Connection
  config: GraiSolanaRuntime
}

/** Burn was removed — redeem via vote / resolve / liquidate. */
export async function buildBurnTransaction(
  _params: BuildBurnTransactionParams,
): Promise<Transaction> {
  throw new Error(
    'Burn is removed in the new GRAI model. Use vote → resolve → liquidate after quorum.',
  )
}

export type ExecuteBurnParams = {
  burner: PublicKey
  amountInput: string
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  connection: Connection
  config: GraiSolanaRuntime
}

export async function executeBurn({
  amountInput,
  connection,
  config,
}: ExecuteBurnParams): Promise<{ signature: string; amount: bigint; amountLabel: string }> {
  const decimals = await fetchMintDecimals(connection, config.graiMint)
  const graiAmount = parseTokenAmount(amountInput, decimals)
  await buildBurnTransaction({
    burner: PublicKey.default,
    graiAmount,
    connection,
    config,
  })
  return {
    signature: '',
    amount: graiAmount,
    amountLabel: formatTokenBalance(graiAmount, decimals),
  }
}
