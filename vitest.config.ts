import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/renderer/src/__tests__/setup.ts'],
    include: ['src/renderer/src/__tests__/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/renderer/src/services/**/*.ts', 'src/renderer/src/hooks/**/*.ts', 'src/renderer/src/components/**/*.tsx']
    }
  }
})
