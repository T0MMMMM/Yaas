import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { finishOnboarding, launchApp, uiPage } from './helpers'

// Only Windows draws its own window buttons (macOS keeps its traffic lights).
test.skip(process.platform !== 'win32', 'Windows only')

test('the window buttons hide until the pointer rests on the top edge', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'big-browser-e2e-'))
  const app = await launchApp(userData)
  try {
    const page = await uiPage(app)
    await finishOnboarding(page)

    // No native caption buttons: the window has no title bar overlay.
    const overlayVisible = await page.evaluate(
      () =>
        (navigator as Navigator & { windowControlsOverlay?: { visible: boolean } })
          .windowControlsOverlay?.visible ?? false,
    )
    expect(overlayVisible).toBe(false)

    const strip = page.getByTestId('window-controls')
    const maximize = page.getByRole('button', { name: 'Maximize' })
    await expect(strip).toHaveAttribute('data-open', 'false')
    await expect(maximize).toBeHidden()
    const closed = (await strip.boundingBox())?.height ?? 0

    // Resting on the margin opens it: it grows and the buttons come.
    const box = await strip.boundingBox()
    if (!box) throw new Error('no strip')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await expect(strip).toHaveAttribute('data-open', 'true')
    await expect(maximize).toBeVisible()
    await expect.poll(async () => (await strip.boundingBox())?.height ?? 0).toBeGreaterThan(closed)

    await maximize.click()
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMaximized()),
      )
      .toBe(true)
    await page.getByRole('button', { name: 'Restore' }).click()
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMaximized()),
      )
      .toBe(false)

    // Leaving closes it again after a moment (the window was resized: point at the margin anew).
    const restored = await strip.boundingBox()
    if (!restored) throw new Error('no strip')
    await page.mouse.move(restored.x + restored.width / 2, restored.y + restored.height / 2)
    await page.mouse.move(restored.x + restored.width / 2, 400)
    await expect(strip).toHaveAttribute('data-open', 'false')
    await expect(maximize).toBeHidden()
  } finally {
    await app.close().catch(() => undefined)
    rmSync(userData, { recursive: true, force: true })
  }
})

test('passing over the top edge opens nothing', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'big-browser-e2e-'))
  const app = await launchApp(userData)
  try {
    const page = await uiPage(app)
    await finishOnboarding(page)
    const strip = page.getByTestId('window-controls')
    const box = await strip.boundingBox()
    if (!box) throw new Error('no strip')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.move(box.x + box.width / 2, 400)
    await page.waitForTimeout(600)
    await expect(strip).toHaveAttribute('data-open', 'false')
  } finally {
    await app.close().catch(() => undefined)
    rmSync(userData, { recursive: true, force: true })
  }
})
