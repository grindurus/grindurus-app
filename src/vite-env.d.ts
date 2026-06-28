/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAIN_APP_URL?: string
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string
  readonly VITE_SOLANA_RPC_URL?: string
  readonly VITE_GRAI_RPC_URL?: string
  readonly VITE_GRAI_PROGRAM_ID?: string
  readonly VITE_BACKTEST_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
