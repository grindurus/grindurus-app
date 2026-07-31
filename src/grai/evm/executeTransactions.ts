import { getAccount, readContract, waitForTransactionReceipt, writeContract } from '@wagmi/core'
import { erc20Abi, maxUint256, parseUnits } from 'viem'
import { wagmiConfig } from '../../providers/evmConfig'
import type { GraiEvmConfig } from '../deployments'
import { formatTokenBalance, parseTokenAmount } from '../onchain'
import { graiAbi } from './abi'
import { resolveGraiContractAddress } from './client'
import { isNativeEvmAsset } from './knownAssets'

export type ExecuteEvmMintParams = {
  config: GraiEvmConfig
  assetAddress: string
  amountInput: string
  assetDecimals: number
  /** Escrow minted GRAI in the same tx (`deposit(..., lock)`). */
  lock?: boolean
}

export async function executeEvmMint({
  config,
  assetAddress,
  amountInput,
  assetDecimals,
  lock = false,
}: ExecuteEvmMintParams): Promise<{ hash: string; amount: bigint }> {
  const account = getAccount(wagmiConfig)
  if (!account.address) {
    throw new Error('Connect an EVM wallet to mint GRAI')
  }

  const graiAddress = resolveGraiContractAddress(config)
  const amount = parseTokenAmount(amountInput, assetDecimals)
  const asset = assetAddress.toLowerCase() as `0x${string}`

  if (!isNativeEvmAsset(asset)) {
    const allowance = await readContract(wagmiConfig, {
      address: asset,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [account.address, graiAddress],
    })

    if (allowance < amount) {
      const approveHash = await writeContract(wagmiConfig, {
        address: asset,
        abi: erc20Abi,
        functionName: 'approve',
        args: [graiAddress, maxUint256],
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: approveHash })
    }
  }

  const hash = await writeContract(wagmiConfig, {
    address: graiAddress,
    abi: graiAbi,
    functionName: 'deposit',
    args: [asset, amount, lock],
    value: isNativeEvmAsset(asset) ? amount : 0n,
  })

  await waitForTransactionReceipt(wagmiConfig, { hash })
  return { hash, amount }
}

export type ExecuteEvmBurnParams = {
  config: GraiEvmConfig
  amountInput: string
  graiDecimals: number
}

export async function executeEvmBurn({
  config,
  amountInput,
  graiDecimals,
}: ExecuteEvmBurnParams): Promise<{ hash: string; amount: bigint; amountLabel: string }> {
  const account = getAccount(wagmiConfig)
  if (!account.address) {
    throw new Error('Connect an EVM wallet to burn GRAI')
  }

  const graiAddress = resolveGraiContractAddress(config)
  const graiAmount = parseTokenAmount(amountInput, graiDecimals)

  const hash = await writeContract(wagmiConfig, {
    address: graiAddress,
    abi: graiAbi,
    functionName: 'burn',
    args: [graiAmount],
  })

  await waitForTransactionReceipt(wagmiConfig, { hash })
  return {
    hash,
    amount: graiAmount,
    amountLabel: formatTokenBalance(graiAmount, graiDecimals),
  }
}

export type ExecuteEvmVoteParams = {
  config: GraiEvmConfig
  amountInput: string
  graiDecimals: number
}

export async function executeEvmVote({
  config,
  amountInput,
  graiDecimals,
}: ExecuteEvmVoteParams): Promise<{ hash: string; amount: bigint }> {
  const account = getAccount(wagmiConfig)
  if (!account.address) {
    throw new Error('Connect an EVM wallet to vote')
  }

  const graiAddress = resolveGraiContractAddress(config)
  const graiAmount = parseTokenAmount(amountInput, graiDecimals)
  if (graiAmount <= 0n) throw new Error('Amount must be greater than zero')

  const hash = await writeContract(wagmiConfig, {
    address: graiAddress,
    abi: graiAbi,
    functionName: 'vote',
    args: [graiAmount],
  })

  await waitForTransactionReceipt(wagmiConfig, { hash })
  return { hash, amount: graiAmount }
}

export type ExecuteEvmBuybackParams = {
  config: GraiEvmConfig
  assetAddress: string
  amountInput: string
  assetDecimals: number
}

