/**
 * Client-side port of on-chain `GrinderArt` (Grinders.sol) — 24×24 pixel NFT mark.
 * Seed drives palette; mask matches the deployed contract.
 */

const MASK_HEX =
  '00000000001800000000006800aaa40001a802aa900006ac02aaaa901aa002aaa5aa1a8001aa5ea6aa800005562e95aa000957959a000025555680000815555bae00285775560820285d755608a09c7d7f54aab08c75555000008c76956000008c36954000004336a50000000375a500000000d5a96aaa8000356a6aa800000d6a5aa00000005a950000000000a00000'

const BG_HEX = '0000000a06121a0a221408280e10200c1830184020201850'
const BODY_HEX = '1c24441a20381e28501c2a48142238101830141c40182038'
const HI_HEX = 'fffffff0f4fff5e6c8e8f0ffe0e8f0fff8e0f0fff0fff0e8'
const ACC_HEX = 'ff2d8cff4d8dff1a6eff6ab0ff3d00ffd4002dff9a00e5ff'
const HORN_HEX =
  'f5e6c8ffd700e8dcc8c0c0c8ffb6c1b87333fff8ffff2a4ad4af37e6c35cff8c42a8e6cff0e68ce0b0ff98d8c8ffe4c4'

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

const MASK = hexToBytes(MASK_HEX)
const BG = hexToBytes(BG_HEX)
const BODY = hexToBytes(BODY_HEX)
const HI = hexToBytes(HI_HEX)
const ACC = hexToBytes(ACC_HEX)
const HORN = hexToBytes(HORN_HEX)

function rgbAt(palette: Uint8Array, index: number): number {
  const i = index * 3
  return (palette[i]! << 16) | (palette[i + 1]! << 8) | palette[i + 2]!
}

function hexColor(rgb: number): string {
  return `#${rgb.toString(16).padStart(6, '0')}`
}

function rect(x: number, y: number, w: number, h: number, color: number): string {
  return `<rect x='${x}' y='${y}' width='${w}' height='${h}' fill='${hexColor(color)}'/>`
}

/** FNV-1a 32-bit — enough variety for landing seeds (not on-chain keccak). */
export function grinderArtSeed(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function grinderArtSvg(seed: number): string {
  const bg = rgbAt(BG, (seed >>> 4) % 8)
  const body = rgbAt(BODY, (seed >>> 8) % 8)
  const hi = rgbAt(HI, (seed >>> 12) % 8)
  const acc = rgbAt(ACC, (seed >>> 16) % 8)
  const horn = rgbAt(HORN, (seed >>> 20) % 16)

  let out = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' shape-rendering='crispEdges'>${rect(0, 0, 24, 24, bg)}`
  let bit = 0

  for (let y = 0; y < 24; y++) {
    let x = 0
    while (x < 24) {
      const byteIndex = bit >> 2
      const shift = 6 - ((bit & 3) << 1)
      const c = (MASK[byteIndex]! >> shift) & 3
      bit++
      if (c === 0) {
        x++
        continue
      }
      const x0 = x
      x++
      while (x < 24) {
        const bi2 = bit >> 2
        const sh2 = 6 - ((bit & 3) << 1)
        const c2 = (MASK[bi2]! >> sh2) & 3
        if (c2 !== c) break
        bit++
        x++
      }
      const color = c === 1 ? body : c === 3 ? acc : y <= 5 ? horn : hi
      out += rect(x0, y, x - x0, 1, color)
    }
  }

  return `${out}</svg>`
}

const uriCache = new Map<number, string>()

export function grinderNftDataUri(seed: number): string {
  const key = seed >>> 0
  const cached = uriCache.get(key)
  if (cached) return cached
  const uri = `data:image/svg+xml;utf8,${encodeURIComponent(grinderArtSvg(key))}`
  uriCache.set(key, uri)
  return uri
}

export function grinderNftForPair(base: string, quote: string, salt = 0): string {
  return grinderNftDataUri(grinderArtSeed(`grindurus.grinder:${base}/${quote}:${salt}`))
}
