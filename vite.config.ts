/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The project is one flat folder, so there is no public/ directory. This plugin
// serves these root files in dev and copies them into dist/ on build.
const ROOT_ASSETS: Record<string, string> = {
  '/sw.js': 'text/javascript',
  '/icon.svg': 'image/svg+xml',
  '/manifest.webmanifest': 'application/manifest+json'
}
const rootAssets = (): Plugin => ({
  name: 'root-assets',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const path = (req.url ?? '').split('?')[0]
      const type = ROOT_ASSETS[path]
      if (!type) return next()
      res.setHeader('Content-Type', type)
      res.end(readFileSync(`.${path}`))
    })
  },
  generateBundle() {
    for (const path of Object.keys(ROOT_ASSETS)) {
      this.emitFile({ type: 'asset', fileName: path.slice(1), source: readFileSync(`.${path}`) })
    }
  }
})

export default defineConfig({
  plugins: [react(), tailwindcss(), rootAssets()],
  publicDir: false,
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // keep the heavy 3D and chart libraries in their own cacheable chunks
        manualChunks(id: string) {
          if (id.includes('node_modules/three') || id.includes('@react-three')) return 'three'
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3')) return 'charts'
        }
      }
    }
  },
  // Unit and component tests (Playwright end-to-end tests are in e2e.spec.ts).
  test: {
    environment: 'jsdom',
    include: ['tests.test.tsx'],
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
    restoreMocks: true
  }
})
