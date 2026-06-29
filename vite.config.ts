import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  // Served at https://app.grindurus.xyz/ (custom domain, root path).
  base: '/',
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
