import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js'
import { SendHelper } from '@layerzerolabs/lz-solana-sdk-v2'
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '../../grai/pdas'
import { formatTokenBalance, parseTokenAmount, confirmSignatureViaHttp } from '../../grai/onchain'
import type { GrsSolanaConfig } from '../deployments'
import { decodeOftStore } from './layout'
import { peerConfigPda, resolveGrsSolanaPdas } from './pdas'
import { GRS_SOLANA_DECIMALS } from './readProtocol'

const IX = {
  bridge: Buffer.from('ae29789262daa919', 'hex'),
  quoteBridge: Buffer.from('d07d7db93d85dd6b', 'hex'),
} as const

const LZ_ENDPOINT = new PublicKey('76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6')
/** Shared-decimals dust (`GRS_LD2SD_RATE` on-chain). */
const GRS_LD2SD_RATE = 1000n

function u32le(value: number): Buffer {
  const buf = Buffer.alloc(4)
  buf.writeUInt32LE(value)
  return buf
}

function u64le(value: bigint | number): Buffer {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64LE(BigInt(value))
  return buf
}

function borshBytes(data: Uint8Array): Buffer {
  return Buffer.concat([u32le(data.length), Buffer.from(data)])
}

function borshOptionBytes(data: Uint8Array | null): Buffer {
  if (!data) return Buffer.from([0])
  return Buffer.concat([Buffer.from([1]), borshBytes(data)])
}

/**
 * `QuoteSend` / `Send` accounts use `#[instruction(params: QuoteSendParams|SendParams)]`,
 * so ix data must be the full Borsh struct even though `quote_bridge` / `bridge` handlers
 * only declare the flat fields (Anchor re-parses params for PDA seeds).
 */
function encodeQuoteBridgeArgs(dstEid: number, to: Uint8Array, amountLd: bigint): Buffer {
  if (to.length !== 32) throw new Error('Bridge recipient must be 32 bytes')
  const minAmountLd = amountLd - (amountLd % GRS_LD2SD_RATE)
  return Buffer.concat([
    u32le(dstEid),
    Buffer.from(to),
    u64le(amountLd),
    u64le(minAmountLd),
    borshBytes(new Uint8Array(0)), // options
    borshOptionBytes(null), // compose_msg
    Buffer.from([0]), // pay_in_lz_token
  ])
}

function encodeBridgeArgs(
  dstEid: number,
  to: Uint8Array,
  amountLd: bigint,
  nativeFee: bigint,
): Buffer {
  if (to.length !== 32) throw new Error('Bridge recipient must be 32 bytes')
  const minAmountLd = amountLd - (amountLd % GRS_LD2SD_RATE)
  return Buffer.concat([
    u32le(dstEid),
    Buffer.from(to),
    u64le(amountLd),
    u64le(minAmountLd),
    borshBytes(new Uint8Array(0)), // options
    borshOptionBytes(null), // compose_msg
    u64le(nativeFee),
    u64le(0), // lz_token_fee
  ])
}

function meta(pubkey: PublicKey, isSigner = false, isWritable = false) {
  return { pubkey, isSigner, isWritable }
}

function eventAuthority(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('__event_authority')], programId)[0]
}

function peerReceiverHex(peerBytes: Uint8Array): string {
  return `0x${Buffer.from(peerBytes).toString('hex')}`
}

async function loadPeerAddress(
  connection: Connection,
  oftStore: PublicKey,
  dstEid: number,
  programId: PublicKey,
): Promise<Uint8Array> {
  const peer = peerConfigPda(oftStore, dstEid, programId)
  const info = await connection.getAccountInfo(peer)
  if (!info?.data || info.data.length < 8 + 32) {
    throw new Error(`No Solana peer config for eid ${dstEid} — run setPeer / wire`)
  }
  return new Uint8Array(info.data.subarray(8, 40))
}

async function endpointRemaining(
  connection: Connection,
  payer: PublicKey,
  oftStore: PublicKey,
  dstEid: number,
  peerBytes: Uint8Array,
  mode: 'quote' | 'send',
) {
  const helper = new SendHelper(LZ_ENDPOINT)
  const receiver = peerReceiverHex(peerBytes)
  // SDK nests its own @solana/web3.js; cast to avoid duplicate-type Connection mismatch.
  const conn = connection as never
  if (mode === 'quote') {
    return helper.getQuoteAccounts(conn, payer, oftStore, dstEid, receiver)
  }
  return helper.getSendAccounts(conn, payer, oftStore, dstEid, receiver)
}

