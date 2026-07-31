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
import { fetchAssetConfigPriceFeed, fetchMintDecimals, parseTokenAmount, confirmSignatureViaHttp } from './onchain'
import {
  resolveSolanaAllocateCustodyAccounts,
  resolveSolanaGrindersProgramId,
} from './solanaAllocateCustody'
import {
  assetConfigPda,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  vaultAtaPda,
  positionPda,
} from './pdas'

/** grinders::custodian_distribute discriminator */
const CUSTODIAN_DISTRIBUTE_DISCRIMINATOR = Buffer.from([181, 75, 97, 68, 255, 95, 111, 21])

function encodeDistributeInstructionData(yieldAmount: bigint): Buffer {
  const data = Buffer.alloc(16)
  CUSTODIAN_DISTRIBUTE_DISCRIMINATOR.copy(data, 0)
  data.writeBigUInt64LE(yieldAmount, 8)
  return data
}

export type BuildDistributeTransactionParams = {
  custodyWallet: PublicKey
  assetMint: PublicKey
  yieldAmount: bigint
  /** Signs as grinders custodian NFT owner; defaults to custodyWallet when omitted. */
  owner?: PublicKey
  /** Pays for Position init; defaults to owner. */
  payer?: PublicKey
  connection: Connection
  config: GraiSolanaRuntime
}

export async function buildDistributeTransaction({
  custodyWallet,
  assetMint,
  yieldAmount,
  owner,
  payer,
  connection,
  config,
}: BuildDistributeTransactionParams): Promise<Transaction> {
  if (yieldAmount <= 0n) {
    throw new Error('Yield amount must be greater than zero')
  }

  const programId = config.programId
  const graiState = graiStatePda(programId)
  const grindersProgram = resolveSolanaGrindersProgramId(config.cluster)
  const { custodianRecord } = await resolveSolanaAllocateCustodyAccounts(
    connection,
    custodyWallet,
    grindersProgram,
  )

  const protocol = await fetchGraiProtocol(connection, config.graiMint)
  const settlementMint = protocol.settlementAsset
  if (settlementMint.equals(PublicKey.default)) {
    throw new Error('Settlement asset is not set on GRAI protocol')
  }

  const assetConfig = assetConfigPda(assetMint, programId)
  const settlementAssetConfig = assetConfigPda(settlementMint, programId)
  const priceFeed = await fetchAssetConfigPriceFeed(connection, assetConfig)
  const settlementPriceFeed = await fetchAssetConfigPriceFeed(connection, settlementAssetConfig)
  const custodyAta = getAssociatedTokenAddress(assetMint, custodyWallet)
  const vaultAta = vaultAtaPda(assetMint, programId)
  const treasuryAta = getAssociatedTokenAddress(assetMint, protocol.treasury)
  const position = positionPda(custodyWallet, assetMint, programId)

  const signer = owner ?? custodyWallet
  const feePayer = payer ?? signer

  const distributeIx = new TransactionInstruction({
    programId: grindersProgram,
    keys: [
      { pubkey: signer, isSigner: true, isWritable: false },
      { pubkey: feePayer, isSigner: true, isWritable: true },
      { pubkey: custodyWallet, isSigner: false, isWritable: false },
      { pubkey: custodianRecord, isSigner: false, isWritable: false },
      { pubkey: programId, isSigner: false, isWritable: false },
      { pubkey: graiState, isSigner: false, isWritable: true },
      { pubkey: assetMint, isSigner: false, isWritable: false },
      { pubkey: assetConfig, isSigner: false, isWritable: true },
      { pubkey: priceFeed, isSigner: false, isWritable: false },
      { pubkey: settlementMint, isSigner: false, isWritable: false },
      { pubkey: settlementAssetConfig, isSigner: false, isWritable: false },
      { pubkey: settlementPriceFeed, isSigner: false, isWritable: false },
      { pubkey: custodyAta, isSigner: false, isWritable: true },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: treasuryAta, isSigner: false, isWritable: true },
      { pubkey: position, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: encodeDistributeInstructionData(yieldAmount),
  })

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  const transaction = new Transaction({
    feePayer,
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
  owner?: PublicKey
  payer?: PublicKey
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  connection: Connection
  config: GraiSolanaRuntime
}

export async function executeDistribute({
  custodyWallet,
  assetMint,
  amountInput,
  owner,
  payer,
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
    owner,
    payer,
    connection,
    config,
  })
  const signed = await signTransaction(transaction)
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })
  await confirmSignatureViaHttp(connection, signature, 'confirmed')
  return { signature, amount: yieldAmount }
}
