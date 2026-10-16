import {
  getAccount,
  getBytecode,
  getCapabilities,
  readContract,
  sendCalls,
  waitForCallsStatus,
  waitForTransactionReceipt,
  writeContract,
} from '@wagmi/core'
import { erc20Abi, maxUint256, parseUnits, type Abi } from 'viem'
import { wagmiConfig } from '../../wallets/evmConfig'
import type { GraiEvmConfig } from '../deployments'
import { formatTokenBalance, parseTokenAmount } from '../onchain'
import { graiAbi, grindersAbi } from './abi'
import { resolveGraiContractAddress } from './client'
import { isNativeEvmAsset } from './knownAssets'
import { resolveEvmBribePaymentAsset } from './readProtocol'

type WagmiChainId = (typeof wagmiConfig)['chains'][number]['id']

/** EIP-5792 atomic batching and/or EIP-7702 delegated EOA (MetaMask smart account). */
async function walletCanBatchCalls(address: `0x${string}`, chainId: number): Promise<boolean> {
  try {
    const caps = await getCapabilities(wagmiConfig, { account: address, chainId })
    const chainCaps =
      caps && typeof caps === 'object' && 'atomic' in caps
        ? (caps as { atomic?: { status?: string } })
        : ((caps as Record<string | number, { atomic?: { status?: string } }>)[chainId] ??
          (caps as Record<string, { atomic?: { status?: string } }>)[
            `0x${chainId.toString(16)}`
          ])
    const status = chainCaps?.atomic?.status
    if (status === 'supported' || status === 'ready') return true
  } catch {
    /* wallet_getCapabilities unavailable */
  }

  try {
    const code = await getBytecode(wagmiConfig, { address })
    // EIP-7702 designation: 0xef0100 ‖ address
    if (code && code.toLowerCase().startsWith('0xef0100')) return true
  } catch {
    /* ignore */
  }
  return false
}

type Erc20ActionCall = {
  to: `0x${string}`
  abi: Abi
  functionName: string
  args: readonly unknown[]
  value?: bigint
}

/**
 * If ERC-20 allowance is missing, prefer one EIP-5792 batch (approve + action).
 * Falls back to sequential approve then action when the wallet cannot batch.
 */
async function writeWithErc20Approve(params: {
  owner: `0x${string}`
  chainId: WagmiChainId
  token: `0x${string}`
  spender: `0x${string}`
  required: bigint
  approveAmount?: bigint
  action: Erc20ActionCall
  batchLabel: string
}): Promise<`0x${string}`> {
  const {
    owner,
    chainId,
    token,
    spender,
    required,
    approveAmount = maxUint256,
    action,
    batchLabel,
  } = params

  const allowance = await readContract(wagmiConfig, {
    address: token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, spender],
  })

  if (allowance < required) {
    const canBatch = await walletCanBatchCalls(owner, chainId)
    if (canBatch) {
      try {
        const { id } = await sendCalls(wagmiConfig, {
          account: owner,
          chainId,
          forceAtomic: true,
          calls: [
            {
              to: token,
              abi: erc20Abi,
              functionName: 'approve',
              args: [spender, approveAmount],
            },
            {
              to: action.to,
              abi: action.abi,
              functionName: action.functionName,
              args: action.args,
              value: action.value,
            },
          ],
        })
        const status = await waitForCallsStatus(wagmiConfig, { id })
        if (status.status !== 'success') {
          throw new Error(`Batched ${batchLabel} failed (${status.status})`)
        }
        const receipts = status.receipts ?? []
        const hash = receipts[receipts.length - 1]?.transactionHash ?? receipts[0]?.transactionHash
        if (!hash) throw new Error(`Batched ${batchLabel} succeeded but returned no receipt hash`)
        return hash
      } catch (batchError) {
        console.warn(`[GRAI] atomic ${batchLabel} failed; falling back to sequential`, batchError)
      }
    }

    const approveHash = await writeContract(wagmiConfig, {
      address: token,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, approveAmount],
    })
    await waitForTransactionReceipt(wagmiConfig, { hash: approveHash })
  }

  const hash = await writeContract(wagmiConfig, {
    address: action.to,
    abi: action.abi,
    functionName: action.functionName,
    args: action.args,
    value: action.value,
  })
  await waitForTransactionReceipt(wagmiConfig, { hash })
  return hash
}

export type ExecuteEvmMintParams = {
  config: GraiEvmConfig
  assetAddress: string
  amountInput: string
  assetDecimals: number
  /** Escrow minted GRAI in the same tx (`deposit(..., lock)`). */
  lock?: boolean
  /** Sticky affiliate; omit for self-bind / zero address. */
  referrer?: string
}

