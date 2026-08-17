/** Public Solana RPC rate-limits HTTP POSTs; a JSON-RPC array is one POST. */
const DEFAULT_WAIT_MS = 32
const DEFAULT_MAX_BATCH = 20
const GET_MULTIPLE_ACCOUNTS_LIMIT = 100
const ACCOUNT_TTL_MS = 5_000

type JsonRpcMessage = {
  jsonrpc?: string
  id?: number | string | null
  method?: string
  params?: unknown
}

type QueuedCall = {
  url: string
  init: RequestInit
  payload: JsonRpcMessage
  fingerprint: string
  resolve: (response: Response) => void
  reject: (error: unknown) => void
}

type RpcBody = { result: unknown } | { error: unknown }

type AccountRead = {
  kind: 'one' | 'many'
  pubkeys: string[]
  extra: unknown
}

type CachedAccount = {
  expires: number
  value: unknown
  context: unknown
}

const SOLO_METHODS = new Set(['sendTransaction', 'simulateTransaction', 'requestAirdrop'])

const READ_TTL_MS: Record<string, number> = {
  getAccountInfo: ACCOUNT_TTL_MS,
  getMultipleAccounts: ACCOUNT_TTL_MS,
  getBalance: ACCOUNT_TTL_MS,
  getTokenAccountBalance: ACCOUNT_TTL_MS,
  getTokenLargestAccounts: ACCOUNT_TTL_MS,
  getParsedAccountInfo: ACCOUNT_TTL_MS,
  getParsedTokenAccountsByOwner: ACCOUNT_TTL_MS,
  getLatestBlockhash: 400,
  getRecentBlockhash: 400,
  getSlot: 2_000,
  getBlockHeight: 2_000,
  getEpochInfo: 4_000,
  getHealth: 30_000,
  getVersion: 60_000,
  getGenesisHash: 300_000,
  getMinimumBalanceForRentExemption: 60_000,
}

const mutationListeners = new Set<() => void>()

export function onJsonRpcMutation(listener: () => void): () => void {
  mutationListeners.add(listener)
  return () => {
    mutationListeners.delete(listener)
  }
}

