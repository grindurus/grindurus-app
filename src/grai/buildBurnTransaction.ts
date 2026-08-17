import {
  Connection,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import type { GraiSolanaRuntime } from './deployments'
import { graiStatePda } from './deployments'
import { fetchGraiProtocol } from './fetchGraiProtocol'
import {
  confirmSignatureViaHttp,
  fetchMintDecimals,
  formatTokenBalance,
  parseTokenAmount,
} from './onchain'
import {
  assetConfigPda,
  escrowPda,
  getAssociatedTokenAddress,
  positionPda,
  TOKEN_PROGRAM_ID,
  vaultAtaPda,
} from './pdas'
import { createAssociatedTokenAccountIdempotentInstruction } from './splInstructions'

/** Anchor discriminator for `grai::redeem`. */
const REDEEM_DISCRIMINATOR = Buffer.from([184, 12, 86, 149, 70, 196, 97, 225])

function encodeRedeemInstructionData(graiAmount: bigint): Buffer {
  const data = Buffer.alloc(16)
  REDEEM_DISCRIMINATOR.copy(data, 0)
  data.writeBigUInt64LE(graiAmount, 8)
  return data
}

export type BuildBurnTransactionParams = {
  burner: PublicKey
  graiAmount: bigint
  connection: Connection
  config: GraiSolanaRuntime
}

/** Builds `redeem` (legacy burn name kept for app hooks). */
export async function buildBurnTransaction({
  burner,
  graiAmount,
  connection,
  config,
}: BuildBurnTransactionParams): Promise<Transaction> {
  if (graiAmount <= 0n) {
    throw new Error('Amount must be greater than zero')
  }

  const programId = config.programId
  const protocol = await fetchGraiProtocol(connection, config.graiMint)
  if (!protocol.liquidation) {
    throw new Error('Redeem is only available while liquidation is open')
  }

  const graiState = graiStatePda(programId)
  const escrow = escrowPda(burner, programId)
  const holderGraiAta = getAssociatedTokenAddress(config.graiMint, burner)
  const graiVaultAta = vaultAtaPda(config.graiMint, programId)

  const remaining = protocol.assetMints.flatMap((mint) => {
    const holderAta = getAssociatedTokenAddress(mint, burner)
    return [
      { pubkey: assetConfigPda(mint, programId), isSigner: false, isWritable: true },
      { pubkey: positionPda(burner, mint, programId), isSigner: false, isWritable: true },
      { pubkey: vaultAtaPda(mint, programId), isSigner: false, isWritable: true },
      { pubkey: holderAta, isSigner: false, isWritable: true },
    ]
  })

  const redeemIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: burner, isSigner: true, isWritable: true },
      { pubkey: graiState, isSigner: false, isWritable: true },
      { pubkey: config.graiMint, isSigner: false, isWritable: true },
      { pubkey: escrow, isSigner: false, isWritable: true },
      { pubkey: holderGraiAta, isSigner: false, isWritable: true },
      { pubkey: graiVaultAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ...remaining,
    ],
    data: encodeRedeemInstructionData(graiAmount),
  })

  const instructions: TransactionInstruction[] = [
    createAssociatedTokenAccountIdempotentInstruction(
      burner,
      holderGraiAta,
      burner,
      config.graiMint,
    ),
  ]
  for (const mint of protocol.assetMints) {
    const holderAta = getAssociatedTokenAddress(mint, burner)
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(burner, holderAta, burner, mint),
    )
  }
  instructions.push(redeemIx)

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  const transaction = new Transaction({
    feePayer: burner,
    blockhash,
    lastValidBlockHeight,
  })
  transaction.add(...instructions)
  return transaction
}

export type ExecuteBurnParams = {
  burner: PublicKey
  amountInput: string
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  connection: Connection
  config: GraiSolanaRuntime
}

export async function executeBurn({
  burner,
  amountInput,
  signTransaction,
  connection,
  config,
}: ExecuteBurnParams): Promise<{ signature: string; amount: bigint; amountLabel: string }> {
  const decimals = await fetchMintDecimals(connection, config.graiMint)
  const graiAmount = parseTokenAmount(amountInput, decimals)
  const transaction = await buildBurnTransaction({
    burner,
    graiAmount,
    connection,
    config,
  })
  const signed = await signTransaction(transaction)
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })
  await confirmSignatureViaHttp(connection, signature, 'confirmed')
  return {
    signature,
    amount: graiAmount,
    amountLabel: formatTokenBalance(graiAmount, decimals),
  }
}

export const buildRedeemTransaction = buildBurnTransaction
export const executeRedeem = executeBurn
