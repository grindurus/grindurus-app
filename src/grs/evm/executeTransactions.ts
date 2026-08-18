import { getAccount, readContract, waitForTransactionReceipt, writeContract } from '@wagmi/core'
import { erc20Abi, getAddress, maxUint256 } from 'viem'
import { wagmiConfig } from '../../providers/evmConfig'
import { formatTokenBalance, parseTokenAmount } from '../../grai/onchain'
import { GRS_DECIMALS } from '../constants'
import { parseBridgeRecipient, parseSaleAsset, ZERO_BYTES32, evmAddressToBytes32 } from '../bytes32'
import type { GrsEvmConfig } from '../deployments'
import { grsAbi } from './abi'
import { quoteGrsBridge, previewGrsBuy } from './readProtocol'

export type ExecuteGrsBridgeParams = {
  config: GrsEvmConfig
  dstEid: number
  destIsSolana: boolean
  destName?: string
  recipientInput: string
  amountInput: string
  decimals?: number
}

export async function executeGrsBridge({
  config,
  dstEid,
  destIsSolana,
  destName,
  recipientInput,
  amountInput,
  decimals = GRS_DECIMALS,
}: ExecuteGrsBridgeParams): Promise<{ hash: string; amount: bigint; amountLabel: string }> {
  const account = getAccount(wagmiConfig)
  if (!account.address) throw new Error('Connect an EVM wallet to bridge GRS')

  const amount = parseTokenAmount(amountInput, decimals)
  const to = parseBridgeRecipient(recipientInput, destIsSolana, destName)
  const nativeFee = await quoteGrsBridge(config, dstEid, to, amount)
  const value = nativeFee + nativeFee / 10n

  const hash = await writeContract(wagmiConfig, {
    address: config.address,
    abi: grsAbi,
    functionName: 'bridge',
    args: [dstEid, to, amount],
    value,
  })
  await waitForTransactionReceipt(wagmiConfig, { hash })
  return { hash, amount, amountLabel: formatTokenBalance(amount, decimals) }
}

export type ExecuteGrsBuyParams = {
  config: GrsEvmConfig
  saleId: bigint
  amountInput: string
  recipient: string
  nativeQuote: boolean
  quoteAddress: `0x${string}`
  decimals?: number
}

export async function executeGrsBuy({
  config,
  saleId,
  amountInput,
  recipient,
  nativeQuote,
  quoteAddress,
  decimals = GRS_DECIMALS,
}: ExecuteGrsBuyParams): Promise<{ hash: string; amount: bigint; cost: bigint; amountLabel: string }> {
  const account = getAccount(wagmiConfig)
  if (!account.address) throw new Error('Connect an EVM wallet to buy GRS')

  const to = getAddress(recipient)
  const amount = parseTokenAmount(amountInput, decimals)
  const cost = await previewGrsBuy(config, saleId, amount)

  if (!nativeQuote) {
    const allowance = await readContract(wagmiConfig, {
      address: quoteAddress,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [account.address, config.address],
    })
    if (allowance < cost) {
      const approveHash = await writeContract(wagmiConfig, {
        address: quoteAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [config.address, maxUint256],
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: approveHash })
    }
  }

  const hash = await writeContract(wagmiConfig, {
    address: config.address,
    abi: grsAbi,
    functionName: 'buy',
    args: [saleId, amount, to],
    value: nativeQuote ? cost : 0n,
  })
  await waitForTransactionReceipt(wagmiConfig, { hash })
  return { hash, amount, cost, amountLabel: formatTokenBalance(amount, decimals) }
}

export type ExecuteGrsVestParams = {
  config: GrsEvmConfig
  recipient: string
  amountInput: string
  cliffSeconds: number
  durationSeconds: number
  decimals?: number
}

export async function executeGrsVest({
  config,
  recipient,
  amountInput,
  cliffSeconds,
  durationSeconds,
  decimals = GRS_DECIMALS,
}: ExecuteGrsVestParams): Promise<{ hash: string; amount: bigint; amountLabel: string }> {
  const account = getAccount(wagmiConfig)
  if (!account.address) throw new Error('Connect an EVM wallet to vest GRS')

  if (cliffSeconds === 0 && durationSeconds === 0) {
    throw new Error('Set a cliff or a linear duration — instant transfers use a wallet send')
  }

  const amount = parseTokenAmount(amountInput, decimals)
  const hash = await writeContract(wagmiConfig, {
    address: config.address,
    abi: grsAbi,
    functionName: 'vest',
    args: [getAddress(recipient), amount, 0n, BigInt(cliffSeconds), BigInt(durationSeconds)],
    account: account.address,
  })
  await waitForTransactionReceipt(wagmiConfig, { hash })
  return { hash, amount, amountLabel: formatTokenBalance(amount, decimals) }
}

export async function executeGrsRelease(
  config: GrsEvmConfig,
  vestingId: bigint,
): Promise<{ hash: string }> {
  const account = getAccount(wagmiConfig)
  if (!account.address) throw new Error('Connect an EVM wallet to claim vested GRS')

  const hash = await writeContract(wagmiConfig, {
    address: config.address,
    abi: grsAbi,
    functionName: 'release',
    args: [vestingId],
  })
  await waitForTransactionReceipt(wagmiConfig, { hash })
  return { hash }
}

export type ExecuteGrsSaleParams = {
  config: GrsEvmConfig
  assetInput: string
  assetAmountInput: string
  assetDecimals: number
  grsAmountInput: string
  recipientInput: string
  dstEid: number
  decimals?: number
}

export async function executeGrsSale({
  config,
  assetInput,
  assetAmountInput,
  assetDecimals,
  grsAmountInput,
  recipientInput,
  dstEid,
  decimals = GRS_DECIMALS,
}: ExecuteGrsSaleParams): Promise<{ hash: string; amount: bigint; amountLabel: string }> {
  const account = getAccount(wagmiConfig)
  if (!account.address) throw new Error('Connect an EVM wallet to list a GRS sale')

  const grsAmount = parseTokenAmount(grsAmountInput, decimals)
  const assetAmount = parseTokenAmount(assetAmountInput, assetDecimals)
  const asset = parseSaleAsset(assetInput)
  const recipient = recipientInput.trim()
    ? evmAddressToBytes32(recipientInput)
    : ZERO_BYTES32

  let value = 0n
  if (dstEid !== 0) {
    const nativeFee = await readContract(wagmiConfig, {
      address: config.address,
      abi: grsAbi,
      functionName: 'quoteSale',
      args: [asset, assetAmount, grsAmount, recipient, dstEid],
    })
    value = nativeFee + nativeFee / 10n
  }

  const hash = await writeContract(wagmiConfig, {
    address: config.address,
    abi: grsAbi,
    functionName: 'sale',
    args: [asset, assetAmount, grsAmount, recipient, dstEid],
    value,
    account: account.address,
  })
  await waitForTransactionReceipt(wagmiConfig, { hash })
  return { hash, amount: grsAmount, amountLabel: formatTokenBalance(grsAmount, decimals) }
}
