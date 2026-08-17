import { fetchWithTimeout } from '../utils/fetchWithTimeout'
import { stripTrailingSlash } from '../utils/urlUtils'

export const DEFAULT_GRAI_METADATA_URL = 'https://grindurus.xyz/grai.json'

export type GraiTokenMetadata = {
  name?: string
  symbol?: string
  description?: string
  image?: string
  external_url?: string
  app?: string
  properties?: {
    bosses?: string[]
    docs?: string
    category?: string
    social?: {
      twitter?: string
      github?: string
    }
  }
}

function readMetadataUrl(): string {
  const configured = import.meta.env.VITE_GRAI_METADATA_URL?.trim()
  return configured || DEFAULT_GRAI_METADATA_URL
}

function normalizeBossUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return stripTrailingSlash(url.toString())
  } catch {
    return null
  }
}

export function parseGraiBossUrls(metadata: GraiTokenMetadata): string[] {
  const bosses = metadata.properties?.bosses ?? []
  const seen = new Set<string>()
  const urls: string[] = []

  for (const entry of bosses) {
    const url = normalizeBossUrl(entry)
    if (!url || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
  }

  return urls
}

export async function fetchGraiTokenMetadata(signal?: AbortSignal): Promise<GraiTokenMetadata> {
  const response = await fetchWithTimeout(
    readMetadataUrl(),
    {
      signal,
      headers: { Accept: 'application/json' },
    },
    5_000,
  )

  if (!response.ok) {
    throw new Error(`GRAI metadata HTTP ${response.status}`)
  }

  const data = (await response.json()) as GraiTokenMetadata
  if (!data || typeof data !== 'object') {
    throw new Error('GRAI metadata response is not an object')
  }

  return data
}

export async function fetchGraiBossUrls(signal?: AbortSignal): Promise<string[]> {
  const metadata = await fetchGraiTokenMetadata(signal)
  return parseGraiBossUrls(metadata)
}
