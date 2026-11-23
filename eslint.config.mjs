import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: [
      'out/**',
      'release/**',
      'node_modules/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      // throwaway spike code, not part of the app
      'scripts/spikes/**',
      // vendored project skills
      '.claude/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  // Node side: main, preload, core, configs, tests
  {
    files: ['src/main/**', 'src/preload/**', 'src/core/**', 'tests/**', 'scripts/**', '*.config.*'],
    languageOptions: { globals: globals.node },
  },
  // core and shared are pure: no Electron, no React (see ADR-0001)
  {
    files: ['src/core/**', 'src/shared/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'electron', message: 'core/ and shared/ must stay Electron-free (ADR-0001).' },
            { name: 'react', message: 'core/ and shared/ must not depend on React.' },
          ],
        },
      ],
    },
  },
  // Renderer: browser only, talks to main exclusively through window.yaas
  {
    files: ['src/renderer/**'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'electron', message: 'Use window.yaas (preload bridge) instead.' }],
          patterns: [
            { group: ['node:*'], message: 'The renderer is sandboxed: no Node APIs.' },
            { group: ['@core/*'], message: 'The renderer must not import core; go through IPC.' },
          ],
        },
      ],
    },
  },
)
