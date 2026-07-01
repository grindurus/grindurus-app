import { useCallback, useEffect, useState, lazy, Suspense } from 'react'
import Header, { type HeaderMainView } from './components/Header'
import { useWalletContext } from './providers/AppWalletProvider'
import { isAtAppPath, stripBasePath, toAppPath } from './utils/appPaths'
import { navigateToGraiSection } from './utils/graiNavigation'
import './App.css'

const GraiPage = lazy(() => import('./pages/GraiPage'))
const BacktestPage = lazy(() => import('./pages/BacktestPage'))

type AppRoute = 'grai' | 'grai-manage' | 'backtest'

function routeFromPath(pathname: string): AppRoute {
  const logical = stripBasePath(pathname)
  if (logical === '/backtest') return 'backtest'
  if (logical === '/grai/manage') return 'grai-manage'
  return 'grai'
}

function pathFromView(view: HeaderMainView): string {
  return view === 'backtest' ? '/backtest' : '/grai'
}

function titleFromRoute(route: AppRoute): string {
  if (route === 'backtest') return 'Backtest Simulator'
  if (route === 'grai-manage') return 'GRAI — Grinder management'
  return 'GRAI'
}

function App() {
  const { isEvmStackReady } = useWalletContext()
  const [route, setRoute] = useState<AppRoute>(() => routeFromPath(window.location.pathname))
  const mainView: HeaderMainView = route === 'backtest' ? 'backtest' : 'grai'

  useEffect(() => {
    if (isAtAppPath('/')) {
      window.history.replaceState({}, '', toAppPath('/grai'))
      setRoute('grai')
    }
    const onPopState = () => {
      setRoute(routeFromPath(window.location.pathname))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const handleViewChange = useCallback((view: HeaderMainView) => {
    const targetPath = pathFromView(view)
    if (!isAtAppPath(targetPath)) {
      window.history.pushState({}, '', toAppPath(targetPath))
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
    setRoute(routeFromPath(targetPath))
  }, [])

  useEffect(() => {
    if (route === 'grai-manage') {
      window.history.replaceState({}, '', `${toAppPath('/grai')}#allocate`)
      setRoute('grai')
      navigateToGraiSection('allocate')
    }
  }, [route])

  useEffect(() => {
    document.title = titleFromRoute(route)
  }, [route])

  return (
    <div className="App">
      <Header activeView={mainView} onViewChange={handleViewChange} />
      <main className={`App-main ${route === 'backtest' ? 'App-main--backtest' : ''}`}>
        {route === 'grai' || route === 'grai-manage' ? (
          <Suspense fallback={null}>
            <GraiPage />
          </Suspense>
        ) : isEvmStackReady ? (
          <Suspense fallback={null}>
            <BacktestPage />
          </Suspense>
        ) : (
          <div className="App-main-loading" role="status">
            Loading backtest runtime...
          </div>
        )}
      </main>
    </div>
  )
}

export default App
