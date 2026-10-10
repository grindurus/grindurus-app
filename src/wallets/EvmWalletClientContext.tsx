import {
  createContext,
  useContext,
  type ReactNode,
} from 'react'
import type { WalletClient } from 'viem'
import { useWalletClient } from 'wagmi'

type EvmWalletClientValue = {
  walletClient: WalletClient | undefined
}

const EvmWalletClientContext = createContext<EvmWalletClientValue>({
  walletClient: undefined,
})

/** Publishes wagmi `useWalletClient` for pages that must not call wagmi hooks
 *  themselves (they may render before WagmiProvider is mounted). */
export function EvmWalletClientPublisher({ children }: { children: ReactNode }) {
  const { data: walletClient } = useWalletClient()
  return (
    <EvmWalletClientContext.Provider value={{ walletClient: walletClient as WalletClient | undefined }}>
      {children}
    </EvmWalletClientContext.Provider>
  )
}

export function useEvmWalletClient() {
  return useContext(EvmWalletClientContext)
}
