import { useCallback, useEffect, useState } from 'react'
import GraiPage from './pages/GraiPage'
import GraiManagePage from './pages/GraiManagePage'
import BacktestPage from './pages/BacktestPage'
import Header, { type HeaderMainView } from './components/Header'
import './App.css'

type AppRoute = 'grai' | 'grai-manage' | 'backtest'

function routeFromPath(pathname: string): AppRoute {
  if (pathname === '/backtest') return 'backtest'
  if (pathname === '/grai/manage') return 'grai-manage'
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
  const [route, setRoute] = useState<AppRoute>(() => routeFromPath(window.location.pathname))
  const mainView: HeaderMainView = route === 'backtest' ? 'backtest' : 'grai'

  useEffect(() => {
    if (window.location.pathname === '/') {
      window.history.replaceState({}, '', '/grai')
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
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath)
    }
    setRoute(routeFromPath(targetPath))
  }, [])

  useEffect(() => {
    document.title = titleFromRoute(route)
  }, [route])

  return (
    <div className="App">
      <Header activeView={mainView} onViewChange={handleViewChange} />
      <main className={`App-main ${route === 'backtest' ? 'App-main--backtest' : ''}`}>
        {route === 'grai-manage' ? (
          <GraiManagePage />
        ) : route === 'grai' ? (
          <GraiPage />
        ) : (
          <BacktestPage />
        )}
      </main>
    </div>
  )
}

export default App
