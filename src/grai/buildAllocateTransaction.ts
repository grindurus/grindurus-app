import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import type { GraiSolanaRuntime } from './deployments'
import { fetchMintDecimals, parseTokenAmount } from './onchain'
import {
  assertSolanaCustodianWallet,
  resolveSolanaGrindersProgramId,
} from './solanaAllocateCustody'
import {
  getAssociatedTokenAddress,
  grindersStatePda,
  TOKEN_PROGRAM_ID,
} from './pdas'
import { createAssociatedTokenAccountIdempotentInstruction } from './splInstructions'
import type { SolanaSendTransaction } from '../solana/sendWalletTransaction'
import { signAndSendGraiTx } from './signAndSendGraiTx'

/** grinders::allocate discriminator */
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
  config: GraiSolanaRuntime
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

  const grindersProgram = resolveSolanaGrindersProgramId(config.cluster)
  const grindersState = grindersStatePda(grindersProgram)
  const grindersAta = getAssociatedTokenAddress(assetMint, grindersState)
  const custodyAta = getAssociatedTokenAddress(assetMint, custodyWallet)
  await assertSolanaCustodianWallet(connection, custodyWallet, grindersProgram)

  const instructions: TransactionInstruction[] = [
    createAssociatedTokenAccountIdempotentInstruction(
      authority,
      custodyAta,
      custodyWallet,
      assetMint,
    ),
    new TransactionInstruction({
      programId: grindersProgram,
      keys: [
        { pubkey: authority, isSigner: true, isWritable: false },
        { pubkey: grindersState, isSigner: false, isWritable: false },
        { pubkey: custodyWallet, isSigner: false, isWritable: false },
        { pubkey: assetMint, isSigner: false, isWritable: false },
        { pubkey: grindersAta, isSigner: false, isWritable: true },
        { pubkey: custodyAta, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: encodeAllocateInstructionData(amount),
    }),
  ]

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  const transaction = new Transaction({
    feePayer: authority,
    blockhash,
    lastValidBlockHeight,
  })
  transaction.add(...instructions)

  return transaction
}

export type ExecuteAllocateParams = {
  authority: PublicKey
  assetMint: PublicKey
  custodyWallet: PublicKey
  amountInput: string
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  sendTransaction?: SolanaSendTransaction | null
  connection: Connection
  config: GraiSolanaRuntime
}

export async function executeAllocate({
  authority,
  assetMint,
  custodyWallet,
  amountInput,
  signTransaction,
  sendTransaction,
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
  const signature = await signAndSendGraiTx({
    connection,
    transaction,
    feePayer: authority,
    cluster: config.cluster,
    action: 'allocate',
    signTransaction,
    sendTransaction,
  })
  return { signature, amount }
}
