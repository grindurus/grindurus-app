/**
 * Browser AIFP-1 payment helper for backtest create.
 * Quote → settleNative (Polygon) → /v1/pay → AIFP-Receipt JWT.
 */
import {
  encodeFunctionData,
  type Hex,
  type WalletClient,
  type Account,
  type Chain,
  type Transport,
} from 'viem'
import { polygon } from 'viem/chains'

const AIFP_API = 'https://api.aifinpay.io'
const POLYGON_CHAIN_ID = 137

const SETTLE_NATIVE_ABI = [
  {
    type: 'function',
    name: 'settleNative',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'quote',
        type: 'tuple',
        components: [
          { name: 'payer', type: 'address' },
          { name: 'merchant', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'grossAmount', type: 'uint256' },
          { name: 'ipCreator', type: 'address' },
          { name: 'validUntil', type: 'uint256' },
          { name: 'orderIdHash', type: 'bytes32' },
          { name: 'nonce', type: 'uint256' },
          { name: 'routeId', type: 'bytes32' },
        ],
      },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
] as const

export type AifpQuote = {
  quote_id: string
  merchant_id: string
  resource: string
  tier?: string
  amount?: string
  currency?: string
  network_mode?: string
  nonce?: string | number
  settlement_call?: {
    chain?: string
    contract?: string
    asset?: string
    value_wei?: string
    function?: string
    args?: {
      quote?: {
        payer?: string
        merchant?: string
        token?: string
        grossAmount?: string
        ipCreator?: string
        validUntil?: string
        orderIdHash?: string
        nonce?: string
        routeId?: string
      }
      signature?: string
    }
  }
  native_settlement?: { asset?: string }
}

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input)
  // Copy into a fresh ArrayBuffer so BufferSource matches TS DOM typings.
  const bytes = new Uint8Array(encoded.byteLength)
  bytes.set(encoded)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function buildIdempotencyKey(
  quoteId: string,
  asset: string,
  chain: string,
  txRef: string
): Promise<string> {
  const digest = await sha256Hex(`aifp1|${quoteId}|${asset}|${chain}|${txRef}`)
  return `aifp1-${digest}`
}

