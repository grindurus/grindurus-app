import { AccountInfo, PublicKey } from '@solana/web3.js'

export const CHAINLINK_STORE_PROGRAM_ID = new PublicKey(
  'HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny',
)

export const PYTH_RECEIVER_PROGRAM_ID = new PublicKey(
  'rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ',
)

export const PYTH_RECEIVER_PROGRAM_ID_UPGRADED = new PublicKey(
  'rec2HHDDnjLfj4kE7VyEtFA1HPGQLK33259532cRyHp',
)

export const CUSTOM_PRICE_FEED_PROGRAM_ID = new PublicKey(
  'BKNrLd3u7VpuGCfLYUvUyrfKNApt9nXEFtfozdsHSUc1',
)

const CHAINLINK_TRANSMISSIONS_DISCRIMINATOR = Buffer.from([96, 179, 69, 66, 128, 129, 73, 117])
const CHAINLINK_HEADER_SIZE = 192
const MAX_ORACLE_STALENESS_SECS = 3_600

export type ParsedOraclePrice = {
  price: bigint
  decimals: number
}

function readInt128LE(buf: Buffer, offset: number): bigint {
  const slice = buf.subarray(offset, offset + 16)
  let value = 0n
  for (let i = 15; i >= 0; i -= 1) {
    value = (value << 8n) | BigInt(slice[i]!)
  }
  if (slice[15]! & 0x80) {
    value -= 1n << 128n
  }
  return value
}

function parseChainlinkTransmissionsFeed(account: AccountInfo<Buffer>): ParsedOraclePrice {
  if (!account.owner.equals(CHAINLINK_STORE_PROGRAM_ID)) {
    throw new Error('Unexpected Chainlink feed owner')
  }

  const data = account.data
  if (data.length < 8 + CHAINLINK_HEADER_SIZE + 48) {
    throw new Error('Chainlink account too small')
  }
  if (!data.subarray(0, 8).equals(CHAINLINK_TRANSMISSIONS_DISCRIMINATOR)) {
    throw new Error('Invalid Chainlink discriminator')
  }

  const decimals = data[138]!
  const latestRoundId = data.readUInt32LE(143)
  if (latestRoundId === 0) {
    throw new Error('Chainlink feed has no rounds')
  }

  const transmissionOffset = 8 + CHAINLINK_HEADER_SIZE
  const timestamp = data.readUInt32LE(transmissionOffset + 8)
  const answer = readInt128LE(data, transmissionOffset + 16)
  if (answer <= 0n) {
    throw new Error('Chainlink price must be positive')
  }

  const age = Math.floor(Date.now() / 1000) - timestamp
  if (age > MAX_ORACLE_STALENESS_SECS) {
    throw new Error('Chainlink price is stale')
  }

  return { price: answer, decimals }
}

function parsePythPushFeed(account: AccountInfo<Buffer>): ParsedOraclePrice {
  const owner = account.owner
  if (!owner.equals(PYTH_RECEIVER_PROGRAM_ID) && !owner.equals(PYTH_RECEIVER_PROGRAM_ID_UPGRADED)) {
    throw new Error('Unexpected Pyth feed owner')
  }

  const data = account.data
  if (data.length <= 8 + 32 + 1 + 32 + 16) {
    throw new Error('Pyth account too small')
  }

  let offset = 8
  offset += 32

  const verificationTag = data[offset]!
  offset += 1
  if (verificationTag !== 1) {
    throw new Error('Expected Pyth Full verification')
  }

  offset += 32
  const price = data.readBigInt64LE(offset)
  offset += 8
  offset += 8
  const exponent = data.readInt32LE(offset)
  offset += 4
  const publishTime = Number(data.readBigInt64LE(offset))

  if (price <= 0n) {
    throw new Error('Pyth price must be positive')
  }
  if (exponent > 0) {
    throw new Error('Unexpected positive Pyth exponent')
  }

  const age = Math.floor(Date.now() / 1000) - publishTime
  if (age > MAX_ORACLE_STALENESS_SECS) {
    throw new Error('Pyth price is stale')
  }

  return { price, decimals: -exponent }
}

function parseCustomPriceFeed(account: AccountInfo<Buffer>): ParsedOraclePrice {
  if (!account.owner.equals(CUSTOM_PRICE_FEED_PROGRAM_ID)) {
    throw new Error('Unexpected custom feed owner')
  }

  const data = account.data
  if (data.length < 8 + 32 + 16 + 1 + 8 + 8) {
    throw new Error('Custom price feed account too small')
  }

  let offset = 8
  offset += 32
  offset += 32
  offset += 32
  const price = readInt128LE(data, offset)
  offset += 16
  const decimals = data[offset]!
  offset += 1
  const updatedAt = Number(data.readBigInt64LE(offset))

  if (price <= 0n) {
    throw new Error('Custom feed price must be positive')
  }

  const age = Math.floor(Date.now() / 1000) - updatedAt
  if (age > MAX_ORACLE_STALENESS_SECS) {
    throw new Error('Custom feed price is stale')
  }

  return { price, decimals }
}

export function parseOraclePriceFeed(account: AccountInfo<Buffer>): ParsedOraclePrice {
  if (account.owner.equals(CUSTOM_PRICE_FEED_PROGRAM_ID)) {
    return parseCustomPriceFeed(account)
  }
  if (
    account.owner.equals(PYTH_RECEIVER_PROGRAM_ID) ||
    account.owner.equals(PYTH_RECEIVER_PROGRAM_ID_UPGRADED)
  ) {
    return parsePythPushFeed(account)
  }
  if (account.owner.equals(CHAINLINK_STORE_PROGRAM_ID)) {
    return parseChainlinkTransmissionsFeed(account)
  }

  throw new Error(`Unsupported price feed owner: ${account.owner.toBase58()}`)
}
