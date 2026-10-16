import { lazy, Suspense } from 'react'
import { useWalletContext } from '../wallets/AppWalletProvider'
import { useEvmWallet } from '../wallets/useEvmWallet'
import { useSolanaWallet } from '../wallets/useSolanaWallet'
import './GraiPage.css'

const GraiManageSection = lazy(() =>
  import('./GraiManagePage').then((m) => ({ default: m.GraiManageSection })),
)

function GrindersPage() {
  const { networkEnv } = useWalletContext()
  const evmWallet = useEvmWallet()
  const solanaWallet = useSolanaWallet()
  const showTestnetBanner =
    networkEnv === 'testnet' && (evmWallet.isConnected || solanaWallet.isConnected)

  return (
    <div className="grai-page grinders-page">
      {showTestnetBanner ? (
        <p className="grai-page-dev-banner" role="status">
          TESTNET DEVELOPMENT
        </p>
      ) : null}
      <Suspense fallback={null}>
        <GraiManageSection />
      </Suspense>
    </div>
  )
}

export default GrindersPage
