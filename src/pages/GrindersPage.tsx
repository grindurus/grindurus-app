import { lazy, Suspense } from 'react'
import './GraiPage.css'

const GraiManageSection = lazy(() =>
  import('./GraiManagePage').then((m) => ({ default: m.GraiManageSection })),
)

function GrindersPage() {
  return (
    <div className="grai-page grinders-page">
      <Suspense fallback={null}>
        <GraiManageSection />
      </Suspense>
    </div>
  )
}

export default GrindersPage
