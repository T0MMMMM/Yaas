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
    await page.getByRole('radio', { name: '#2BB673' }).click()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--accent')))
      .toBe('#2BB673')
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect(page.getByTestId('technical-setup')).toBeVisible()
    await page.getByRole('button', { name: 'Open YAAS' }).click()

    await expect(page.getByTestId('sidebar')).toBeVisible()
    await expect(page.getByTestId('empty-state')).toBeVisible()

    // The context bar only exists while a session is open.
    await expect(page.getByTestId('contextbar')).toHaveCount(0)
    await page.getByRole('button', { name: 'Fix login redirect' }).click()
    await expect(page.getByTestId('contextbar').getByTestId('context-indicator')).toBeVisible()

    // Settings: move the meters to the sidebar.
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await expect(page.getByTestId('settings')).toBeVisible()
    await page.getByRole('button', { name: 'Appearance' }).click()
    await page.getByRole('radio', { name: 'Sidebar' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('sidebar').getByTestId('context-indicator')).toBeVisible()
    await expect(page.getByTestId('contextbar').getByTestId('context-indicator')).toHaveCount(0)

    // The sidebar resizes by drag, never below its minimum width.
    const handle = await page.getByTestId('sidebar-resizer').boundingBox()
    if (!handle) throw new Error('resizer not found')
    await page.mouse.move(handle.x + 4, 400)
    await page.mouse.down()
    await page.mouse.move(20, 400, { steps: 5 })
    await page.mouse.up()
    await expect
      .poll(async () => (await page.getByTestId('sidebar').boundingBox())?.width)
      .toBe(200)

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

test('settings survive a relaunch', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'yaas-e2e-'))
  const launch = () =>
    electron.launch({
      args: [join(__dirname, '../../out/main/index.js')],
      env: { ...process.env, YAAS_USER_DATA: userData, YAAS_PROVIDER: 'fake' },
    })

  try {
    const first = await launch()
    const page = await first.firstWindow()
    await expect(page.getByTestId('visual-setup')).toBeVisible()
    await page.getByRole('radio', { name: '#2BB673' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByTestId('cli-status')).not.toHaveText(/Looking for/)
    await page.getByRole('button', { name: 'Open YAAS' }).click()
    await expect(page.getByTestId('sidebar')).toBeVisible()
    await first.close()

    const second = await launch()
    const again = await second.firstWindow()
    await expect(again.getByTestId('sidebar')).toBeVisible()
    await expect(again.getByTestId('onboarding')).toHaveCount(0)
    await expect
      .poll(() => again.evaluate(() => document.documentElement.style.getPropertyValue('--accent')))
      .toBe('#2BB673')
    await second.close()
  } finally {
    rmSync(userData, { recursive: true, force: true })
  }
})
