import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AppWalletProvider } from './providers/AppWalletProvider'
import { GraiDeploymentProvider } from './grai/GraiDeploymentProvider'
import { GraiDataProvider } from './providers/GraiDataProvider'
import { stripBasePath } from './utils/appPaths'
import './index.css'

const logicalPath = stripBasePath(window.location.pathname)
// Warm the primary chunk for the current entry route.
if (logicalPath === '/') {
  void import('./pages/LandingPage')
} else if (logicalPath !== '/backtest') {
  void import('./pages/GraiPage')
}

// Keep Tailwind `dark:` in sync with app `data-theme` (landing uses class strategy).
{
  const root = document.documentElement
  const syncDarkClass = () => {
    root.classList.toggle('dark', root.getAttribute('data-theme') !== 'light')
  }
  syncDarkClass()
  new MutationObserver(syncDarkClass).observe(root, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter basename={import.meta.env.BASE_URL}>
    <AppWalletProvider>
      <GraiDeploymentProvider>
        <GraiDataProvider>
          <App />
        </GraiDataProvider>
      </GraiDeploymentProvider>
    </AppWalletProvider>
  </BrowserRouter>,
)
