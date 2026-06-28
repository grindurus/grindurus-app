import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import type { GraiSolanaConfig } from './deployments'
import { graiStatePda } from './deployments'
import { fetchMintDecimals, parseTokenAmount } from './onchain'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  custodyAllocationPda,
  getAssociatedTokenAddress,
  juniorVaultAtaPda,
  juniorVaultPda,
  TOKEN_PROGRAM_ID,
} from './pdas'

const ALLOCATE_DISCRIMINATOR = Buffer.from([64, 38, 189, 129, 24, 157, 82, 136])

function encodeAllocateInstructionData(amount: bigint): Buffer {
  const data = Buffer.alloc(16)
  ALLOCATE_DISCRIMINATOR.copy(data, 0)
  data.writeBigUInt64LE(amount, 8)
  return data
}

export type BuildAllocateTransactionParams = {
  authority: PublicKey
  assetMint: PublicKey
  custodyWallet: PublicKey
  amount: bigint
  connection: Connection
  config: GraiSolanaConfig
}

export async function buildAllocateTransaction({
  authority,
  assetMint,
  custodyWallet,
  amount,
  connection,
  config,
}: BuildAllocateTransactionParams): Promise<Transaction> {
  if (amount <= 0n) {
    throw new Error('Amount must be greater than zero')
  }

  const programId = config.programId
  const graiState = graiStatePda(programId)
  const juniorVault = juniorVaultPda(assetMint, programId)
  const juniorVaultAta = juniorVaultAtaPda(assetMint, programId)
  const custodyAta = getAssociatedTokenAddress(assetMint, custodyWallet)
  const custodyAllocation = custodyAllocationPda(custodyWallet, assetMint, programId)

  const allocateIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: assetMint, isSigner: false, isWritable: false },
      { pubkey: graiState, isSigner: false, isWritable: false },
      { pubkey: juniorVault, isSigner: false, isWritable: true },
      { pubkey: juniorVaultAta, isSigner: false, isWritable: true },
      { pubkey: custodyWallet, isSigner: false, isWritable: false },
      { pubkey: custodyAta, isSigner: false, isWritable: true },
      { pubkey: custodyAllocation, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: encodeAllocateInstructionData(amount),
  })

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  const transaction = new Transaction({
    feePayer: authority,
    blockhash,
    lastValidBlockHeight,
  })
  transaction.add(allocateIx)

  return transaction
}

export type ExecuteAllocateParams = {
  authority: PublicKey
  assetMint: PublicKey
  custodyWallet: PublicKey
  amountInput: string
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  connection: Connection
  config: GraiSolanaConfig
}

export async function executeAllocate({
  authority,
  assetMint,
  custodyWallet,
  amountInput,
  signTransaction,
  connection,
  config,
}: ExecuteAllocateParams): Promise<{ signature: string; amount: bigint }> {
  const decimals = await fetchMintDecimals(connection, assetMint)
  const amount = parseTokenAmount(amountInput, decimals)
  const transaction = await buildAllocateTransaction({
    authority,
    assetMint,
    custodyWallet,
    amount,
    connection,
    config,
  })
  const signed = await signTransaction(transaction)
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })
  await connection.confirmTransaction(signature, 'confirmed')
  return { signature, amount }
}
