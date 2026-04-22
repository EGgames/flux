import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

/**
 * Plugin que inyecta el mock de electronAPI ANTES de main.tsx.
 * Reemplaza también el CSP que bloquea scripts inline.
 */
function injectElectronMock(): Plugin {
  return {
    name: 'inject-electron-mock',
    transformIndexHtml(html) {
      // Relajar CSP para E2E (permite cargar el mock desde /public)
      html = html.replace(
        /content="default-src[^"]+"/,
        `content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src *; connect-src *"`
      )
      // Inyectar script mock ANTES de main.tsx
      return html.replace(
        '<script type="module" src="/src/main.tsx"></script>',
        '<script src="/electron-api-mock.js"></script>\n    <script type="module" src="/src/main.tsx"></script>'
      )
    }
  }
}

/**
 * Config Vite standalone para E2E tests (renderer only, sin Electron).
 * Uso: npx vite --config vite.config.e2e.ts
 */
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  plugins: [react(), injectElectronMock()],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
})
