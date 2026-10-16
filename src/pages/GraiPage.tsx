import { useEffect, useLayoutEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isManageSectionHash } from '../utils/graiNavigation'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { FloatingTokenBackground, STABLE_FLOATING_TOKENS } from '../components/FloatingTokenBackground'
import { HowItWorksModal } from '../components/HowItWorksModal'
import { GraiMintBurnPanel } from '../components/grai/GraiMintBurnPanel'
import { GraiMintSubtitleText } from '../components/grai/GraiMintSubtitleRotatingAsset'
import { GraiGrindersSection } from '../components/grai/GraiGrindersSection'
import { GraiAssetsSection } from '../components/grai/GraiAssetsSection'
import { MINT_ASSET_SOLSCAN_ICON } from '../components/grai/graiPageIcons'
import { GraiCaNetworkSelect } from '../components/grai/GraiCaNetworkSelect'
import { useWalletContext } from '../wallets/AppWalletProvider'
import { useEvmWallet } from '../wallets/useEvmWallet'
import { useSolanaWallet } from '../wallets/useSolanaWallet'
import { requestSolanaWalletCluster } from '../wallets/requestSolanaWalletCluster'
import { pinnedGraiSolanaCluster } from '../grai/solanaClusterPin'
import './GraiPage.css'

const GRAI_MAINNET_CHAIN_ID = 42161

