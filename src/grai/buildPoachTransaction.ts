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
import {
  decodeSolanaReferrerBook,
  previewSolanaPoach,
} from './fetchSolanaReferralBooks'
import { confirmSignatureViaHttp } from './onchain'
import {
  getAssociatedTokenAddress,
  referrerPda,
  TOKEN_PROGRAM_ID,
} from './pdas'
import { createAssociatedTokenAccountIdempotentInstruction } from './splInstructions'

/** Anchor `global:poach` discriminator. */
const POACH_DISCRIMINATOR = Buffer.from([53, 255, 175, 100, 32, 162, 71, 140])

type AccountMeta = {
  pubkey: PublicKey
  isSigner: boolean
  isWritable: boolean
}

async function loadBook(
  connection: Connection,
  locker: PublicKey,
  programId: PublicKey,
) {
  const pda = referrerPda(locker, programId)
  const info = await connection.getAccountInfo(pda)
  if (!info?.data) {
    throw new Error('Locker referral book not found')
  }
  const book = decodeSolanaReferrerBook(Buffer.from(info.data))
  if (!book) throw new Error('Invalid locker referral book')
  return { pda, book }
}

/** Walk sticky upline books for loop detection remaining accounts. */
async function uplineBookMetas(
  connection: Connection,
  start: PublicKey,
  programId: PublicKey,
  exclude: Set<string>,
  maxHops = 16,
): Promise<AccountMeta[]> {
  const metas: AccountMeta[] = []
  let cur = start
  for (let i = 0; i < maxHops; i += 1) {
    const pda = referrerPda(cur, programId)
    const key = pda.toBase58()
    if (!exclude.has(key)) {
      metas.push({ pubkey: pda, isSigner: false, isWritable: false })
      exclude.add(key)
    }
    const info = await connection.getAccountInfo(pda)
    if (!info?.data || !info.owner.equals(programId)) break
    const book = decodeSolanaReferrerBook(Buffer.from(info.data))
    if (!book) break
    if (
      book.referrer.equals(PublicKey.default) ||
      book.referrer.equals(cur)
    ) {
      break
    }
    cur = book.referrer
  }
  return metas
}

export type BuildPoachTransactionParams = {
  poacher: PublicKey
  locker: PublicKey
  connection: Connection
  config: GraiSolanaRuntime
}

export async function buildPoachTransaction({
  poacher,
  locker,
  connection,
  config,
}: BuildPoachTransactionParams): Promise<{
  transaction: Transaction
  price: bigint
  seller: PublicKey
}> {
  const programId = config.programId
  const protocol = await fetchGraiProtocol(connection, config.graiMint)
  if (protocol.liquidation) {
    throw new Error('Poach is disabled while liquidation is open')
  }

  const { pda: lockerReferrer, book } = await loadBook(connection, locker, programId)
  const { price, seller } = previewSolanaPoach(book, poacher)

  const graiState = graiStatePda(programId)
  const buyerBook = referrerPda(poacher, programId)
  const selfOwned = seller.equals(locker)
  // `seller_book` / L2 slots are `#[account(mut)]`. System Program is executable so the
  // runtime demotes it to read-only → Anchor ConstraintMut (2000). Unused slots must be
  // a writable Referrer PDA (same pattern as treasury.t.ts poach helper).
  const sellerBook = selfOwned ? lockerReferrer : referrerPda(seller, programId)

  let oldL2Book = buyerBook
  if (!selfOwned && protocol.affiliateLevels > 1) {
    const sellerInfo = await connection.getAccountInfo(sellerBook)
    if (sellerInfo?.data) {
      const sellerBookData = decodeSolanaReferrerBook(Buffer.from(sellerInfo.data))
      if (
        sellerBookData &&
        !sellerBookData.referrer.equals(PublicKey.default) &&
        !sellerBookData.referrer.equals(seller) &&
        !sellerBookData.referrer.equals(locker)
      ) {
        oldL2Book = referrerPda(sellerBookData.referrer, programId)
      }
    }
  }

  let newL2Book = buyerBook
  if (protocol.affiliateLevels > 1) {
    const buyerInfo = await connection.getAccountInfo(buyerBook)
    if (buyerInfo?.data) {
      const buyerBookData = decodeSolanaReferrerBook(Buffer.from(buyerInfo.data))
      if (
        buyerBookData &&
        !buyerBookData.referrer.equals(PublicKey.default) &&
        !buyerBookData.referrer.equals(poacher) &&
        !buyerBookData.referrer.equals(locker)
      ) {
        newL2Book = referrerPda(buyerBookData.referrer, programId)
      }
    }
  }

  const poacherGraiAta = getAssociatedTokenAddress(config.graiMint, poacher)
  const sellerGraiAta = getAssociatedTokenAddress(config.graiMint, seller)

  const fixedKeys: AccountMeta[] = [
    { pubkey: poacher, isSigner: true, isWritable: true },
    { pubkey: graiState, isSigner: false, isWritable: true },
    { pubkey: locker, isSigner: false, isWritable: false },
    { pubkey: lockerReferrer, isSigner: false, isWritable: true },
    { pubkey: buyerBook, isSigner: false, isWritable: true },
    { pubkey: sellerBook, isSigner: false, isWritable: true },
    { pubkey: oldL2Book, isSigner: false, isWritable: true },
    { pubkey: newL2Book, isSigner: false, isWritable: true },
    { pubkey: config.graiMint, isSigner: false, isWritable: false },
    { pubkey: poacherGraiAta, isSigner: false, isWritable: true },
    { pubkey: sellerGraiAta, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]

  const exclude = new Set(fixedKeys.map((k) => k.pubkey.toBase58()))
  const remaining = await uplineBookMetas(connection, poacher, programId, exclude)

  const poachIx = new TransactionInstruction({
    programId,
    keys: [...fixedKeys, ...remaining],
    data: Buffer.from(POACH_DISCRIMINATOR),
  })

  const instructions: TransactionInstruction[] = [
    createAssociatedTokenAccountIdempotentInstruction(
      poacher,
      poacherGraiAta,
      poacher,
      config.graiMint,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      poacher,
      sellerGraiAta,
      seller,
      config.graiMint,
    ),
    poachIx,
  ]

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  const transaction = new Transaction({
    feePayer: poacher,
    blockhash,
    lastValidBlockHeight,
  })
  transaction.add(...instructions)
  return { transaction, price, seller }
}

export type ExecutePoachParams = {
  poacher: PublicKey
  locker: PublicKey | string
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  connection: Connection
  config: GraiSolanaRuntime
}

export async function executePoach({
  poacher,
  locker,
  signTransaction,
  connection,
  config,
}: ExecutePoachParams): Promise<{ signature: string; price: bigint; seller: PublicKey }> {
  const lockerKey = typeof locker === 'string' ? new PublicKey(locker) : locker
  const { transaction, price, seller } = await buildPoachTransaction({
    poacher,
    locker: lockerKey,
    connection,
    config,
  })
  const signed = await signTransaction(transaction)
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })
  await confirmSignatureViaHttp(connection, signature, 'confirmed')
  return { signature, price, seller }
}
