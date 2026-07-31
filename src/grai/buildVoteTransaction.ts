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
import { lockRemainingAccountMetas } from './buildLockTransaction'
import { confirmSignatureViaHttp, parseTokenAmount } from './onchain'
import {
  escrowPda,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  vaultAtaPda,
} from './pdas'
import { createAssociatedTokenAccountIdempotentInstruction } from './splInstructions'

/** Anchor discriminator for `grai::vote` (`sha256("global:vote")[0..8]`). */
const VOTE_DISCRIMINATOR = Buffer.from([227, 110, 155, 23, 136, 126, 172, 25])

function encodeVoteInstructionData(graiAmount: bigint): Buffer {
  const data = Buffer.alloc(16)
  VOTE_DISCRIMINATOR.copy(data, 0)
  data.writeBigUInt64LE(graiAmount, 8)
  return data
}

export type BuildVoteTransactionParams = {
  voter: PublicKey
  graiAmount: bigint
  connection: Connection
  config: GraiSolanaRuntime
}

export async function buildVoteTransaction({
  voter,
  graiAmount,
  connection,
  config,
}: BuildVoteTransactionParams): Promise<Transaction> {
  if (graiAmount <= 0n) throw new Error('Vote amount must be greater than zero')

  const programId = config.programId
  const protocol = await fetchGraiProtocol(connection, config.graiMint)
  const graiState = graiStatePda(programId)
  const escrow = escrowPda(voter, programId)
  const voterGraiAta = getAssociatedTokenAddress(config.graiMint, voter)
  const graiVaultAta = vaultAtaPda(config.graiMint, programId)

  const voteIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: voter, isSigner: true, isWritable: true },
      { pubkey: graiState, isSigner: false, isWritable: true },
      { pubkey: config.graiMint, isSigner: false, isWritable: false },
      { pubkey: escrow, isSigner: false, isWritable: true },
      { pubkey: voterGraiAta, isSigner: false, isWritable: true },
      { pubkey: graiVaultAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      // Remaining: `[asset_config, position]` for auto-lock / vote settle.
      ...lockRemainingAccountMetas(voter, protocol.assetMints, programId),
    ],
    data: encodeVoteInstructionData(graiAmount),
  })

  const instructions: TransactionInstruction[] = []
  const voterGraiAtaInfo = await connection.getAccountInfo(voterGraiAta)
  if (!voterGraiAtaInfo) {
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        voter,
        voterGraiAta,
        voter,
        config.graiMint,
      ),
    )
  }
  instructions.push(voteIx)

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  const transaction = new Transaction({
    feePayer: voter,
    blockhash,
    lastValidBlockHeight,
  })
  transaction.add(...instructions)
  return transaction
}

export type ExecuteVoteParams = {
  voter: PublicKey
  amountInput: string
  graiDecimals: number
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  connection: Connection
  config: GraiSolanaRuntime
}

export async function executeVote({
  voter,
  amountInput,
  graiDecimals,
  signTransaction,
  connection,
  config,
}: ExecuteVoteParams): Promise<{ signature: string; amount: bigint }> {
  const amount = parseTokenAmount(amountInput, graiDecimals)
  const transaction = await buildVoteTransaction({
    voter,
    graiAmount: amount,
    connection,
    config,
  })
  const signed = await signTransaction(transaction)
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })
  await confirmSignatureViaHttp(connection, signature, 'confirmed')
  return { signature, amount }
}
