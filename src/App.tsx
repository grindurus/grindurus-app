import { useEffect, lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import Header from './components/Header'
import Footer from './components/Footer'
import { useWalletContext } from './providers/AppWalletProvider'
import { navigateToGraiSection } from './utils/graiNavigation'
import './App.css'

const GraiPage = lazy(() => import('./pages/GraiPage'))
const GrindersPage = lazy(() => import('./pages/GrindersPage'))
const BacktestPage = lazy(() => import('./pages/BacktestPage'))

function titleFromPath(pathname: string): string {
  if (pathname.startsWith('/backtest')) return 'Backtest Simulator'
  if (pathname.startsWith('/grinders')) return 'Grinders'
  if (pathname === '/grai/manage') return 'GRAI — Grinder management'
  return 'GRAI'
}

function GraiManageRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/grinders#allocate', { replace: true })
    navigateToGraiSection('allocate')
  }, [navigate])

  return null
}

function GraiRoute() {
  return (
    <Suspense
      fallback={
        <div className="App-main-loading" role="status">
          Loading GRAI…
        </div>
      }
    >
      <GraiPage />
    </Suspense>
  )
}

function GrindersRoute() {
  return (
    <Suspense
      fallback={
        <div className="App-main-loading" role="status">
          Loading grinders…
        </div>
      }
    >
      <GrindersPage />
    </Suspense>
  )
}

function BacktestRoute() {
  const { isEvmStackReady } = useWalletContext()

  if (!isEvmStackReady) {
    return (
      <div className="App-main-loading" role="status">
        Loading backtest runtime...
      </div>
    )
  }

  return (
    <Suspense fallback={null}>
      <BacktestPage />
    </Suspense>
  )
}

function App() {
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = titleFromPath(pathname)
  }, [pathname])

  return (
    <div className="App">
      <Header />
      <main className={`App-main ${pathname.startsWith('/backtest') ? 'App-main--backtest' : ''}`}>
        <Routes>
          <Route path="/" element={<Navigate to="/grai" replace />} />
          <Route path="/grai" element={<GraiRoute />} />
          <Route path="/grinders" element={<GrindersRoute />} />
          <Route path="/grai/manage" element={<GraiManageRedirect />} />
          <Route path="/backtest" element={<BacktestRoute />} />
          <Route path="*" element={<Navigate to="/grai" replace />} />
        </Routes>
      </main>
      <Footer />
      <ToastContainer position="bottom-right" newestOnTop />
    </div>
  )
}

export default App
