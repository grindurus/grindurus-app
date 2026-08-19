import { useMemo, useState } from 'react'
import { listConfiguredEvmChains } from '../grai/deployments'
import { useGraiDeployment } from '../grai/GraiDeploymentProvider'
import { GRAI_DECIMALS_EVM } from '../grai/evm/constants'
import { GRAI_DECIMALS } from '../grai/tokenomics'
import { GraiReferralTree } from '../components/grai/GraiReferralTree'
import { GraiActionConnectWalletButton } from '../components/grai/GraiWalletAction'
import { useActiveWallet } from '../hooks/useActiveWallet'
import { useEvmWallet } from '../hooks/useEvmWallet'
import { useSolanaWallet } from '../hooks/useSolanaWallet'
import { toAppPath } from '../utils/appPaths'
import './GraiPage.css'
import './AffiliatesPage.css'

function firstAddress(...candidates: Array<string | null | undefined>) {
  for (const value of candidates) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return null
}

function AffiliatesPage() {
  const { chainKind, evm: connectedEvm, connection, solana } = useGraiDeployment()
  const configuredEvmChains = useMemo(() => listConfiguredEvmChains(), [])
  const evmProtocol = connectedEvm ?? configuredEvmChains[0] ?? null
  const activeWallet = useActiveWallet()
  const solanaWallet = useSolanaWallet()
  const evmWallet = useEvmWallet()
  const walletAddress = firstAddress(
    chainKind === 'solana' ? solanaWallet.address : null,
    chainKind === 'evm' ? evmWallet.address : null,
    evmWallet.address,
    solanaWallet.address,
    activeWallet.address,
  )
  const graiDecimals = chainKind === 'evm' ? GRAI_DECIMALS_EVM : GRAI_DECIMALS
  const [copied, setCopied] = useState(false)
  const [termsCollapsed, setTermsCollapsed] = useState(false)

  const graiBase = `${window.location.origin}${toAppPath('/grai')}`
  const referralHref = walletAddress
    ? `${graiBase}?ref=${encodeURIComponent(walletAddress)}`
    : `${graiBase}?ref=`

  async function copyReferralLink() {
    if (!referralHref) return
    try {
      await navigator.clipboard.writeText(referralHref)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="grai-page affiliates-page">
      <p className="grai-page-dev-banner" role="status">
        TESTNET DEVELOPMENT
      </p>
      <div className="grai-content-row">
        <div className="affiliates-intro">
          <h1 className="grai-page-title affiliates-intro-title">
            {walletAddress ? 'Your referral link' : 'Connect wallet to generate referral link'}
          </h1>
          <a className="affiliates-ref-link" href={referralHref}>
            {referralHref}
          </a>
          {walletAddress ? (
            <div className="affiliates-link-row">
              <button type="button" className="grai-mint-btn" onClick={() => void copyReferralLink()}>
                {copied ? 'Copied!' : 'Copy Referral Link'}
              </button>
            </div>
          ) : (
            <div className="affiliates-link-row">
              <GraiActionConnectWalletButton />
            </div>
          )}
          <p className="affiliates-copy">
            Your Web3 wallet address is the ref ID. Earn a <span className="affiliates-copy-accent">revenue share</span>.
          </p>
        </div>
      </div>

      <GraiReferralTree
        evmProtocol={chainKind === 'evm' ? evmProtocol : null}
        solana={chainKind === 'solana' ? solana : null}
        connection={chainKind === 'solana' ? connection : null}
        highlightAddress={walletAddress}
        graiDecimals={graiDecimals}
      />

      <section className={`affiliates-terms${termsCollapsed ? ' is-collapsed' : ''}`} aria-labelledby="affiliates-terms-title">
        <h2 id="affiliates-terms-title" className="affiliates-terms-title">
          <button
            type="button"
            className={`grai-referral-dash-collapse${termsCollapsed ? ' is-collapsed' : ''}`}
            onClick={() => setTermsCollapsed((collapsed) => !collapsed)}
            aria-expanded={!termsCollapsed}
            aria-controls="affiliates-terms-body"
            aria-label={termsCollapsed ? 'Show affiliate program' : 'Hide affiliate program'}
          >
            <svg
              className="grai-donut-legend-toggle-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          Affiliate program
        </h2>
        <div
          className="affiliates-terms-body"
          id="affiliates-terms-body"
          hidden={termsCollapsed}
        >
        <p className="affiliates-terms-lead">
          Instruction and terms. Onchain. Your wallet is the ref ID — share{' '}
          <code className="affiliates-terms-code">/grai?ref=&lt;address&gt;</code>.
        </p>
        <ol className="affiliates-terms-list">
          <li>
            <strong>Join.</strong> Anyone who deposits GRAI with your address as referrer binds to
            you. No forms, no approval.
          </li>
          <li>
            <strong>First deposit.</strong> The protocol mints an affiliate NFT. The referrer owns
            that NFT. Leave referrer blank to self-bind.
          </li>
          <li>
            <strong>Sticky bind.</strong> The locker&apos;s referrer seat stays until the affiliate
            NFT is transferred or someone poaches the seat.
          </li>
          <li>
            <strong>Revenue share.</strong> On each <code className="affiliates-terms-code">claim</code>, a
            protocol slice of yield (~5% by default) goes to affiliates. Two levels: L1 (direct)
            takes 80% of that slice, L2 (one hop up) takes 20%. Pay follows the NFT owner.
          </li>
          <li>
            <strong>Books.</strong> Deposits and claims add value to L1/L2 books. That raises the
            poach ask. Redeem does not unwind it.
          </li>
          <li>
            <strong>Poach.</strong> Anyone can buy a locker&apos;s referrer seat by paying GRAI to
            the current referrer. The tree rebinds; the cashflow NFT does not move unless
            transferred separately. Blocked while liquidation is open.
          </li>
          <li>
            <strong>GRS incentive.</strong> Bring liquidity and you can also earn GRS. This is extra
            to the GRAI yield share and comes from the GRS Affiliates allocation.
          </li>
        </ol>
        <p className="affiliates-terms-note">
          Weights and levels are protocol parameters.
        </p>
        </div>
      </section>
    </div>
  )
}

export default AffiliatesPage
