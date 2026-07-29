import { useEffect, useLayoutEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { FloatingTokenBackground, STABLE_FLOATING_TOKENS } from '../components/FloatingTokenBackground'
import { HowItWorksModal } from '../components/HowItWorksModal'
import { GraiMintBurnPanel } from '../components/grai/GraiMintBurnPanel'
import { GraiMintSubtitleText } from '../components/grai/GraiMintSubtitleRotatingAsset'
import { GraiGrindersSection } from '../components/grai/GraiGrindersSection'
import { GraiAssetsSection } from '../components/grai/GraiAssetsSection'
import { type GraiSection } from '../utils/graiNavigation'
import './GraiPage.css'

function GraiPage() {
  const navigate = useNavigate()
  const { clusterMismatch, evmChainMismatch, solanaCluster, chainKind, evm, hasStaticConfig, isConfigured, protocolError } = useGraiDeployment()
  const [actionView, setActionView] = useState<'mint' | 'burn'>('mint')
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false)

  useLayoutEffect(() => {
    try {
      const show = localStorage.getItem('grai-show-status-notices') !== '0'
      document.documentElement.classList.toggle('grai-status-notices-hidden', !show)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const applySection = (section: GraiSection) => {
      if (section === 'mint' || section === 'claim' || section === 'lock' || section === 'unlock') {
        setActionView('mint')
      } else if (section === 'burn') setActionView('burn')
    }

    const onSectionNav = (event: Event) => {
      applySection((event as CustomEvent<GraiSection>).detail)
    }

    const onHashChange = () => {
      const hash = window.location.hash.slice(1)
      if (hash === 'allocate' || hash === 'distribute' || hash === 'manage') {
        navigate(`/grinders#${hash === 'manage' ? 'allocate' : hash}`, { replace: true })
        return
      }
      if (
        hash === 'mint' ||
        hash === 'claim' ||
        hash === 'lock' ||
        hash === 'unlock' ||
        hash === 'burn' ||
        hash === 'assets' ||
        hash === 'grinders' ||
        hash === 'auctions' ||
        hash === 'vote' ||
        hash === 'bribe'
      ) {
        applySection(hash)
      }
    }

    window.addEventListener('grai-section-nav', onSectionNav)
    window.addEventListener('hashchange', onHashChange)
    onHashChange()

    return () => {
      window.removeEventListener('grai-section-nav', onSectionNav)
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [navigate])

  return (
    <div className="grai-page">
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
            actionView={actionView}
            actionSubtitle={actionView === 'mint' ? <GraiMintSubtitleText /> : null}
            onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
          />
        </div>
      </FloatingTokenBackground>

      <GraiGrindersSection />

      <GraiAssetsSection />
      <HowItWorksModal isOpen={isHowItWorksOpen} onClose={() => setIsHowItWorksOpen(false)} />
    </div>
  )
}

export default GraiPage
