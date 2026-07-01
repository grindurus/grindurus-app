export type EvmWalletSnapshot = {
  address: string | undefined
  shortAddress: string
  isConnected: boolean
  isConnecting: boolean
  chainId: number
  chainName: string
  connector: { id: string; name: string; uid: string } | undefined
  connectors: Array<{ id: string; name: string; uid: string; icon?: string; type?: string }>
  supportedChains: Array<{ id: number; name: string; icon: string }>
  canOpenConnectModal: boolean
  connect: () => boolean
  connectWalletConnect: () => boolean
  connectWithConnector: (connectorId: string) => Promise<void>
  disconnect: () => void
  switchToChain: (targetChainId: number) => void
  switchToChainAsync: (targetChainId: number) => Promise<void>
}

export const DEFAULT_EVM_WALLET: EvmWalletSnapshot = {
  address: undefined,
  shortAddress: '',
  isConnected: false,
  isConnecting: false,
  chainId: 1,
  chainName: 'Ethereum',
  connector: undefined,
  connectors: [],
  supportedChains: [],
  canOpenConnectModal: false,
  connect: () => false,
  connectWalletConnect: () => false,
  connectWithConnector: async () => {
    throw new Error('EVM wallet stack is not loaded yet')
  },
  disconnect: () => {},
  switchToChain: () => {},
  switchToChainAsync: async () => {
    throw new Error('EVM wallet stack is not loaded yet')
  },
}
