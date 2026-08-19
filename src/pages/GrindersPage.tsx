import { lazy, Suspense } from 'react'
import './GraiPage.css'

const GraiManageSection = lazy(() =>
  import('./GraiManagePage').then((m) => ({ default: m.GraiManageSection })),
)

function GrindersPage() {
  return (
    <div className="grai-page grinders-page">
      <p className="grai-page-dev-banner" role="status">
        TESTNET DEVELOPMENT
      </p>
      <Suspense fallback={null}>
        <GraiManageSection />
      </Suspense>
    </div>
  )
}

export default GrindersPage
