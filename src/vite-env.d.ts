/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string
  readonly VITE_ETHEREUM_RPC_URL?: string
  readonly VITE_BASE_RPC_URL?: string
  readonly VITE_ARBITRUM_RPC_URL?: string
  readonly VITE_POLYGON_RPC_URL?: string
  readonly VITE_SEPOLIA_RPC_URL?: string
  readonly VITE_SOLANA_RPC_URL?: string
  readonly VITE_SOLANA_DEVNET_RPC_URL?: string
  readonly VITE_SOLANA_MAINNET_RPC_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
