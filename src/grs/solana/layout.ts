import { PublicKey } from '@solana/web3.js'

const GRS_CONFIG_DISC = Buffer.from('9419ae70f62a48b7', 'hex')
const SALE_REGISTRY_DISC = Buffer.from('528f10f49c4d3c30', 'hex')
const SALE_ACCOUNT_DISC = Buffer.from('d51257e4dae6cfb6', 'hex')
const PEER_REGISTRY_DISC = Buffer.from('de7952a64196a3f0', 'hex')
const VESTING_DISC = Buffer.from('6495428a5fc880f1', 'hex')
const OFT_STORE_DISC = Buffer.from('c3d76886b9c3f072', 'hex')

function requireDisc(data: Buffer, expected: Buffer, label: string): void {
  if (data.length < 8 || !data.subarray(0, 8).equals(expected)) {
    throw new Error(`Invalid ${label} account`)
  }
}

function readPubkey(data: Buffer, offset: number): PublicKey {
  return new PublicKey(data.subarray(offset, offset + 32))
}

function readU64(data: Buffer, offset: number): bigint {
  return data.readBigUInt64LE(offset)
}

function readU32(data: Buffer, offset: number): number {
  return data.readUInt32LE(offset)
}

export type DecodedGrsConfig = {
  home: boolean
  genesisMinted: boolean
  bump: number
  vestingCount: bigint
  tokenSalesSpent: bigint
}

export function decodeGrsConfig(data: Buffer): DecodedGrsConfig {
  requireDisc(data, GRS_CONFIG_DISC, 'GrsConfig')
  let o = 8
  const home = data[o++] === 1
  const genesisMinted = data[o++] === 1
  const bump = data[o++]
  const vestingCount = readU64(data, o)
  o += 8
  const tokenSalesSpent = readU64(data, o)
  return { home, genesisMinted, bump, vestingCount, tokenSalesSpent }
}

export type DecodedSale = {
  asset: PublicKey
  assetAmount: bigint
  grsAmount: bigint
  recipient: PublicKey
}

export function decodeSaleRegistry(data: Buffer): { oftStore: PublicKey; bump: number; saleCount: bigint } {
  requireDisc(data, SALE_REGISTRY_DISC, 'SaleRegistry')
  let o = 8
  const oftStore = readPubkey(data, o)
  o += 32
  const bump = data[o++]
  const saleCount = readU64(data, o)
  return { oftStore, bump, saleCount }
}

export function decodeSaleAccount(data: Buffer): DecodedSale & { id: bigint; oftStore: PublicKey; bump: number } {
  requireDisc(data, SALE_ACCOUNT_DISC, 'SaleAccount')
  let o = 8
  const id = readU64(data, o)
  o += 8
  const oftStore = readPubkey(data, o)
  o += 32
  const asset = readPubkey(data, o)
  o += 32
  const assetAmount = readU64(data, o)
  o += 8
  const grsAmount = readU64(data, o)
  o += 8
  const recipient = readPubkey(data, o)
  o += 32
  const bump = data[o]
  return { id, oftStore, asset, assetAmount, grsAmount, recipient, bump }
}

export type DecodedPeer = { eid: number; peer: Uint8Array }

export function decodePeerRegistry(data: Buffer): { oftStore: PublicKey; bump: number; entries: DecodedPeer[] } {
  requireDisc(data, PEER_REGISTRY_DISC, 'PeerRegistry')
  let o = 8
  const oftStore = readPubkey(data, o)
  o += 32
  const bump = data[o++]
  const len = readU32(data, o)
  o += 4
  const entries: DecodedPeer[] = []
  for (let i = 0; i < len; i++) {
    const eid = readU32(data, o)
    o += 4
    const peer = new Uint8Array(data.subarray(o, o + 32))
    o += 32
    entries.push({ eid, peer })
  }
  return { oftStore, bump, entries }
}

export type DecodedVesting = {
  id: bigint
  oftStore: PublicKey
  funder: PublicKey
  beneficiary: PublicKey
  allocation: bigint
  released: bigint
  start: number
  cliffEnd: number
  end: number
  bump: number
}

export function decodeVesting(data: Buffer): DecodedVesting {
  requireDisc(data, VESTING_DISC, 'Vesting')
  let o = 8
  const id = readU64(data, o)
  o += 8
  const oftStore = readPubkey(data, o)
  o += 32
  const funder = readPubkey(data, o)
  o += 32
  const beneficiary = readPubkey(data, o)
  o += 32
  const allocation = readU64(data, o)
  o += 8
  const released = readU64(data, o)
  o += 8
  const start = Number(readU64(data, o))
  o += 8
  const cliffEnd = Number(readU64(data, o))
  o += 8
  const end = Number(readU64(data, o))
  o += 8
  const bump = data[o]
  return { id, oftStore, funder, beneficiary, allocation, released, start, cliffEnd, end, bump }
}

export function vestedAt(allocation: bigint, cliffEnd: number, end: number, timestamp: number): bigint {
  if (timestamp < cliffEnd) return 0n
  if (end <= cliffEnd || timestamp >= end) return allocation
  return (allocation * BigInt(timestamp - cliffEnd)) / BigInt(end - cliffEnd)
}

export type DecodedOftStore = {
  tokenMint: PublicKey
  tokenEscrow: PublicKey
  admin: PublicKey
  endpointProgram: PublicKey
  ld2sdRate: bigint
  paused: boolean
}

/** Minimal OFTStore decode — fields needed for buy/vest/bridge builders. */
export function decodeOftStore(data: Buffer): DecodedOftStore {
  requireDisc(data, OFT_STORE_DISC, 'OFTStore')
  let o = 8
  o += 1 // oft_type enum
  const ld2sdRate = readU64(data, o)
  o += 8
  const tokenMint = readPubkey(data, o)
  o += 32
  const tokenEscrow = readPubkey(data, o)
  o += 32
  const endpointProgram = readPubkey(data, o)
  o += 32
  o += 1 // bump
  o += 8 // tvl_ld
  const admin = readPubkey(data, o)
  o += 32
  o += 32 // pending_owner
  o += 2 // default_fee_bps
  const paused = data[o] === 1
  return { tokenMint, tokenEscrow, admin, endpointProgram, ld2sdRate, paused }
}

export function quoteSaleCost(amountLd: bigint, remainingLd: bigint, assetAmount: bigint): bigint {
  if (assetAmount <= 0n || remainingLd <= 0n || amountLd <= 0n) throw new Error('Sale closed')
  if (amountLd > remainingLd) throw new Error('Exceeds remaining GRS')
  if (amountLd === remainingLd) return assetAmount
  const cost = (amountLd * assetAmount) / remainingLd
  if (cost <= 0n) throw new Error('Cost rounds to zero')
  return cost
}
