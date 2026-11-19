import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'

test('first launch shows onboarding, then the sidebar', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'yaas-e2e-'))
  const app = await electron.launch({
    args: [join(__dirname, '../../out/main/index.js')],
    env: { ...process.env, YAAS_USER_DATA: userData, YAAS_PROVIDER: 'fake' },
  })

  try {
    const page = await app.firstWindow()
    await expect(page.getByTestId('onboarding')).toHaveAttribute('data-stage', 'intro')

    // The logo intro leads to the visual setup by itself.
    await expect(page.getByTestId('visual-setup')).toBeVisible()
    await page.getByRole('button', { name: '#2BB673' }).click()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--accent')))
      .toBe('#2BB673')
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect(page.getByTestId('technical-setup')).toBeVisible()
    await page.getByRole('button', { name: 'Open YAAS' }).click()

    await expect(page.getByTestId('sidebar')).toBeVisible()
    await expect(page.getByTestId('empty-state')).toBeVisible()

    // Context indicator only while a session is open.
    await expect(page.getByTestId('context-indicator')).toHaveCount(0)
    await page.getByRole('button', { name: 'Fix login redirect' }).click()
    await expect(page.getByTestId('context-indicator')).toBeVisible()

    // The renderer is isolated: no Node, only the bridge.
    const globals = await page.evaluate(() => ({
      require: typeof (globalThis as { require?: unknown }).require,
      yaas: typeof (globalThis as { yaas?: { invoke?: unknown } }).yaas?.invoke,
    }))
    expect(globals).toEqual({ require: 'undefined', yaas: 'function' })
  } finally {
    await app.close()
    rmSync(userData, { recursive: true, force: true })
  }
})
