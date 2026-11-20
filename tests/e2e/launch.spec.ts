import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { launchApp, uiPage } from './helpers'

test('first launch shows onboarding, then the browser', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'acab-e2e-'))
  const app = await launchApp(userData)

  try {
    const page = await app.firstWindow()
    await expect(page.getByTestId('onboarding')).toHaveAttribute('data-stage', 'intro')

    // The logo intro leads to the visual setup by itself.
    await expect(page.getByTestId('visual-setup')).toBeVisible()
    await page.getByRole('radio', { name: '#2BB673' }).click()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--accent')))
      .toBe('#2BB673')
    await page.getByRole('button', { name: 'Open ACAB' }).click()

    await expect(page.getByTestId('sidebar')).toBeVisible()
    await expect(page.getByTestId('empty-state')).toBeVisible()

    await expect(page.getByTestId('address-bar')).toBeVisible()

    // Settings open from the + menu and close with Escape.
    await page.getByRole('button', { name: 'New tab, space or settings' }).click()
    await page.getByRole('menuitem', { name: 'Settings' }).click()
    await expect(page.getByTestId('settings')).toBeVisible()
    // Only the browser sections show: no accounts, sessions, handoff or crew.
    await expect(
      page.getByRole('navigation', { name: 'Settings sections' }).getByRole('button'),
    ).toHaveText(['General', 'Appearance', 'Shortcuts', 'Privacy & data', 'Advanced', 'About'])
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('settings')).toHaveCount(0)

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
      acab: typeof (globalThis as { acab?: { invoke?: unknown } }).acab?.invoke,
    }))
    expect(globals).toEqual({ require: 'undefined', acab: 'function' })
  } finally {
    await app.close()
    rmSync(userData, { recursive: true, force: true })
  }
})

test('settings survive a relaunch', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'acab-e2e-'))
  const launch = () => launchApp(userData)

  try {
    const first = await launch()
    const page = await uiPage(first)
    await expect(page.getByTestId('visual-setup')).toBeVisible()
    await page.getByRole('radio', { name: '#2BB673' }).click()
    await page.getByRole('button', { name: 'Open ACAB' }).click()
    await expect(page.getByTestId('sidebar')).toBeVisible()
    await first.close()

    const second = await launch()
    const again = await uiPage(second)
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

test('appearance settings toggle askew cards and attach the address bar', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'acab-e2e-'))
  const app = await launchApp(userData)
  try {
    const page = await uiPage(app)
    await page.getByRole('button', { name: 'Open ACAB' }).click()
    const root = (name: string) =>
      page.evaluate((key) => document.documentElement.dataset[key], name)
    await expect.poll(() => root('askew')).toBe('on')
    await expect.poll(() => root('contextbar')).toBe('card')

    await page.getByRole('button', { name: 'New tab, space or settings' }).click()
    await page.getByRole('menuitem', { name: 'Settings' }).click()
    await page
      .getByRole('navigation', { name: 'Settings sections' })
      .getByRole('button', { name: 'Appearance' })
      .click()
    await page.getByRole('switch', { name: 'Askew cards' }).click()
    await page.getByRole('radio', { name: 'Attached' }).click()

    await expect.poll(() => root('askew')).toBe('off')
    await expect.poll(() => root('contextbar')).toBe('attached')
  } finally {
    await app.close()
    rmSync(userData, { recursive: true, force: true })
  }
})