function paymentAuthorizationMessage(args: {
  quote: AifpQuote
  apiBase: string
  chain: string
  txRef: string
  asset: string
  idempotencyKey: string
  payer: string
  expiresAt: number
}): string {
  const nonce =
    args.quote.nonce ??
    args.quote.settlement_call?.args?.quote?.nonce ??
    ''
  return JSON.stringify([
    'AiFinPay receipt authorization v1',
    args.apiBase,
    args.quote.quote_id,
    nonce,
    args.quote.merchant_id,
    args.quote.network_mode || 'live',
    args.chain,
    args.txRef,
    args.asset || '',
    args.idempotencyKey,
    args.payer,
    args.expiresAt,
  ])
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export async function fetchAifpQuote(args: {
  merchantId: string
  resource: string
  tier: string
  payer: string
  apiBase?: string
}): Promise<AifpQuote> {
  const apiBase = (args.apiBase || AIFP_API).replace(/\/+$/, '')
  const res = await fetch(`${apiBase}/v1/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      merchant_id: args.merchantId,
      resource: args.resource,
      tier: args.tier,
      payer: args.payer,
    }),
  })
  const data = await readJson(res)
  if (!res.ok) {
    const detail =
      data && typeof data === 'object' && 'detail' in data
        ? String((data as { detail?: unknown }).detail)
        : `HTTP ${res.status}`
    throw new Error(`AiFinPay quote failed: ${detail}`)
  }
  if (!data || typeof data !== 'object' || !('quote_id' in data)) {
    throw new Error('AiFinPay quote returned an unexpected payload')
  }
  return data as AifpQuote
}

export async function settleAifpNative(args: {
  walletClient: WalletClient<Transport, Chain, Account>
  quote: AifpQuote
}): Promise<{ txHash: Hex; asset: string }> {
  const call = args.quote.settlement_call
  const q = call?.args?.quote
  const signature = call?.args?.signature
  const contract = call?.contract
  const valueWei = call?.value_wei
  if (!call || !q || !signature || !contract || !valueWei) {
    throw new Error('AiFinPay quote is missing settlement_call for native POL')
  }
  if ((call.function || '').startsWith('settleNative') === false) {
    throw new Error(`Unsupported AiFinPay settlement function: ${call.function || 'unknown'}`)
  }

  const data = encodeFunctionData({
    abi: SETTLE_NATIVE_ABI,
    functionName: 'settleNative',
    args: [
      {
        payer: q.payer as `0x${string}`,
        merchant: q.merchant as `0x${string}`,
        token: (q.token || '0x0000000000000000000000000000000000000000') as `0x${string}`,
        grossAmount: BigInt(q.grossAmount || valueWei),
        ipCreator: (q.ipCreator || '0x0000000000000000000000000000000000000000') as `0x${string}`,
        validUntil: BigInt(q.validUntil || 0),
        orderIdHash: q.orderIdHash as Hex,
        nonce: BigInt(q.nonce || 0),
        routeId: q.routeId as Hex,
      },
      signature as Hex,
    ],
  })

  const txHash = await args.walletClient.sendTransaction({
    account: args.walletClient.account,
    chain: polygon,
    to: contract as `0x${string}`,
    data,
    value: BigInt(valueWei),
  })
  return {
    txHash,
    asset: call.asset || args.quote.native_settlement?.asset || 'POL',
  }
}

export async function claimAifpReceipt(args: {
  quote: AifpQuote
  txRef: string
  asset: string
  payer: string
  walletClient: WalletClient<Transport, Chain, Account>
  apiBase?: string
  maxWaitMs?: number
}): Promise<string> {
  const apiBase = (args.apiBase || AIFP_API).replace(/\/+$/, '')
  const chain = 'polygon'
  const idempotencyKey = await buildIdempotencyKey(
    args.quote.quote_id,
    args.asset,
    chain,
    args.txRef
  )
  const deadline = Date.now() + (args.maxWaitMs ?? 90_000)
  let lastDetail = ''

  while (Date.now() < deadline) {
    const expiresAt = Math.floor(Date.now() / 1000) + 240
    const payer = args.payer.toLowerCase()
    const message = paymentAuthorizationMessage({
      quote: args.quote,
      apiBase,
      chain,
      txRef: args.txRef,
      asset: args.asset,
      idempotencyKey,
      payer,
      expiresAt,
    })
    const signature = await args.walletClient.signMessage({
      account: args.walletClient.account,
      message,
    })

    const res = await fetch(`${apiBase}/v1/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Idempotency-Key': idempotencyKey,
        'AIFP-Agent-Id': payer,
      },
      body: JSON.stringify({
        quote_id: args.quote.quote_id,
        chain,
        asset: args.asset,
        tx_ref: args.txRef,
        agent_id: payer,
        payment_authorization: { payer, expires_at: expiresAt, signature },
      }),
    })
    const data = await readJson(res)
    if (res.ok) {
      const receipt =
        typeof data === 'string'
          ? data
          : data && typeof data === 'object'
            ? String(
                (data as { receipt?: unknown; token?: unknown }).receipt ??
                  (data as { token?: unknown }).token ??
                  ''
              )
            : ''
      if (!receipt) {
        // Some deployments return the JWT as `receipt` nested or top-level string field.
        if (data && typeof data === 'object') {
          for (const v of Object.values(data as Record<string, unknown>)) {
            if (typeof v === 'string' && v.split('.').length === 3) return v
          }
        }
        throw new Error('AiFinPay /v1/pay returned no receipt')
      }
      return receipt
    }

    const detail =
      data && typeof data === 'object' && 'detail' in data
        ? String((data as { detail?: unknown }).detail)
        : `HTTP ${res.status}`
    lastDetail = detail
    // Settlement not yet indexed — retry with same Idempotency-Key.
    if (res.status === 425 || /not yet confirmed|retry/i.test(detail)) {
      await new Promise((r) => setTimeout(r, 2000))
      continue
    }
    throw new Error(`AiFinPay /v1/pay failed: ${detail}`)
  }
  throw new Error(
    lastDetail
      ? `AiFinPay receipt timeout: ${lastDetail}`
      : 'AiFinPay receipt confirmation timed out'
  )
}

export async function purchaseAifpReceiptForCreate(args: {
  walletClient: WalletClient<Transport, Chain, Account>
  chainId: number
  switchChainAsync: (input: { chainId: number }) => Promise<unknown>
  merchantId: string
  resource?: string
  tier?: string
  apiBase?: string
}): Promise<{ receipt: string; quote: AifpQuote; txHash: Hex }> {
  const payer = args.walletClient.account.address
  if (!payer) throw new Error('Connect an EVM wallet to pay with AiFinPay.')

  if (args.chainId !== POLYGON_CHAIN_ID) {
    await args.switchChainAsync({ chainId: POLYGON_CHAIN_ID })
  }

  const quote = await fetchAifpQuote({
    merchantId: args.merchantId,
    resource: args.resource || '/create',
    tier: args.tier || 'premium',
    payer,
    apiBase: args.apiBase,
  })

  const { txHash, asset } = await settleAifpNative({
    walletClient: args.walletClient,
    quote,
  })

  const receipt = await claimAifpReceipt({
    quote,
    txRef: txHash,
    asset,
    payer,
    walletClient: args.walletClient,
    apiBase: args.apiBase,
  })

  return { receipt, quote, txHash }
}

export { POLYGON_CHAIN_ID, AIFP_API }
