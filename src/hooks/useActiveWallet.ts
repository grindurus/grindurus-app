import { useMemo } from 'react'
import { useEvmWallet } from './useEvmWallet'
import { useSolanaWallet } from './useSolanaWallet'
import { useWalletContext, type ChainType } from '../providers/walletContext'
import { evmChainIdToCaip2, solanaClusterToCaip2 } from '../wallet/caip2Network'

export interface ActiveWalletState {
  isConnected: boolean
  isConnecting: boolean
  address: string
  shortAddress: string
  chainType: ChainType
  networkName: string
  networkCaip2: string | null
  disconnect: () => Promise<void>
}

export function useActiveWallet(): ActiveWalletState {
  const { selectedChainType, disconnect: contextDisconnect } = useWalletContext()
  const evmWallet = useEvmWallet()
  const solanaWallet = useSolanaWallet()

  const activeWallet = useMemo((): ActiveWalletState => {
    // Prefer the wallet that matches the GRAI / CA selection — but never hide a connected
    // Solana session behind a stale EVM chain type, or an EVM session behind Solana.
    if (
      solanaWallet.isConnected &&
      (selectedChainType === 'solana' || !evmWallet.isConnected)
    ) {
      const networkCaip2 = solanaClusterToCaip2(solanaWallet.cluster)
      return {
        isConnected: true,
        isConnecting: solanaWallet.isConnecting,
        address: solanaWallet.address,
        shortAddress: solanaWallet.shortAddress,
        chainType: 'solana',
        networkName: solanaWallet.clusterName,
        networkCaip2,
        disconnect: async () => {
          await solanaWallet.disconnect()
          contextDisconnect()
        },
      }
    }

    if (
      evmWallet.isConnected &&
      (selectedChainType === 'evm' || !solanaWallet.isConnected)
    ) {
      const networkCaip2 = evmChainIdToCaip2(evmWallet.chainId)
      return {
        isConnected: true,
        isConnecting: evmWallet.isConnecting,
        address: evmWallet.address || '',
        shortAddress: evmWallet.shortAddress,
        chainType: 'evm',
        networkName: evmWallet.chainName,
        networkCaip2,
        disconnect: async () => {
          await Promise.resolve(evmWallet.disconnect())
          contextDisconnect()
        },
      }
    }

    return {
      isConnected: false,
      isConnecting: evmWallet.isConnecting || solanaWallet.isConnecting,
      address: '',
      shortAddress: '',
      chainType: null,
      networkName: '',
      networkCaip2: null,
      disconnect: async () => {},
    }
  }, [selectedChainType, evmWallet, solanaWallet, contextDisconnect])

  return activeWallet
}
