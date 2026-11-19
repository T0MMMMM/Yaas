import { defineConfig } from '@playwright/test'

// E2E runs against the built app (`npm run test:e2e` builds first) with the fake provider.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  reporter: process.env.CI ? 'github' : 'list',
  use: { trace: 'retain-on-failure' },
})