export async function executeEvmBuyback({
  config,
  assetAddress,
  amountInput,
  assetDecimals,
}: ExecuteEvmBuybackParams): Promise<{ hash: string; amount: bigint }> {
  const account = getAccount(wagmiConfig)
  if (!account.address) {
    throw new Error('Connect an EVM wallet to buyback')
  }

  const graiAddress = resolveGraiContractAddress(config)
  const amount = parseTokenAmount(amountInput, assetDecimals)
  if (amount <= 0n) throw new Error('Amount must be greater than zero')
  const asset = assetAddress.toLowerCase() as `0x${string}`

  const hash = await writeContract(wagmiConfig, {
    address: graiAddress,
    abi: graiAbi,
    functionName: 'buyback',
    args: [asset, amount],
  })

  await waitForTransactionReceipt(wagmiConfig, { hash })
  return { hash, amount }
}

export type ExecuteEvmBribeParams = {
  config: GraiEvmConfig
  voter: `0x${string}`
  amountInput: string
  graiDecimals: number
}

export async function executeEvmBribe({
  config,
  voter,
  amountInput,
  graiDecimals,
}: ExecuteEvmBribeParams): Promise<{ hash: string; amount: bigint; bribePaid: bigint }> {
  const account = getAccount(wagmiConfig)
  if (!account.address) {
    throw new Error('Connect an EVM wallet to bribe')
  }

  const graiAddress = resolveGraiContractAddress(config)
  const graiAmount = parseTokenAmount(amountInput, graiDecimals)
  if (graiAmount <= 0n) throw new Error('Amount must be greater than zero')

  const [bribePreview, settlementAsset] = await Promise.all([
    readContract(wagmiConfig, {
      address: graiAddress,
      abi: graiAbi,
      functionName: 'previewBribe',
      args: [voter, graiAmount],
    }),
    readContract(wagmiConfig, {
      address: graiAddress,
      abi: graiAbi,
      functionName: 'settlementAsset',
    }),
  ])

  const bribePaid = bribePreview[0]
  if (bribePaid <= 0n) throw new Error('Bribe amount is zero')

  if (!isNativeEvmAsset(settlementAsset)) {
    const allowance = await readContract(wagmiConfig, {
      address: settlementAsset,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [account.address, graiAddress],
    })

    if (allowance < bribePaid) {
      const approveHash = await writeContract(wagmiConfig, {
        address: settlementAsset,
        abi: erc20Abi,
        functionName: 'approve',
        args: [graiAddress, maxUint256],
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: approveHash })
    }
  }

  const hash = await writeContract(wagmiConfig, {
    address: graiAddress,
    abi: graiAbi,
    functionName: 'bribe',
    args: [voter, graiAmount],
    value: isNativeEvmAsset(settlementAsset) ? bribePaid : 0n,
  })

  await waitForTransactionReceipt(wagmiConfig, { hash })
  return { hash, amount: graiAmount, bribePaid }
}

export type ExecuteEvmDistributeParams = {
  config: GraiEvmConfig
  assetAddress: string
  amountInput: string
  assetDecimals: number
}

export async function executeEvmDistribute({
  config,
  assetAddress,
  amountInput,
  assetDecimals,
}: ExecuteEvmDistributeParams): Promise<{ hash: string; amount: bigint }> {
  const account = getAccount(wagmiConfig)
  if (!account.address) {
    throw new Error('Connect an EVM wallet to distribute yield')
  }

  const graiAddress = resolveGraiContractAddress(config)
  const amount = parseTokenAmount(amountInput, assetDecimals)
  if (amount <= 0n) throw new Error('Amount must be greater than zero')
  const asset = assetAddress.toLowerCase() as `0x${string}`

  if (!isNativeEvmAsset(asset)) {
    const allowance = await readContract(wagmiConfig, {
      address: asset,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [account.address, graiAddress],
    })

    if (allowance < amount) {
      const approveHash = await writeContract(wagmiConfig, {
        address: asset,
        abi: erc20Abi,
        functionName: 'approve',
        args: [graiAddress, maxUint256],
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: approveHash })
    }
  }

  const hash = await writeContract(wagmiConfig, {
    address: graiAddress,
    abi: graiAbi,
    functionName: 'distribute',
    args: [asset, amount],
    value: isNativeEvmAsset(asset) ? amount : 0n,
  })

  await waitForTransactionReceipt(wagmiConfig, { hash })
  return { hash, amount }
}

export type ExecuteEvmLockParams = {
  config: GraiEvmConfig
  amountInput: string
  graiDecimals: number
}

