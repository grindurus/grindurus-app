import { useCallback, useEffect, useState } from 'react'
import GraiPage from './pages/GraiPage'
import BacktestPage from './pages/BacktestPage'
import Header, { type HeaderMainView } from './components/Header'
import './App.css'

function viewFromPath(pathname: string): HeaderMainView {
  if (pathname === '/backtest') return 'backtest'
  return 'grai'
}

function pathFromView(view: HeaderMainView): string {
  return view === 'backtest' ? '/backtest' : '/grai'
}

function titleFromView(view: HeaderMainView): string {
  return view === 'backtest' ? 'GrindURUS backtest simulator' : 'GRAI crowdfund tool'
}

function App() {
  const [mainView, setMainView] = useState<HeaderMainView>(() =>
    viewFromPath(window.location.pathname)
  )

  useEffect(() => {
    if (window.location.pathname === '/') {
      window.history.replaceState({}, '', '/grai')
    }
    const onPopState = () => {
      setMainView(viewFromPath(window.location.pathname))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const handleViewChange = useCallback((view: HeaderMainView) => {
    const targetPath = pathFromView(view)
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath)
    }
    setMainView(view)
  }, [])

  useEffect(() => {
    document.title = titleFromView(mainView)
  }, [mainView])

  return (
    <div className="App">
      <Header activeView={mainView} onViewChange={handleViewChange} />
      <main className={`App-main ${mainView === 'backtest' ? 'App-main--backtest' : ''}`}>
        {mainView === 'grai' ? <GraiPage /> : <BacktestPage />}
      </main>
    </div>
  )
}

export default App
