import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import type { GraiSolanaConfig } from './deployments'
import { graiStatePda } from './deployments'
import { fetchGraiStateFixedFields } from './graiStateCache'
import { fetchMintDecimals, fetchSeniorVaultPriceFeed, parseTokenAmount } from './onchain'
import {
  custodyAllocationPda,
  getAssociatedTokenAddress,
  seniorVaultAtaPda,
  seniorVaultPda,
  TOKEN_PROGRAM_ID,
} from './pdas'

const DISTRIBUTE_DISCRIMINATOR = Buffer.from([191, 44, 223, 207, 164, 236, 126, 61])

function encodeDistributeInstructionData(yieldAmount: bigint): Buffer {
  const data = Buffer.alloc(16)
  DISTRIBUTE_DISCRIMINATOR.copy(data, 0)
  data.writeBigUInt64LE(yieldAmount, 8)
  return data
}

export type BuildDistributeTransactionParams = {
  custodyWallet: PublicKey
  assetMint: PublicKey
  yieldAmount: bigint
  connection: Connection
  config: GraiSolanaConfig
}

export async function buildDistributeTransaction({
  custodyWallet,
  assetMint,
  yieldAmount,
  connection,
  config,
}: BuildDistributeTransactionParams): Promise<Transaction> {
  if (yieldAmount <= 0n) {
    throw new Error('Yield amount must be greater than zero')
  }

  const programId = config.programId
  const graiState = graiStatePda(programId)
  const seniorVault = seniorVaultPda(assetMint, programId)
  const seniorVaultAta = seniorVaultAtaPda(assetMint, programId)
  const custodyAta = getAssociatedTokenAddress(assetMint, custodyWallet)
  const custodyAllocation = custodyAllocationPda(custodyWallet, assetMint, programId)
  const priceFeed = await fetchSeniorVaultPriceFeed(connection, seniorVault)
  const { treasuryWallet } = await fetchGraiStateFixedFields(connection, config)
  const treasuryAta = getAssociatedTokenAddress(assetMint, treasuryWallet)

  const distributeIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: custodyWallet, isSigner: true, isWritable: false },
      { pubkey: graiState, isSigner: false, isWritable: true },
      { pubkey: assetMint, isSigner: false, isWritable: false },
      { pubkey: priceFeed, isSigner: false, isWritable: false },
      { pubkey: seniorVault, isSigner: false, isWritable: true },
      { pubkey: custodyAllocation, isSigner: false, isWritable: true },
      { pubkey: custodyAta, isSigner: false, isWritable: true },
      { pubkey: seniorVaultAta, isSigner: false, isWritable: true },
      { pubkey: treasuryAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: encodeDistributeInstructionData(yieldAmount),
  })

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  const transaction = new Transaction({
    feePayer: custodyWallet,
    blockhash,
    lastValidBlockHeight,
  })
  transaction.add(distributeIx)

  return transaction
}

export type ExecuteDistributeParams = {
  custodyWallet: PublicKey
  assetMint: PublicKey
  amountInput: string
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  connection: Connection
  config: GraiSolanaConfig
}

export async function executeDistribute({
  custodyWallet,
  assetMint,
  amountInput,
  signTransaction,
  connection,
  config,
}: ExecuteDistributeParams): Promise<{ signature: string; amount: bigint }> {
  const decimals = await fetchMintDecimals(connection, assetMint)
  const yieldAmount = parseTokenAmount(amountInput, decimals)
  const transaction = await buildDistributeTransaction({
    custodyWallet,
    assetMint,
    yieldAmount,
    connection,
    config,
  })
  const signed = await signTransaction(transaction)
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })
  await connection.confirmTransaction(signature, 'confirmed')
  return { signature, amount: yieldAmount }
}