export async function quoteSolanaGrsBridge(params: {
  connection: Connection
  config: GrsSolanaConfig
  payer: PublicKey
  dstEid: number
  to: Uint8Array
  amountLd: bigint
}): Promise<bigint> {
  const pdas = resolveGrsSolanaPdas(params.config)
  const peerBytes = await loadPeerAddress(
    params.connection,
    pdas.oftStore,
    params.dstEid,
    params.config.programId,
  )
  const remaining = await endpointRemaining(
    params.connection,
    params.payer,
    pdas.oftStore,
    params.dstEid,
    peerBytes,
    'quote',
  )

  const data = Buffer.concat([
    IX.quoteBridge,
    encodeQuoteBridgeArgs(params.dstEid, params.to, params.amountLd),
  ])

  const keys = [
    meta(pdas.oftStore),
    meta(peerConfigPda(pdas.oftStore, params.dstEid, params.config.programId)),
    meta(params.config.mint),
    ...remaining.map((a) => meta(a.pubkey, a.isSigner, a.isWritable)),
  ]

  const ix = new TransactionInstruction({
    programId: params.config.programId,
    keys,
    data,
  })
  const { blockhash } = await params.connection.getLatestBlockhash()
  const msg = new TransactionMessage({
    payerKey: params.payer,
    recentBlockhash: blockhash,
    instructions: [ix],
  }).compileToV0Message()
  const sim = await params.connection.simulateTransaction(new VersionedTransaction(msg), {
    sigVerify: false,
    replaceRecentBlockhash: true,
  })
  if (sim.value.err) {
    const logs = (sim.value.logs ?? []).slice(-8).join('\n')
    throw new Error(logs || `quote_bridge simulation failed: ${JSON.stringify(sim.value.err)}`)
  }
  const raw = sim.value.returnData?.data?.[0]
  if (!raw) throw new Error('quote_bridge returned no fee data')
  const buf = Buffer.from(raw, 'base64')
  if (buf.length < 8) throw new Error('Invalid quote_bridge return data')
  return buf.readBigUInt64LE(0)
}

export async function executeSolanaGrsBridge(params: {
  connection: Connection
  config: GrsSolanaConfig
  publicKey: PublicKey
  signTransaction: (transaction: Transaction) => Promise<Transaction>
  dstEid: number
  to: Uint8Array
  amountInput: string
  decimals?: number
}): Promise<{ signature: string; amount: bigint; amountLabel: string }> {
  const decimals = params.decimals ?? GRS_SOLANA_DECIMALS
  const amount = parseTokenAmount(params.amountInput, decimals)
  if (amount <= 0n) throw new Error('Enter an amount')

  const pdas = resolveGrsSolanaPdas(params.config)
  const oftInfo = await params.connection.getAccountInfo(pdas.oftStore)
  if (!oftInfo?.data) throw new Error('OFT store missing')
  const oft = decodeOftStore(Buffer.from(oftInfo.data))

  const peerBytes = await loadPeerAddress(
    params.connection,
    pdas.oftStore,
    params.dstEid,
    params.config.programId,
  )
  const remaining = await endpointRemaining(
    params.connection,
    params.publicKey,
    pdas.oftStore,
    params.dstEid,
    peerBytes,
    'send',
  )

  let nativeFee = await quoteSolanaGrsBridge({
    connection: params.connection,
    config: params.config,
    payer: params.publicKey,
    dstEid: params.dstEid,
    to: params.to,
    amountLd: amount,
  })
  nativeFee = nativeFee + nativeFee / 10n

  const tokenSource = getAssociatedTokenAddress(params.config.mint, params.publicKey)
  const peer = peerConfigPda(pdas.oftStore, params.dstEid, params.config.programId)

  const data = Buffer.concat([
    IX.bridge,
    encodeBridgeArgs(params.dstEid, params.to, amount, nativeFee),
  ])

  const keys = [
    meta(params.publicKey, true, true),
    meta(peer, false, true),
    meta(pdas.oftStore, false, true),
    meta(tokenSource, false, true),
    meta(oft.tokenEscrow, false, true),
    meta(params.config.mint, false, true),
    meta(TOKEN_PROGRAM_ID),
    meta(eventAuthority(params.config.programId)),
    meta(params.config.programId),
    ...remaining.map((a) => meta(a.pubkey, a.isSigner, a.isWritable)),
  ]

  const tx = new Transaction().add(
    new TransactionInstruction({
      programId: params.config.programId,
      keys,
      data,
    }),
  )
  tx.feePayer = params.publicKey
  tx.recentBlockhash = (await params.connection.getLatestBlockhash()).blockhash
  // Fund LZ native fee from the signer (endpoint withdraws from remaining[1] signer seed —
  // payer must hold enough SOL; fee is passed as native_fee param).
  const signed = await params.signTransaction(tx)
  const signature = await params.connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
    maxRetries: 3,
  })
  // HTTP poll — WS confirm hangs on the Vite Solana RPC proxy after the tx is already live.
  await confirmSignatureViaHttp(params.connection, signature, 'confirmed')

  return {
    signature,
    amount,
    amountLabel: formatTokenBalance(amount, decimals),
  }
}
