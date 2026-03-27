import { readFileSync } from 'node:fs'
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const gitignorePatterns = readFileSync(new URL('./.gitignore', import.meta.url), 'utf8')
  .split(/\r?\n/u)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))

export default defineConfig([
  globalIgnores(gitignorePatterns),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
