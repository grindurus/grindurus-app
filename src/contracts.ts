/**
 * Public on-chain deployments — ship in the client; not secrets.
 * Edit here when a new network / upgrade goes live.
 *
 * Sources:
 * - GRAI Arbitrum — CreateX / DeployGRAI
 * - GRAI Solana Devnet — grindurus-solana migrations
 * - GRS Sepolia + Solana Devnet — `grindurus-evm/script/grs/v3_deploy.md`,
 *   `grindurus-solana/migrations/grs/v2_deploy.md`
 */

export type EvmAddress = `0x${string}`

/** GRAI unified proxy (token + protocol) per EVM chain id. */
export const GRAI_EVM: Partial<Record<number, EvmAddress>> = {
  // Arbitrum One
  42161: '0x999999082c136c363bA7436928499CbA9B2Ed94D',
  // Fill when testnets are published:
  // 11155111: '0x…', // Sepolia
  // 84532: '0x…', // Base Sepolia
}

export type GraiSolanaDeployment = {
  mint: string
  /** Optional docs-only; runtime discovers program/state from mint. */
  programId?: string
  graiState?: string
}

/** GRAI mint (+ known PDAs) per Solana cluster. */
export const GRAI_SOLANA: Partial<
  Record<'devnet' | 'testnet' | 'mainnet-beta', GraiSolanaDeployment>
> = {
  devnet: {
    mint: 'nJoFYfY5xcA8aZ2Wiq79RNKfqyEwS9nF13goghEgrai',
    programId: 'DBAmy36cyMnAdL1YMRM81mNSwRzGSVASjJYvaniyGiSS',
    graiState: 'BtEjrZQ8PiQkM7VfQaBdYBy689g63WjaphXV8xo6hfMA',
  },
  // mainnet-beta: { mint: '…' },
}

/** GRS OFT ERC-20 per EVM chain id. */
export const GRS_EVM: Partial<Record<number, EvmAddress>> = {
  // Sepolia home
  11155111: '0xFBa4f8CDa4C54BD9D3F045665C6D7F5B9A2c56c4',
  // Fill when mainnet / other spokes ship:
  // 1: '0x…',
  // 8453: '0x…',
  // 42161: '0x…',
}

export type GrsSolanaDeployment = {
  mint: string
  programId: string
  /** Optional; otherwise derived as `["OftEscrow", mint]` / `["OFT", escrow]`. */
  escrow?: string
  oftStore?: string
}

/** GRS Solana spoke per cluster. */
export const GRS_SOLANA: Partial<
  Record<'devnet' | 'testnet' | 'mainnet-beta', GrsSolanaDeployment>
> = {
  devnet: {
    mint: '9YCwSKP54mZCnGFzdUFNfd6vsx84gsaARKh7NG16z6mc',
    programId: 'BGWdAUzjxAZtFzxRTSy88k6r9iYotkhga449vB2tRNTy',
    escrow: '26vXtrH8PSNnMJ6zDKdkACTr6vARe4uq58YGLVpUeu7h',
    oftStore: '43k74vwT4YT5run7DmFc7AMZCPwWds9AF52vGfQivV5A',
  },
}

/** Grinders program id per Solana cluster (fallback = shared default). */
export const GRINDERS_SOLANA: {
  default: string
} & Partial<Record<'devnet' | 'testnet' | 'mainnet-beta', string>> = {
  default: '7W9uhZZvmHSyhRmdDRnbZPZfaUdJaMbGMWsBLjSRWT5v',
  // per cluster when they diverge:
  // devnet: '…',
  // 'mainnet-beta': '…',
}
