import path from 'node:path'
// From `vitest/config`, not `vite`: the `test` block below is vitest's, and
// vite's own `defineConfig` does not type it — which made `tsc -b` (and so
// `pnpm build`) fail while `vitest run` was perfectly happy.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    // Pure-logic suites need no DOM, but the form-preservation test renders a
    // real form and types into it — the guarantee it checks is about what the
    // merchant still sees after a rejected save, which only a DOM can answer.
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
