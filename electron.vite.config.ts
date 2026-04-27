import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        // better-sqlite3 es modulo nativo: NO bundlear, dejar require dinamico.
        // electron-log y node-cron tambien quedan externos.
        external: ['better-sqlite3', 'node-cron', 'electron-log']
      },
      // Soporte para `import SQL from './schema.sql?raw'` en el bundle main.
      assetsInclude: ['**/*.sql']
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
