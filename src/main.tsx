import ReactDOM from 'react-dom/client'
import App from './App'
import { AppWalletProvider } from './providers/AppWalletProvider'
import { GraiDeploymentProvider } from './grai/GraiDeploymentProvider'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AppWalletProvider>
    <GraiDeploymentProvider>
      <App />
    </GraiDeploymentProvider>
  </AppWalletProvider>,
)