export async function executeEvmMint({
  config,
  assetAddress,
  amountInput,
  assetDecimals,
  lock = false,
  referrer,
}: ExecuteEvmMintParams): Promise<{ hash: string; amount: bigint }> {
  const account = getAccount(wagmiConfig)
  if (!account.address) {
    throw new Error('Connect an EVM wallet to mint GRAI')
  }

  const graiAddress = resolveGraiContractAddress(config)
  const amount = parseTokenAmount(amountInput, assetDecimals)
  const asset = assetAddress.toLowerCase() as `0x${string}`
  const stickyReferrer = (referrer?.trim() || '0x0000000000000000000000000000000000000000') as `0x${string}`
  const chainId = (account.chainId ?? config.chainId) as WagmiChainId
  const action: Erc20ActionCall = {
    to: graiAddress,
    abi: graiAbi,
    functionName: 'deposit',
    args: [asset, amount, lock, stickyReferrer],
    value: isNativeEvmAsset(asset) ? amount : 0n,
  }

  if (isNativeEvmAsset(asset)) {
    const hash = await writeContract(wagmiConfig, {
      address: action.to,
      abi: action.abi,
      functionName: action.functionName,
      args: action.args,
      value: action.value,
    })
    await waitForTransactionReceipt(wagmiConfig, { hash })
    return { hash, amount }
  }

  const hash = await writeWithErc20Approve({
    owner: account.address,
    chainId,
    token: asset,
    spender: graiAddress,
    required: amount,
    approveAmount: amount,
    action,
    batchLabel: 'approve + deposit',
  })
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

export type ExecuteEvmBribeParams = {
  config: GraiEvmConfig
  voter: `0x${string}`
  amountInput: string
  graiDecimals: number
  /** Bribeable payment asset; defaults to first bribeable listed asset. */
  asset?: `0x${string}`
}

export async function executeEvmBribe({
  config,
  voter,
  amountInput,
  graiDecimals,
  asset: assetOverride,
}: ExecuteEvmBribeParams): Promise<{ hash: string; amount: bigint; bribePaid: bigint }> {
  const account = getAccount(wagmiConfig)
  if (!account.address) {
    throw new Error('Connect an EVM wallet to bribe')
  }

  const graiAddress = resolveGraiContractAddress(config)
  const graiAmount = parseTokenAmount(amountInput, graiDecimals)
  if (graiAmount <= 0n) throw new Error('Amount must be greater than zero')

  const paymentAsset = assetOverride ?? (await resolveEvmBribePaymentAsset(config))
  if (!paymentAsset || paymentAsset === '0x0000000000000000000000000000000000000000') {
    throw new Error('No bribeable asset configured on GRAI')
  }

  const bribePreview = await readContract(wagmiConfig, {
    address: graiAddress,
    abi: graiAbi,
    functionName: 'previewBribe',
    args: [paymentAsset, voter, graiAmount],
  })

  const bribePaid = bribePreview[0]
  if (bribePaid <= 0n) throw new Error('Bribe amount is zero')

  const chainId = (account.chainId ?? config.chainId) as WagmiChainId
  const action: Erc20ActionCall = {
    to: graiAddress,
    abi: graiAbi,
    functionName: 'bribe',
    args: [paymentAsset, voter, graiAmount],
    value: isNativeEvmAsset(paymentAsset) ? bribePaid : 0n,
  }

  if (isNativeEvmAsset(paymentAsset)) {
    const hash = await writeContract(wagmiConfig, {
      address: action.to,
      abi: action.abi,
      functionName: action.functionName,
      args: action.args,
      value: action.value,
    })
    await waitForTransactionReceipt(wagmiConfig, { hash })
    return { hash, amount: graiAmount, bribePaid }
  }

  const hash = await writeWithErc20Approve({
    owner: account.address,
    chainId,
    token: paymentAsset,
    spender: graiAddress,
    required: bribePaid,
    action,
    batchLabel: 'approve + bribe',
  })
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
  const chainId = (account.chainId ?? config.chainId) as WagmiChainId
  const action: Erc20ActionCall = {
    to: graiAddress,
    abi: graiAbi,
    functionName: 'distribute',
    args: [asset, amount],
    value: isNativeEvmAsset(asset) ? amount : 0n,
  }

  if (isNativeEvmAsset(asset)) {
    const hash = await writeContract(wagmiConfig, {
      address: action.to,
      abi: action.abi,
      functionName: action.functionName,
      args: action.args,
      value: action.value,
    })
    await waitForTransactionReceipt(wagmiConfig, { hash })
    return { hash, amount }
  }

  const hash = await writeWithErc20Approve({
    owner: account.address,
    chainId,
    token: asset,
    spender: graiAddress,
    required: amount,
    action,
    batchLabel: 'approve + distribute',
  })
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

export type ExecuteEvmGrindersLiquidateParams = {
  config: GraiEvmConfig
  fromId: bigint
  toId: bigint
}

async function resolveGrindersAddress(config: GraiEvmConfig): Promise<`0x${string}`> {
  const graiAddress = resolveGraiContractAddress(config)
  const grindersAddress = await readContract(wagmiConfig, {
    address: graiAddress,
    abi: graiAbi,
    functionName: 'grinders',
  })
  if (!grindersAddress || grindersAddress === '0x0000000000000000000000000000000000000000') {
    throw new Error('Grinders is not set on this GRAI deployment')
  }
  return grindersAddress
}

/** Resolve Grinders proxy from GRAI and call `liquidate(fromId, toId)`. */
export async function executeEvmGrindersLiquidate({
  config,
  fromId,
  toId,
}: ExecuteEvmGrindersLiquidateParams): Promise<{ hash: string }> {
  const account = getAccount(wagmiConfig)
  if (!account.address) {
    throw new Error('Connect an EVM wallet to liquidate custodians')
  }

  const grindersAddress = await resolveGrindersAddress(config)
  const hash = await writeContract(wagmiConfig, {
    address: grindersAddress,
    abi: grindersAbi,
    functionName: 'liquidate',
    args: [fromId, toId],
  })

  await waitForTransactionReceipt(wagmiConfig, { hash })
  return { hash }
}

export type ExecuteEvmGrindersMintParams = {
  config: GraiEvmConfig
  custodianKind: `0x${string}`
  owner: `0x${string}`
  baseAsset: `0x${string}`
  quoteAsset: `0x${string}`
}

/** Deploy a custodian proxy + mint Grinder NFT via `Grinders.mint`. */
export async function executeEvmGrindersMint({
  config,
  custodianKind,
  owner,
  baseAsset,
  quoteAsset,
}: ExecuteEvmGrindersMintParams): Promise<{ hash: string }> {
  const account = getAccount(wagmiConfig)
  if (!account.address) {
    throw new Error('Connect an EVM wallet to mint a custodian')
  }

  const grindersAddress = await resolveGrindersAddress(config)
  const hash = await writeContract(wagmiConfig, {
    address: grindersAddress,
    abi: grindersAbi,
    functionName: 'mint',
    args: [custodianKind, owner, baseAsset, quoteAsset],
  })

  await waitForTransactionReceipt(wagmiConfig, { hash })
  return { hash }
}

export type ExecuteEvmGrindersRegisterParams = {
  config: GraiEvmConfig
  custodian: `0x${string}`
  owner: `0x${string}`
}

/** Register a pre-deployed custodian + mint Grinder NFT via `Grinders.register`. */
export async function executeEvmGrindersRegister({
  config,
  custodian,
  owner,
}: ExecuteEvmGrindersRegisterParams): Promise<{ hash: string }> {
  const account = getAccount(wagmiConfig)
  if (!account.address) {
    throw new Error('Connect an EVM wallet to register a custodian')
  }

  const grindersAddress = await resolveGrindersAddress(config)
  const hash = await writeContract(wagmiConfig, {
    address: grindersAddress,
    abi: grindersAbi,
    functionName: 'register',
    args: [custodian, owner],
  })

  await waitForTransactionReceipt(wagmiConfig, { hash })
  return { hash }
}

export type ExecuteEvmPoachParams = {
  config: GraiEvmConfig
  locker: `0x${string}`
}

/** Buy out the referrer NFT for `locker` — pays `previewPoach` GRAI to the current owner. */
export async function executeEvmPoach({
  config,
  locker,
}: ExecuteEvmPoachParams): Promise<{ hash: string; price: bigint; referrer: `0x${string}` }> {
  const account = getAccount(wagmiConfig)
  if (!account.address) {
    throw new Error('Connect an EVM wallet to poach a referral slot')
  }

  const graiAddress = resolveGraiContractAddress(config)
  const [price, referrer] = await readContract(wagmiConfig, {
    address: graiAddress,
    abi: graiAbi,
    functionName: 'previewPoach',
    args: [locker, account.address],
  })

  const hash = await writeContract(wagmiConfig, {
    address: graiAddress,
    abi: graiAbi,
    functionName: 'poach',
    args: [locker],
  })

  await waitForTransactionReceipt(wagmiConfig, { hash })
  return { hash, price, referrer }
}

/** Parse human-readable amount to wei using viem (for consistency with ERC-20 decimals). */
export function parseEvmTokenAmount(input: string, decimals: number): bigint {
  const trimmed = input.trim()
  if (!trimmed || trimmed === '.') {
    throw new Error('Enter an amount')
  }
  return parseUnits(trimmed, decimals)
}
