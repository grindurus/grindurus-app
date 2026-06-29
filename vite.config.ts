import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const githubPages = process.env.GITHUB_PAGES === 'true'

// https://vitejs.dev/config/
export default defineConfig({
  base: githubPages ? '/grindurus-app/' : '/',
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'crypto', 'stream'],
    }),
  ],
  server: {
    port: 3001,
  },
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
})
