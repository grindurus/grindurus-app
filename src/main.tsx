import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AppWalletProvider } from './providers/AppWalletProvider'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AppWalletProvider>
    <App />
  </AppWalletProvider>,
)
