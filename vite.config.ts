import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { bossRemoteProxyPlugin } from './vite/bossRemoteProxy'
import { bossLocalProxyPlugin } from './vite/bossLocalProxy'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const bossApiTarget =
  process.env.BOSS_API_TARGET ||
  process.env.VITE_BOSS_API_TARGET ||
  'https://boss.localhost'

// https://vitejs.dev/config/
export default defineConfig({
  // Served at https://app.grindurus.xyz/ (custom domain, root path).
  base: '/',
  plugins: [
    react(),
    bossRemoteProxyPlugin({
      // Local Traefik + dev/staging grindurus hosts may use self-signed certs in dev.
      insecureTlsHosts: ['boss.localhost', 'grindurus.xyz'],
    }),
    bossLocalProxyPlugin({
      target: bossApiTarget,
      insecureTlsHosts: ['boss.localhost', 'grindurus.xyz'],
    }),
    nodePolyfills({
      include: ['buffer', 'crypto', 'stream'],
    }),
  ],
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: bossApiTarget,
        changeOrigin: true,
        secure: false,
        timeout: 0,
        proxyTimeout: 0,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // Official devnet RPC — TLS cert on api.devnet.solana.com is expired; browser blocks it directly.
      '/solana-devnet-rpc': {
        target: 'https://api.devnet.solana.com',
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/solana-devnet-rpc/, ''),
      },
    },
  },
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
      '@landing': path.resolve(__dirname, 'src/landing'),
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter((dep) => !dep.includes('evm-wallet') && !dep.includes('EvmProvider')),
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('recharts') || id.includes('/d3-')) return 'recharts'
          if (id.includes('@xyflow')) return 'xyflow'
          if (id.includes('lightweight-charts')) return 'lightweight-charts'
          if (
            id.includes('/wagmi') ||
            id.includes('@rainbow-me/rainbowkit') ||
            id.includes('@walletconnect') ||
            id.includes('metamask-sdk')
          ) {
            return 'evm-wallet'
          }
        },
      },
    },
  },
})