export async function executeEvmLock({
  config,
  amountInput,
  graiDecimals,
}: ExecuteEvmLockParams): Promise<{ hash: string; amount: bigint }> {
  const account = getAccount(wagmiConfig)
  if (!account.address) {
    throw new Error('Connect an EVM wallet to lock GRAI')
  }

  const graiAddress = resolveGraiContractAddress(config)
  const graiAmount = parseTokenAmount(amountInput, graiDecimals)
  if (graiAmount <= 0n) throw new Error('Amount must be greater than zero')

  const hash = await writeContract(wagmiConfig, {
    address: graiAddress,
    abi: graiAbi,
    functionName: 'lock',
    args: [graiAmount],
  })

  await waitForTransactionReceipt(wagmiConfig, { hash })
  return { hash, amount: graiAmount }
}

export type ExecuteEvmUnlockParams = {
  config: GraiEvmConfig
  amountInput: string
  graiDecimals: number
}

export async function executeEvmUnlock({
  config,
  amountInput,
  graiDecimals,
}: ExecuteEvmUnlockParams): Promise<{ hash: string; amount: bigint }> {
  const account = getAccount(wagmiConfig)
  if (!account.address) {
    throw new Error('Connect an EVM wallet to unlock GRAI')
  }

  const graiAddress = resolveGraiContractAddress(config)
  const graiAmount = parseTokenAmount(amountInput, graiDecimals)
  if (graiAmount <= 0n) throw new Error('Amount must be greater than zero')

  const hash = await writeContract(wagmiConfig, {
    address: graiAddress,
    abi: graiAbi,
    functionName: 'unlock',
    args: [graiAmount],
  })

  await waitForTransactionReceipt(wagmiConfig, { hash })
  return { hash, amount: graiAmount }
}

export type ExecuteEvmClaimAllParams = {
  config: GraiEvmConfig
  holder?: `0x${string}`
}

export type ExecuteEvmClaimParams = {
  config: GraiEvmConfig
  assetAddress: string
  amountInput: string
  assetDecimals: number
  holder?: `0x${string}`
}

export async function executeEvmClaim({
  config,
  assetAddress,
  amountInput,
  assetDecimals,
  holder,
}: ExecuteEvmClaimParams): Promise<{ hash: string; amount: bigint }> {
  const account = getAccount(wagmiConfig)
  if (!account.address) {
    throw new Error('Connect an EVM wallet to claim dividends')
  }

  const graiAddress = resolveGraiContractAddress(config)
  const claimHolder = holder ?? account.address
  const asset = assetAddress.toLowerCase() as `0x${string}`
  const amount = parseEvmTokenAmount(amountInput, assetDecimals)

  const hash = await writeContract(wagmiConfig, {
    address: graiAddress,
    abi: graiAbi,
    functionName: 'claim',
    args: [claimHolder, asset, amount],
  })

  await waitForTransactionReceipt(wagmiConfig, { hash })
  return { hash, amount }
}

export async function executeEvmClaimAll({
  config,
  holder,
}: ExecuteEvmClaimAllParams): Promise<{ hash: string }> {
  const account = getAccount(wagmiConfig)
  if (!account.address) {
    throw new Error('Connect an EVM wallet to claim dividends')
  }

  const graiAddress = resolveGraiContractAddress(config)
  const claimHolder = holder ?? account.address

  const hash = await writeContract(wagmiConfig, {
    address: graiAddress,
    abi: graiAbi,
    functionName: 'claimAll',
    args: [claimHolder],
  })

  await waitForTransactionReceipt(wagmiConfig, { hash })
  return { hash }
}

export type ExecuteEvmLiquidateParams = {
  config: GraiEvmConfig
}

export async function executeEvmLiquidate({
  config,
}: ExecuteEvmLiquidateParams): Promise<{ hash: string }> {
  const account = getAccount(wagmiConfig)
  if (!account.address) {
    throw new Error('Connect an EVM wallet to liquidate')
  }

  const graiAddress = resolveGraiContractAddress(config)
  const hash = await writeContract(wagmiConfig, {
    address: graiAddress,
    abi: graiAbi,
    functionName: 'liquidate',
  })

  await waitForTransactionReceipt(wagmiConfig, { hash })
  return { hash }
}

/** Parse human-readable amount to wei using viem (for consistency with ERC-20 decimals). */
export function parseEvmTokenAmount(input: string, decimals: number): bigint {
  const trimmed = input.trim()
  if (!trimmed || trimmed === '.') {
    throw new Error('Enter an amount')
  }
  return parseUnits(trimmed, decimals)
}