function GraiPage() {
  const navigate = useNavigate()
  const {
    clusterMismatch,
    evmChainMismatch,
    solanaCluster,
    chainKind,
    evm,
    staticSolana,
    hasStaticConfig,
    isConfigured,
    protocolError,
    explorerTokenUrl,
  } = useGraiDeployment()
  const { networkEnv, setSelectedChainType, setEvmChain, evmChain } = useWalletContext()
  const evmWallet = useEvmWallet()
  const solanaWallet = useSolanaWallet()
  const pinnedSolana = pinnedGraiSolanaCluster()
  const walletConnected = evmWallet.isConnected || solanaWallet.isConnected
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false)

  // Mainnet GRAI is Arbitrum-only — reinforce while header is Mainnet.
  // Yield when Solana is connected under the Devnet-only pin (see solanaClusterPin.ts).
  useEffect(() => {
    if (networkEnv !== 'mainnet') return
    if (pinnedSolana && solanaWallet.isConnected) return
    setSelectedChainType('evm')
    if (evmChain !== 'arbitrum') setEvmChain('arbitrum')
    if (evmWallet.isConnected && evmWallet.chainId !== GRAI_MAINNET_CHAIN_ID) {
      void evmWallet.switchToChainAsync(GRAI_MAINNET_CHAIN_ID).catch(() => {
        evmWallet.switchToChain(GRAI_MAINNET_CHAIN_ID)
      })
    }
  }, [
    evmChain,
    evmWallet,
    networkEnv,
    pinnedSolana,
    setEvmChain,
    setSelectedChainType,
    solanaWallet.isConnected,
  ])

  const graiCa =
    chainKind === 'evm'
      ? (evm?.graiToken ?? null)
      : chainKind === 'solana'
        ? (staticSolana?.graiMint.toBase58() ?? null)
        : (evm?.graiToken ?? staticSolana?.graiMint.toBase58() ?? null)
  const graiCaHref = graiCa ? explorerTokenUrl(graiCa) : null
  const networkChainId = chainKind === 'evm' ? (evm?.chainId ?? null) : null
  const networkSolanaCluster = chainKind === 'solana' ? solanaCluster : null
  useLayoutEffect(() => {
    try {
      const show = localStorage.getItem('grai-show-status-notices') !== '0'
      document.documentElement.classList.toggle('grai-status-notices-hidden', !show)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.slice(1)
      if (isManageSectionHash(hash)) {
        navigate(`/grinders#${hash === 'manage' ? 'allocate' : hash}`, { replace: true })
      }
    }

    window.addEventListener('hashchange', onHashChange)
    onHashChange()

    return () => {
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [navigate])

  return (
    <div className="grai-page">
      {networkEnv === 'testnet' && (evmWallet.isConnected || solanaWallet.isConnected) ? (
        <p className="grai-page-dev-banner" role="status">
          TESTNET DEVELOPMENT
        </p>
      ) : null}
      <FloatingTokenBackground tokens={STABLE_FLOATING_TOKENS} className="grai-content-row">
        {walletConnected &&
          (clusterMismatch || evmChainMismatch || !isConfigured || protocolError) && (
          <div className="grai-page-meta">
            {clusterMismatch && (
              <p className="grai-page-network-warning" role="status">
                {pinnedSolana
                  ? 'GRAI on Solana is Devnet-only for now. Switch your wallet to Devnet to mint or redeem.'
                  : `Switch your Solana wallet to ${solanaCluster === 'mainnet-beta' ? 'Mainnet' : solanaCluster} to mint or redeem GRAI.`}{' '}
                <button
                  type="button"
                  className="grai-page-network-warning-action"
                  onClick={() => {
                    const target =
                      pinnedSolana ??
                      (solanaCluster === 'mainnet-beta' || solanaCluster === 'devnet'
                        ? solanaCluster
                        : 'devnet')
                    solanaWallet.switchCluster(target)
                    void requestSolanaWalletCluster(target)
                  }}
                >
                  Request {pinnedSolana === 'devnet' || solanaCluster === 'devnet' ? 'Devnet' : 'Mainnet'}
                </button>
              </p>
            )}
            {evmChainMismatch && evm && (
              <p className="grai-page-network-warning" role="status">
                Switch your EVM wallet to {evm.chainName} to mint or redeem GRAI.
              </p>
            )}
            {!isConfigured && chainKind === null && (
              <p className="grai-page-network-warning" role="status">
                GRAI is not configured for this network. Set deployment env vars before using the app.
              </p>
            )}
            {!isConfigured && chainKind === 'evm' && (
              <p className="grai-page-network-warning" role="status">
                GRAI is not configured for this EVM network. Set VITE_GRAI_ARBITRUM (mainnet) or the matching VITE_GRAI_* env var.
              </p>
            )}
            {!isConfigured && chainKind === 'solana' && !hasStaticConfig && (
              <p className="grai-page-network-warning" role="status">
                GRAI is not configured for this Solana cluster. Set deployment env vars before using the app.
              </p>
            )}
            {protocolError && (
              <p className="grai-page-network-warning" role="status">
                {protocolError}
              </p>
            )}
          </div>
        )}
        <div className="grai-actions-block" id="grai-actions-section">
          <GraiMintBurnPanel
            actionView="mint"
            actionSubtitle={<GraiMintSubtitleText />}
            onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
          />
        </div>
      </FloatingTokenBackground>

      <GraiGrindersSection />

      <GraiAssetsSection />

      <div className="grai-page-ca-bar">
        <GraiCaNetworkSelect
          chainKind={chainKind}
          chainId={networkChainId}
          solanaCluster={networkSolanaCluster}
          ariaLabel="Select GRAI network"
        />
        <p className="grai-page-ca grai-page-ca-inline">
          <span className="grai-page-ca-label">GRAI CA:</span>{' '}
          {graiCa ? (
            graiCaHref ? (
              <a
                href={graiCaHref}
                target="_blank"
                rel="noreferrer"
                className="grai-page-ca-link"
                title={graiCa}
              >
                <span className="grai-page-ca-link-text">{graiCa}</span>
                <span className="grai-page-ca-link-icon" aria-hidden="true">
                  {MINT_ASSET_SOLSCAN_ICON}
                </span>
              </a>
            ) : (
              <span className="grai-page-ca-link-text" title={graiCa}>
                {graiCa}
              </span>
            )
          ) : (
            <span className="grai-page-ca-missing">—</span>
          )}
        </p>
      </div>

      <HowItWorksModal isOpen={isHowItWorksOpen} onClose={() => setIsHowItWorksOpen(false)} />
    </div>
  )
}

export default GraiPage
