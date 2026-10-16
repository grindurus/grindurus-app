import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useWalletContext } from '../wallets/walletContext'
import { useSolanaWallet } from '../wallets/useSolanaWallet'
import { useEvmWallet } from '../wallets/useEvmWallet'
import { requestSolanaWalletCluster } from '../wallets/requestSolanaWalletCluster'
import { shouldGateGraiNetworks } from './networkGating'
import { pinnedGraiSolanaCluster } from './solanaClusterPin'

/**
 * While GRAI Solana is Devnet-only: keep the app on Devnet and ask the wallet
 * to leave Mainnet when Solana is active on GRAI / Affiliates.
 *
 * Remove with `GRAI_SOLANA_DEVNET_ONLY` in `solanaClusterPin.ts`.
 */
export function GraiSolanaDevnetPin() {
  const { pathname } = useLocation()
  const pinned = pinnedGraiSolanaCluster()
  const { selectedChainType, setSelectedChainType, solanaCluster, setSolanaCluster } =
    useWalletContext()
  const solanaWallet = useSolanaWallet()
  const evmWallet = useEvmWallet()
  const lastRequestKey = useRef<string | null>(null)

  useEffect(() => {
    if (!pinned) return
    if (!shouldGateGraiNetworks(pathname)) return
    if (!solanaWallet.isConnected) {
      lastRequestKey.current = null
      return
    }
    // Explicit EVM selection wins (e.g. Arbitrum mainnet GRAI).
    if (selectedChainType === 'evm' && evmWallet.isConnected) return

    if (selectedChainType !== 'solana') setSelectedChainType('solana')
    if (solanaCluster !== pinned) setSolanaCluster(pinned)

    // Wallet still on Mainnet (or unknown ≠ app Devnet) → prompt once per address.
    if (!solanaWallet.walletClusterMismatch) return
    const key = `${solanaWallet.address}:${pinned}`
    if (lastRequestKey.current === key) return
    lastRequestKey.current = key
    void requestSolanaWalletCluster(pinned)
  }, [
    evmWallet.isConnected,
    pathname,
    pinned,
    selectedChainType,
    setSelectedChainType,
    setSolanaCluster,
    solanaCluster,
    solanaWallet.address,
    solanaWallet.isConnected,
    solanaWallet.walletClusterMismatch,
  ])

  return null
}
