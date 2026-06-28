/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAIN_APP_URL?: string
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string
  readonly VITE_SOLANA_RPC_URL?: string
  readonly VITE_SOLANA_DEVNET_RPC_URL?: string
  readonly VITE_SOLANA_MAINNET_RPC_URL?: string
  readonly VITE_SOLANA_TESTNET_RPC_URL?: string
  readonly VITE_GRAI_SOLANA_CLUSTER?: string
  readonly VITE_GRAI_RPC_URL?: string
  readonly VITE_GRAI_PROGRAM_ID?: string
  readonly VITE_GRAI_MINT?: string
  readonly VITE_GRAI_DEVNET_PROGRAM_ID?: string
  readonly VITE_GRAI_DEVNET_MINT?: string
  readonly VITE_GRAI_DEVNET_RPC_URL?: string
  readonly VITE_GRAI_MAINNET_PROGRAM_ID?: string
  readonly VITE_GRAI_MAINNET_MINT?: string
  readonly VITE_GRAI_MAINNET_RPC_URL?: string
  readonly VITE_GRAI_TESTNET_PROGRAM_ID?: string
  readonly VITE_GRAI_TESTNET_MINT?: string
  readonly VITE_GRAI_TESTNET_RPC_URL?: string
  readonly VITE_GRAI_ETHEREUM_TOKEN?: string
  readonly VITE_GRAI_ETHEREUM_PROTOCOL?: string
  readonly VITE_GRAI_BASE_TOKEN?: string
  readonly VITE_GRAI_BASE_PROTOCOL?: string
  readonly VITE_GRAI_ARBITRUM_TOKEN?: string
  readonly VITE_GRAI_ARBITRUM_PROTOCOL?: string
  readonly VITE_GRAI_SEPOLIA_TOKEN?: string
  readonly VITE_GRAI_SEPOLIA_PROTOCOL?: string
  readonly VITE_GRAI_BASE_SEPOLIA_TOKEN?: string
  readonly VITE_GRAI_BASE_SEPOLIA_PROTOCOL?: string
  readonly VITE_BACKTEST_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
