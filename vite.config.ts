import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Config-time `process.env` alone skips `.env` / `.env.local` — load them explicitly.
  const env = loadEnv(mode, __dirname, '')
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = (env[k] || process.env[k] || '').trim()
      if (v) return v
    }
    return ''
  }

  const toreadorApiTarget =
    pick('TOREADOR_API_TARGET', 'VITE_TOREADOR_API_TARGET') || 'http://127.0.0.1:8010'

  return {
    // Served at https://app.grindurus.xyz/ (custom domain, root path).
    base: '/',
    plugins: [
      react(),
      nodePolyfills({
        include: ['buffer', 'crypto', 'stream', 'util'],
      }),
    ],
    server: {
      port: 3001,
      proxy: {
        // Toreador HTTP — GRAI grinders table (`GET /table`). Public; no API key.
        '/toreador-api': {
          target: toreadorApiTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (p) => p.replace(/^\/toreador-api/, ''),
        },
        // Official devnet RPC — TLS cert on api.devnet.solana.com is expired; browser blocks it directly.
        '/solana-devnet-rpc': {
          target: 'https://api.devnet.solana.com',
          changeOrigin: true,
          secure: false,
          ws: true,
          rewrite: (p) => p.replace(/^\/solana-devnet-rpc/, ''),
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
  }
})
