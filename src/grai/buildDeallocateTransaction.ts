import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import type { GraiSolanaRuntime } from './deployments'
import { graiStatePda } from './deployments'
import { fetchMintDecimals, parseTokenAmount, confirmSignatureViaHttp } from './onchain'
import {
  resolveSolanaAllocateCustodyAccounts,
  resolveSolanaGrindersProgramId,
} from './solanaAllocateCustody'
import {
  allocationPda,
  getAssociatedTokenAddress,
  grindersStatePda,
  TOKEN_PROGRAM_ID,
} from './pdas'

/** grinders::custodian_deallocate discriminator */
const CUSTODIAN_DEALLOCATE_DISCRIMINATOR = Buffer.from([39, 155, 162, 95, 163, 247, 255, 195])

function encodeDeallocateInstructionData(amount: bigint): Buffer {
  const data = Buffer.alloc(16)
  CUSTODIAN_DEALLOCATE_DISCRIMINATOR.copy(data, 0)
  data.writeBigUInt64LE(amount, 8)
  return data
}

export function totalAllocationPda(
  assetMint: PublicKey,
  grindersProgramId: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('total_allocation'), assetMint.toBuffer()],
    grindersProgramId,
  )[0]
}

export type BuildDeallocateTransactionParams = {
  /** Custodian state PDA / custody wallet holding the inventory. */
  custodyWallet: PublicKey
  assetMint: PublicKey
  amount: bigint
  /** Signs as grinders custodian NFT owner. */
  owner: PublicKey
  connection: Connection
  config: GraiSolanaRuntime
}

export async function buildDeallocateTransaction({
  custodyWallet,
  assetMint,
  amount,
  owner,
  connection,
  config,
}: BuildDeallocateTransactionParams): Promise<Transaction> {
  if (amount <= 0n) {
    throw new Error('Amount must be greater than zero')
  }

  const grindersProgram = resolveSolanaGrindersProgramId(config.cluster)
  const grindersState = grindersStatePda(grindersProgram)
  const graiState = graiStatePda(config.programId)
  const { custodianRecord } = await resolveSolanaAllocateCustodyAccounts(
    connection,
    custodyWallet,
    grindersProgram,
  )

  const allocation = allocationPda(custodyWallet, assetMint, grindersProgram)
  const totalAllocation = totalAllocationPda(assetMint, grindersProgram)
  const custodyAta = getAssociatedTokenAddress(assetMint, custodyWallet)
  const grindersAta = getAssociatedTokenAddress(assetMint, grindersState)

  const deallocateIx = new TransactionInstruction({
    programId: grindersProgram,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: grindersState, isSigner: false, isWritable: false },
      { pubkey: graiState, isSigner: false, isWritable: false },
      { pubkey: custodyWallet, isSigner: false, isWritable: false },
      { pubkey: custodianRecord, isSigner: false, isWritable: false },
      { pubkey: assetMint, isSigner: false, isWritable: false },
      { pubkey: allocation, isSigner: false, isWritable: true },
      { pubkey: totalAllocation, isSigner: false, isWritable: true },
      { pubkey: custodyAta, isSigner: false, isWritable: true },
      { pubkey: grindersAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: encodeDeallocateInstructionData(amount),
  })

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  const transaction = new Transaction({
    feePayer: owner,
    blockhash,
    lastValidBlockHeight,
  })
  transaction.add(deallocateIx)

  return transaction
}

export type ExecuteDeallocateParams = {
  custodyWallet: PublicKey
  assetMint: PublicKey
  amountInput: string
  owner: PublicKey
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  connection: Connection
  config: GraiSolanaRuntime
}

export async function executeDeallocate({
  custodyWallet,
  assetMint,
  amountInput,
  owner,
  signTransaction,
  connection,
  config,
}: ExecuteDeallocateParams): Promise<{ signature: string; amount: bigint }> {
  const decimals = await fetchMintDecimals(connection, assetMint)
  const amount = parseTokenAmount(amountInput, decimals)
  const transaction = await buildDeallocateTransaction({
    custodyWallet,
    assetMint,
    amount,
    owner,
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
