import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import type { GraiSolanaRuntime } from './deployments'
import { graiStatePda } from './deployments'
import { fetchGraiProtocol } from './fetchGraiProtocol'
import { lockRemainingAccountMetas } from './buildLockTransaction'
import {
  confirmSignatureViaHttp,
  fetchAssetConfigPriceFeed,
  parseTokenAmount,
} from './onchain'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  assetConfigPda,
  escrowPda,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  vaultAtaPda,
} from './pdas'
import { createAssociatedTokenAccountIdempotentInstruction } from './splInstructions'

/** Anchor discriminator for `grai::bribe` (`sha256("global:bribe")[0..8]`). */
const BRIBE_DISCRIMINATOR = Buffer.from([40, 207, 231, 7, 109, 179, 119, 140])

function encodeBribeInstructionData(graiAmount: bigint): Buffer {
  const data = Buffer.alloc(16)
  BRIBE_DISCRIMINATOR.copy(data, 0)
  data.writeBigUInt64LE(graiAmount, 8)
  return data
}

export type BuildBribeTransactionParams = {
  briber: PublicKey
  voter: PublicKey
  graiAmount: bigint
  connection: Connection
  config: GraiSolanaRuntime
}

export async function buildBribeTransaction({
  briber,
  voter,
  graiAmount,
  connection,
  config,
}: BuildBribeTransactionParams): Promise<Transaction> {
  if (graiAmount <= 0n) throw new Error('Bribe amount must be greater than zero')

  const programId = config.programId
  const protocol = await fetchGraiProtocol(connection, config.graiMint)
  const bribeMint = protocol.settlementAsset
  if (bribeMint.equals(PublicKey.default)) {
    throw new Error('Bribe asset is not set on-chain')
  }

  const graiState = graiStatePda(programId)
  const escrow = escrowPda(voter, programId)
  const bribeAssetConfig = assetConfigPda(bribeMint, programId)
  const bribePriceFeed = await fetchAssetConfigPriceFeed(connection, bribeAssetConfig)
  const graiVaultAta = vaultAtaPda(config.graiMint, programId)
  const bribeVaultAta = vaultAtaPda(bribeMint, programId)
  const briberGraiAta = getAssociatedTokenAddress(config.graiMint, briber)
  const briberBribeAta = getAssociatedTokenAddress(bribeMint, briber)
  const voterBribeAta = getAssociatedTokenAddress(bribeMint, voter)
  const treasuryBribeAta = getAssociatedTokenAddress(bribeMint, protocol.treasury)

  const keys = [
    { pubkey: briber, isSigner: true, isWritable: true },
    { pubkey: voter, isSigner: false, isWritable: false },
    { pubkey: graiState, isSigner: false, isWritable: true },
    { pubkey: config.graiMint, isSigner: false, isWritable: false },
    { pubkey: escrow, isSigner: false, isWritable: true },
    { pubkey: bribeMint, isSigner: false, isWritable: false },
    { pubkey: bribeAssetConfig, isSigner: false, isWritable: true },
    { pubkey: bribePriceFeed, isSigner: false, isWritable: false },
    { pubkey: graiVaultAta, isSigner: false, isWritable: true },
    { pubkey: bribeVaultAta, isSigner: false, isWritable: true },
    { pubkey: briberGraiAta, isSigner: false, isWritable: true },
    { pubkey: briberBribeAta, isSigner: false, isWritable: true },
    { pubkey: voterBribeAta, isSigner: false, isWritable: true },
    { pubkey: treasuryBribeAta, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    // Remaining: `[asset_config, position]` for the voter per listed asset.
    ...lockRemainingAccountMetas(voter, protocol.assetMints, programId),
  ]

  const bribeIx = new TransactionInstruction({
    programId,
    keys,
    data: encodeBribeInstructionData(graiAmount),
  })

  const instructions: TransactionInstruction[] = []

  // `briber_bribe_ata` / `treasury_bribe_ata` are not `init_if_needed` — ensure they exist.
  const [briberBribeInfo, treasuryBribeInfo] = await connection.getMultipleAccountsInfo([
    briberBribeAta,
    treasuryBribeAta,
  ])
  if (!briberBribeInfo) {
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        briber,
        briberBribeAta,
        briber,
        bribeMint,
      ),
    )
  }
  if (!treasuryBribeInfo) {
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        briber,
        treasuryBribeAta,
        protocol.treasury,
        bribeMint,
      ),
    )
  }

  instructions.push(bribeIx)

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  const transaction = new Transaction({
    feePayer: briber,
    blockhash,
    lastValidBlockHeight,
  })
  transaction.add(...instructions)
  return transaction
}

export type ExecuteBribeParams = {
  briber: PublicKey
  voter: PublicKey
  amountInput: string
  graiDecimals: number
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  connection: Connection
  config: GraiSolanaRuntime
}

export async function executeBribe({
  briber,
  voter,
  amountInput,
  graiDecimals,
  signTransaction,
  connection,
  config,
}: ExecuteBribeParams): Promise<{ signature: string; amount: bigint }> {
  const amount = parseTokenAmount(amountInput, graiDecimals)
  const transaction = await buildBribeTransaction({
    briber,
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
