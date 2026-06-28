import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import type { GraiSolanaConfig } from './deployments'
import { graiStatePda } from './deployments'
import { fetchGraiRegistryAssetMints } from './fetchAssets'
import { fetchMintDecimals, parseTokenAmount } from './onchain'
import { getAssociatedTokenAddress, seniorVaultAtaPda, seniorVaultPda, TOKEN_PROGRAM_ID } from './pdas'
import { createAssociatedTokenAccountIdempotentInstruction } from './splInstructions'

const BURN_DISCRIMINATOR = Buffer.from([116, 110, 29, 56, 107, 219, 42, 93])

function encodeBurnInstructionData(graiAmount: bigint): Buffer {
  const data = Buffer.alloc(16)
  BURN_DISCRIMINATOR.copy(data, 0)
  data.writeBigUInt64LE(graiAmount, 8)
  return data
}

export type BuildBurnTransactionParams = {
  burner: PublicKey
  graiAmount: bigint
  connection: Connection
  config: GraiSolanaConfig
}

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
  const graiState = graiStatePda(programId)
  const burnerGraiAta = getAssociatedTokenAddress(config.graiMint, burner)
  const assetMints = await fetchGraiRegistryAssetMints(connection, config)

  if (assetMints.length === 0) {
    throw new Error('No assets registered in GRAI protocol')
  }

  const instructions: TransactionInstruction[] = []

  for (const assetMint of assetMints) {
    const redeemerAta = getAssociatedTokenAddress(assetMint, burner)
    const redeemerAtaInfo = await connection.getAccountInfo(redeemerAta)
    if (!redeemerAtaInfo) {
      instructions.push(
        createAssociatedTokenAccountIdempotentInstruction(burner, redeemerAta, burner, assetMint),
      )
    }
  }

  const remainingAccounts = assetMints.flatMap((assetMint) => {
    const seniorVault = seniorVaultPda(assetMint, programId)
    const seniorVaultAta = seniorVaultAtaPda(assetMint, programId)
    const redeemerAta = getAssociatedTokenAddress(assetMint, burner)

    return [
      { pubkey: seniorVault, isSigner: false, isWritable: true },
      { pubkey: seniorVaultAta, isSigner: false, isWritable: true },
      { pubkey: redeemerAta, isSigner: false, isWritable: true },
    ]
  })

  const burnIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: burner, isSigner: true, isWritable: false },
      { pubkey: graiState, isSigner: false, isWritable: true },
      { pubkey: burnerGraiAta, isSigner: false, isWritable: true },
      { pubkey: config.graiMint, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ...remainingAccounts,
    ],
    data: encodeBurnInstructionData(graiAmount),
  })

  instructions.push(burnIx)

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
  config: GraiSolanaConfig
}

export async function executeBurn({
  burner,
  amountInput,
  signTransaction,
  connection,
  config,
}: ExecuteBurnParams): Promise<{ signature: string; amount: bigint }> {
  const decimals = await fetchMintDecimals(connection, config.graiMint)
  const graiAmount = parseTokenAmount(amountInput, decimals)
  const transaction = await buildBurnTransaction({ burner, graiAmount, connection, config })
  const signed = await signTransaction(transaction)
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })
  await connection.confirmTransaction(signature, 'confirmed')
  return { signature, amount: graiAmount }
}