function parseJsonRpcBody(body: unknown): JsonRpcMessage | null {
  if (typeof body !== 'string') return null
  try {
    const parsed: unknown = JSON.parse(body)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const message = parsed as JsonRpcMessage
    if (message.jsonrpc !== '2.0' || typeof message.method !== 'string') return null
    return message
  } catch {
    return null
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function fingerprint(method: string, params: unknown): string {
  return `${method}:${JSON.stringify(params ?? null)}`
}

function wrapOutcome(id: JsonRpcMessage['id'], outcome: RpcBody) {
  return { jsonrpc: '2.0', id: id ?? null, ...outcome }
}

function outcomeFromRpcItem(item: unknown): RpcBody {
  if (item && typeof item === 'object') {
    if ('error' in item) return { error: (item as { error: unknown }).error }
    if ('result' in item) return { result: (item as { result: unknown }).result }
  }
  return { error: { code: -32603, message: 'Malformed RPC response' } }
}

function extraConfigKey(extra: unknown): string | null {
  if (extra == null) return '|'
  if (typeof extra !== 'object' || Array.isArray(extra)) return null
  if ('dataSlice' in extra) return null
  const cfg = extra as { encoding?: unknown; commitment?: unknown; minContextSlot?: unknown }
  return `${cfg.commitment ?? ''}|${cfg.encoding ?? ''}|${cfg.minContextSlot ?? ''}`
}

function parseAccountRead(payload: JsonRpcMessage): AccountRead | null {
  if (!Array.isArray(payload.params)) return null
  if (payload.method === 'getAccountInfo' && typeof payload.params[0] === 'string') {
    if (payload.params[1] != null && extraConfigKey(payload.params[1]) === null) return null
    return { kind: 'one', pubkeys: [payload.params[0]], extra: payload.params[1] }
  }
  if (payload.method === 'getMultipleAccounts' && Array.isArray(payload.params[0])) {
    const pubkeys = payload.params[0]
    if (pubkeys.some((key) => typeof key !== 'string')) return null
    if (payload.params[1] != null && extraConfigKey(payload.params[1]) === null) return null
    return { kind: 'many', pubkeys: pubkeys as string[], extra: payload.params[1] }
  }
  return null
}

function stitchAccountResult(
  read: AccountRead,
  context: unknown,
  values: Map<string, unknown>,
): { context: unknown; value: unknown } {
  if (read.kind === 'one') {
    return { context, value: values.get(read.pubkeys[0]!) ?? null }
  }
  return { context, value: read.pubkeys.map((key) => values.get(key) ?? null) }
}

/**
 * Identical method+params share one in-flight RPC. Concurrent getAccountInfo /
 * getMultipleAccounts with the same encoding collapse to one union getMultipleAccounts.
 */
export function createJsonRpcBatchFetch(
  underlying: typeof fetch = fetch.bind(globalThis),
  options?: { waitMs?: number; maxBatch?: number },
): typeof fetch {
  const waitMs = options?.waitMs ?? DEFAULT_WAIT_MS
  const maxBatch = options?.maxBatch ?? DEFAULT_MAX_BATCH
  const queues = new Map<string, QueuedCall[]>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const batchable = new Map<string, boolean>()
  const inflight = new Map<string, QueuedCall[]>()
  const ttlCache = new Map<string, { expires: number; outcome: RpcBody }>()
  const accountTtl = new Map<string, CachedAccount>()

  const requestUrl = (input: RequestInfo | URL): string => {
    if (typeof input === 'string') return input
    if (input instanceof URL) return input.toString()
    return input.url
  }

  const cacheKey = (url: string, fp: string) => `${url}\n${fp}`
  const accountKey = (url: string, cfg: string, pubkey: string) => `${url}\n${cfg}\n${pubkey}`

  const readCache = (url: string, fp: string): RpcBody | null => {
    const hit = ttlCache.get(cacheKey(url, fp))
    if (!hit) return null
    if (hit.expires <= Date.now()) {
      ttlCache.delete(cacheKey(url, fp))
      return null
    }
    return hit.outcome
  }

  const writeCache = (url: string, method: string, fp: string, outcome: RpcBody) => {
    const ttl = READ_TTL_MS[method]
    if (!ttl || !('result' in outcome)) return
    ttlCache.set(cacheKey(url, fp), { expires: Date.now() + ttl, outcome })
  }

  const rememberAccounts = (
    url: string,
    cfg: string,
    pubkeys: string[],
    values: unknown[],
    context: unknown,
  ) => {
    const expires = Date.now() + ACCOUNT_TTL_MS
    pubkeys.forEach((pubkey, index) => {
      accountTtl.set(accountKey(url, cfg, pubkey), {
        expires,
        value: values[index] ?? null,
        context,
      })
    })
  }

  const tryStitchFromAccountCache = (
    url: string,
    read: AccountRead,
  ): { context: unknown; value: unknown } | null => {
    const cfg = extraConfigKey(read.extra)
    if (cfg == null) return null
    const now = Date.now()
    const values = new Map<string, unknown>()
    let context: unknown = null
    for (const pubkey of read.pubkeys) {
      const hit = accountTtl.get(accountKey(url, cfg, pubkey))
      if (!hit || hit.expires <= now) return null
      values.set(pubkey, hit.value)
      context = hit.context
    }
    return stitchAccountResult(read, context, values)
  }

  const invalidateReads = () => {
    ttlCache.clear()
    accountTtl.clear()
    for (const listener of mutationListeners) listener()
  }

  const resolveGroup = (url: string, fp: string, outcome: RpcBody) => {
    const group = inflight.get(cacheKey(url, fp)) ?? []
    inflight.delete(cacheKey(url, fp))
    const method = group[0]?.payload.method
    if (method) writeCache(url, method, fp, outcome)
    for (const call of group) {
      call.resolve(jsonResponse(wrapOutcome(call.payload.id, outcome)))
    }
  }

  const rejectGroup = (url: string, fp: string, error: unknown) => {
    const group = inflight.get(cacheKey(url, fp)) ?? []
    inflight.delete(cacheKey(url, fp))
    for (const call of group) call.reject(error)
  }

  const loadAccounts = async (
    url: string,
    pubkeys: string[],
    extra: unknown,
  ): Promise<{ context: unknown; values: Map<string, unknown> } | { error: unknown }> => {
    const cfg = extraConfigKey(extra) ?? '|'
    const values = new Map<string, unknown>()
    let context: unknown = { slot: 0 }
    const missing: string[] = []
    const now = Date.now()
    for (const pubkey of pubkeys) {
      const hit = accountTtl.get(accountKey(url, cfg, pubkey))
      if (hit && hit.expires > now) {
        values.set(pubkey, hit.value)
        context = hit.context
      } else {
        missing.push(pubkey)
      }
    }

    for (let offset = 0; offset < missing.length; offset += GET_MULTIPLE_ACCOUNTS_LIMIT) {
      const chunk = missing.slice(offset, offset + GET_MULTIPLE_ACCOUNTS_LIMIT)
      const payload: JsonRpcMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'getMultipleAccounts',
        params: extra == null ? [chunk] : [chunk, extra],
      }
      const response = await underlying(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const item = await response.json()
      const outcome = outcomeFromRpcItem(item)
      if ('error' in outcome) return outcome
      const result = outcome.result as { context?: unknown; value?: unknown[] }
      context = result.context ?? context
      const fetched = Array.isArray(result.value) ? result.value : []
      rememberAccounts(url, cfg, chunk, fetched, context)
      chunk.forEach((pubkey, index) => {
        values.set(pubkey, fetched[index] ?? null)
      })
    }

    return { context, values }
  }

  const flushAccountReads = async (url: string, calls: QueuedCall[]) => {
    const buckets = new Map<string, { extra: unknown; calls: QueuedCall[]; pubkeys: string[] }>()
    for (const call of calls) {
      const read = parseAccountRead(call.payload)
      if (!read) continue
      const cfg = extraConfigKey(read.extra) ?? '|'
      const bucket = buckets.get(cfg) ?? { extra: read.extra, calls: [], pubkeys: [] }
      bucket.calls.push(call)
      const seen = new Set(bucket.pubkeys)
      for (const pubkey of read.pubkeys) {
        if (!seen.has(pubkey)) {
          seen.add(pubkey)
          bucket.pubkeys.push(pubkey)
        }
      }
      buckets.set(cfg, bucket)
    }

    await Promise.all(
      [...buckets.values()].map(async (bucket) => {
        try {
          const loaded = await loadAccounts(url, bucket.pubkeys, bucket.extra)
          if ('error' in loaded) {
            for (const call of bucket.calls) {
              resolveGroup(url, call.fingerprint, { error: loaded.error })
            }
            return
          }
          for (const call of bucket.calls) {
            const read = parseAccountRead(call.payload)
            if (!read) continue
            resolveGroup(url, call.fingerprint, {
              result: stitchAccountResult(read, loaded.context, loaded.values),
            })
          }
        } catch (error) {
          for (const call of bucket.calls) rejectGroup(url, call.fingerprint, error)
        }
      }),
    )
  }

  const postOne = async (url: string, call: QueuedCall) => {
    const response = await underlying(url, call.init)
    const item = await response.json()
    const outcome = outcomeFromRpcItem(item)
    const read = parseAccountRead(call.payload)
    const cfg = read ? extraConfigKey(read.extra) : null
    if (read && cfg != null && 'result' in outcome && outcome.result && typeof outcome.result === 'object') {
      const result = outcome.result as { context?: unknown; value?: unknown }
      if (read.kind === 'one') {
        rememberAccounts(url, cfg, read.pubkeys, [result.value ?? null], result.context ?? null)
      } else if (Array.isArray(result.value)) {
        rememberAccounts(url, cfg, read.pubkeys, result.value, result.context ?? null)
      }
    }
    resolveGroup(url, call.fingerprint, outcome)
  }

  const flushOthers = async (url: string, unique: QueuedCall[]) => {
    if (unique.length === 0) return
    if (unique.length === 1 || batchable.get(url) === false) {
      await Promise.all(
        unique.map(async (call) => {
          try {
            await postOne(url, call)
          } catch (error) {
            rejectGroup(url, call.fingerprint, error)
          }
        }),
      )
      return
    }

    const headers = new Headers(unique[0]?.init.headers)
    headers.set('Content-Type', 'application/json')
    headers.delete('content-length')

    try {
      const response = await underlying(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(unique.map((call) => call.payload)),
      })
      const raw = await response.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        parsed = null
      }

      if (!response.ok || !Array.isArray(parsed) || parsed.length !== unique.length) {
        if (!Array.isArray(parsed)) batchable.set(url, false)
        await Promise.all(
          unique.map(async (call) => {
            try {
              await postOne(url, call)
            } catch (error) {
              rejectGroup(url, call.fingerprint, error)
            }
          }),
        )
        return
      }

      const byId = new Map<string, unknown>()
      for (const item of parsed) {
        if (item && typeof item === 'object' && 'id' in item) {
          byId.set(String((item as { id: unknown }).id), item)
        }
      }

      unique.forEach((call, index) => {
        const item =
          call.payload.id === undefined || call.payload.id === null
            ? parsed[index]
            : (byId.get(String(call.payload.id)) ?? parsed[index])
        resolveGroup(url, call.fingerprint, outcomeFromRpcItem(item))
      })
    } catch (error) {
      for (const call of unique) rejectGroup(url, call.fingerprint, error)
    }
  }

  const flush = async (url: string) => {
    const timer = timers.get(url)
    if (timer !== undefined) {
      clearTimeout(timer)
      timers.delete(url)
    }
    const queued = queues.get(url) ?? []
    queues.set(url, [])
    if (queued.length === 0) return

    const unique = queued.filter(
      (call, index) => queued.findIndex((other) => other.fingerprint === call.fingerprint) === index,
    )
    const accountCalls = unique.filter((call) => parseAccountRead(call.payload))
    const otherCalls = unique.filter((call) => !parseAccountRead(call.payload))

    await Promise.all([flushAccountReads(url, accountCalls), flushOthers(url, otherCalls)])
  }

  const enqueue = (call: QueuedCall) => {
    const waiting = queues.get(call.url) ?? []
    waiting.push(call)
    queues.set(call.url, waiting)

    if (waiting.length >= maxBatch) {
      void flush(call.url)
      return
    }
    if (!timers.has(call.url)) {
      timers.set(
        call.url,
        setTimeout(() => {
          void flush(call.url)
        }, waitMs),
      )
    }
  }

  return (input, init) => {
    const url = requestUrl(input)
    const payload = parseJsonRpcBody(init?.body)
    if (!init || (init.method && init.method.toUpperCase() !== 'POST') || !payload) {
      return underlying(input, init)
    }
    if (payload.method && SOLO_METHODS.has(payload.method)) {
      invalidateReads()
      return underlying(input, init)
    }

    const fp = fingerprint(payload.method!, payload.params)
    const cached = readCache(url, fp)
    if (cached) {
      return Promise.resolve(jsonResponse(wrapOutcome(payload.id, cached)))
    }

    const accountRead = parseAccountRead(payload)
    if (accountRead) {
      const stitched = tryStitchFromAccountCache(url, accountRead)
      if (stitched) {
        return Promise.resolve(jsonResponse(wrapOutcome(payload.id, { result: stitched })))
      }
    }

    return new Promise<Response>((resolve, reject) => {
      if (init.signal?.aborted) {
        reject(init.signal.reason ?? new DOMException('Aborted', 'AbortError'))
        return
      }

      const key = cacheKey(url, fp)
      const existing = inflight.get(key)
      const call: QueuedCall = { url, init, payload, fingerprint: fp, resolve, reject }
      if (existing) {
        existing.push(call)
        return
      }
      inflight.set(key, [call])
      enqueue(call)
    })
  }
}

let sharedFetch: typeof fetch | null = null

/** Shared so wallet Connection and GRAI Connection coalesce against the same /solana-devnet-rpc. */
export function getSharedJsonRpcBatchFetch(): typeof fetch {
  if (!sharedFetch) sharedFetch = createJsonRpcBatchFetch()
  return sharedFetch
}
