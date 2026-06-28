import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import type { GraiSolanaConfig } from './deployments'
import { graiStatePda } from './deployments'
import { NATIVE_MINT } from './knownMints'
import { fetchMintDecimals, fetchSeniorVaultPriceFeed, parseTokenAmount } from './onchain'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  juniorVaultAtaPda,
  seniorVaultAtaPda,
  seniorVaultPda,
  TOKEN_PROGRAM_ID,
} from './pdas'
import { createAssociatedTokenAccountIdempotentInstruction } from './splInstructions'

const MINT_DISCRIMINATOR = Buffer.from([51, 57, 225, 47, 182, 146, 137, 166])
const MINT_SOL_DISCRIMINATOR = Buffer.from([150, 224, 6, 12, 74, 224, 40, 133])

function encodeMintInstructionData(amount: bigint, isSol: boolean): Buffer {
  const data = Buffer.alloc(16)
  ;(isSol ? MINT_SOL_DISCRIMINATOR : MINT_DISCRIMINATOR).copy(data, 0)
  data.writeBigUInt64LE(amount, 8)
  return data
}

export type BuildMintTransactionParams = {
  minter: PublicKey
  assetMint: PublicKey
  amount: bigint
  connection: Connection
  config: GraiSolanaConfig
}

export async function buildMintTransaction({
  minter,
  assetMint,
  amount,
  connection,
  config,
}: BuildMintTransactionParams): Promise<Transaction> {
  if (amount <= 0n) {
    throw new Error('Amount must be greater than zero')
  }

  const programId = config.programId
  const isSol = assetMint.toBase58() === NATIVE_MINT
  const graiState = graiStatePda(programId)
  const seniorVault = seniorVaultPda(assetMint, programId)
  const seniorVaultAta = seniorVaultAtaPda(assetMint, programId)
  const juniorVaultAta = juniorVaultAtaPda(assetMint, programId)
  const priceFeed = await fetchSeniorVaultPriceFeed(connection, seniorVault)
  const minterGraiAta = getAssociatedTokenAddress(config.graiMint, minter)
  const minterAssetAta = getAssociatedTokenAddress(assetMint, minter)

  const mintIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: minter, isSigner: true, isWritable: true },
      { pubkey: graiState, isSigner: false, isWritable: true },
      { pubkey: assetMint, isSigner: false, isWritable: false },
      { pubkey: config.graiMint, isSigner: false, isWritable: true },
      { pubkey: priceFeed, isSigner: false, isWritable: false },
      { pubkey: seniorVault, isSigner: false, isWritable: true },
      { pubkey: seniorVaultAta, isSigner: false, isWritable: true },
      { pubkey: juniorVaultAta, isSigner: false, isWritable: true },
      { pubkey: minterAssetAta, isSigner: false, isWritable: true },
      { pubkey: minterGraiAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: encodeMintInstructionData(amount, isSol),
  })

  const instructions: TransactionInstruction[] = []

  if (!isSol) {
    const minterAssetAtaInfo = await connection.getAccountInfo(minterAssetAta)
    if (!minterAssetAtaInfo) {
      instructions.push(
        createAssociatedTokenAccountIdempotentInstruction(minter, minterAssetAta, minter, assetMint),
      )
    }
  } else {
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(minter, minterAssetAta, minter, assetMint),
    )
  }

  instructions.push(mintIx)

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  const transaction = new Transaction({
    feePayer: minter,
    blockhash,
    lastValidBlockHeight,
  })
  transaction.add(...instructions)

  return transaction
}

export type ExecuteMintParams = {
  minter: PublicKey
  assetMint: PublicKey
  amountInput: string
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  connection: Connection
  config: GraiSolanaConfig
}

export async function executeMint({
  minter,
  assetMint,
  amountInput,
  signTransaction,
  connection,
  config,
}: ExecuteMintParams): Promise<{ signature: string; amount: bigint }> {
  const decimals = await fetchMintDecimals(connection, assetMint)
  const amount = parseTokenAmount(amountInput, decimals)
  const transaction = await buildMintTransaction({ minter, assetMint, amount, connection, config })
  const signed = await signTransaction(transaction)
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })
  await connection.confirmTransaction(signature, 'confirmed')
  return { signature, amount }
}
