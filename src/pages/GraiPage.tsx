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
import './GraiPage.css'

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
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false)

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
      <p className="grai-page-dev-banner" role="status">
        TESTNET DEVELOPMENT
      </p>
      <FloatingTokenBackground tokens={STABLE_FLOATING_TOKENS} className="grai-content-row">
        {(clusterMismatch || evmChainMismatch || !isConfigured || protocolError) && (
          <div className="grai-page-meta">
            {clusterMismatch && (
              <p className="grai-page-network-warning" role="status">
                Switch your Solana wallet to {solanaCluster === 'mainnet-beta' ? 'Mainnet' : solanaCluster} to mint or redeem GRAI.
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
                GRAI is not configured for this EVM network. Set VITE_GRAI_*_TOKEN and VITE_GRAI_*_PROTOCOL env vars.
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
