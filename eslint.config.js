import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // shadcn/ui-style primitives intentionally co-export non-component values
    // (cva variant fns, Radix sub-part aliases, hooks) alongside components —
    // that's the established pattern for this file group, not a refresh bug.
    files: [
      'src/components/ui/**/*.{ts,tsx}',
      'src/components/layout/breadcrumb-context.tsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
