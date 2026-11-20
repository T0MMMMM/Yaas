import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { finishOnboarding, launchApp, uiPage } from './helpers'

const windows = process.platform === 'win32'
const mac = process.platform === 'darwin'

/**
 * Once the top margin is open, main watches the real pointer (the margin is a drag region). Tests
 * drive Playwright's synthetic mouse, so main's pointer is stubbed: `pointerInBand(true)` puts it
 * in the window's top band, `false` far away.
 */
async function stubPointer(app: ElectronApplication): Promise<(inBand: boolean) => Promise<void>> {
  await app.evaluate(({ screen }) => {
    const state = globalThis as { fakePointer?: { x: number; y: number } }
    screen.getCursorScreenPoint = () => state.fakePointer ?? { x: -10000, y: -10000 }
  })
  return (inBand) =>
    app.evaluate(({ BrowserWindow }, inBand) => {
      const bounds = BrowserWindow.getAllWindows()[0]?.getBounds()
      const state = globalThis as { fakePointer?: { x: number; y: number } }
      state.fakePointer =
        inBand && bounds ? { x: bounds.x + 200, y: bounds.y + 4 } : { x: -10000, y: -10000 }
    }, inBand)
}

/** A fresh app (onboarding done), its UI page and the top margin. */
async function withWindow(
  run: (ctx: { app: ElectronApplication; page: Page }) => Promise<void>,
): Promise<void> {
  const userData = mkdtempSync(join(tmpdir(), 'big-browser-e2e-'))
  const app = await launchApp(userData)
  try {
    const page = await uiPage(app)
    await finishOnboarding(page)
    await run({ app, page })
  } finally {
    await app.close().catch(() => undefined)
    rmSync(userData, { recursive: true, force: true })
  }
}

const appRegion = (page: Page, testId: string) =>
  page
    .getByTestId(testId)
    .evaluate((el) => getComputedStyle(el).getPropertyValue('-webkit-app-region'))

test('the window buttons hide until the pointer rests on the top edge', async () => {
  test.skip(!windows, 'Windows draws its own window buttons')
  await withWindow(async ({ app, page }) => {
    const pointerInBand = await stubPointer(app)

    // No native caption buttons: the window has no title bar overlay.
    const overlayVisible = await page.evaluate(
      () =>
        (navigator as Navigator & { windowControlsOverlay?: { visible: boolean } })
          .windowControlsOverlay?.visible ?? false,
    )
    expect(overlayVisible).toBe(false)

    const strip = page.getByTestId('window-controls')
    // The margin runs along the whole top of the window, above the sidebar too.
    const width = await page.evaluate(() => window.innerWidth)
    expect(Math.round((await strip.boundingBox())?.width ?? 0)).toBe(width)
    const maximize = page.getByRole('button', { name: 'Maximize' })
    await expect(strip).toHaveAttribute('data-open', 'false')
    await expect(maximize).toBeHidden()
    // Closed it is not a drag region: the hover has to reach the page.
    expect(await appRegion(page, 'window-controls')).not.toBe('drag')
    const closed = (await strip.boundingBox())?.height ?? 0

    // Resting on the margin opens it: it grows, the buttons come and it drags the window.
    const box = await strip.boundingBox()
    if (!box) throw new Error('no strip')
    await pointerInBand(true)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await expect(strip).toHaveAttribute('data-open', 'true')
    await expect(maximize).toBeVisible()
    await expect.poll(async () => (await strip.boundingBox())?.height ?? 0).toBeGreaterThan(closed)
    expect(await appRegion(page, 'window-controls')).toBe('drag')
    expect(
      await maximize.evaluate((el) => getComputedStyle(el).getPropertyValue('-webkit-app-region')),
    ).toBe('no-drag')

    // The page gets no pointer events over a drag region: leaving it in the DOM closes nothing
    // while main still sees the pointer in the top band.
    await page.mouse.move(box.x + box.width / 2, 400)
    await page.waitForTimeout(700)
    await expect(strip).toHaveAttribute('data-open', 'true')

    const maximized = () =>
      app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMaximized())
    await maximize.click()
    await expect.poll(maximized).toBe(true)
    await page.getByRole('button', { name: 'Restore' }).click()
    await expect.poll(maximized).toBe(false)

    // Main sees the pointer leave the top band: it closes a moment later.
    await pointerInBand(false)
    await expect(strip).toHaveAttribute('data-open', 'false')
    await expect(maximize).toBeHidden()
  })
})

test('passing over the top edge opens nothing', async () => {
  test.skip(!windows && !mac, 'Linux keeps its native title bar')
  await withWindow(async ({ page }) => {
    const strip = page.getByTestId('window-controls')
    const box = await strip.boundingBox()
    if (!box) throw new Error('no strip')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.move(box.x + box.width / 2, 400)
    await page.waitForTimeout(600)
    await expect(strip).toHaveAttribute('data-open', 'false')
  })
})

test('macOS shows its traffic lights while the pointer rests on the top edge', async () => {
  test.skip(!mac, 'macOS only')
  await withWindow(async ({ app, page }) => {
    const pointerInBand = await stubPointer(app)
    // Record what main does to the traffic lights (they are not observable otherwise).
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
      const calls: boolean[] = []
      ;(globalThis as { controlCalls?: boolean[] }).controlCalls = calls
      if (win) win.setWindowButtonVisibility = (visible: boolean) => void calls.push(visible)
    })
    const lastCall = () =>
      app.evaluate(() => (globalThis as { controlCalls?: boolean[] }).controlCalls?.at(-1))

    const strip = page.getByTestId('window-controls')
    const box = await strip.boundingBox()
    if (!box) throw new Error('no strip')
    await pointerInBand(true)
    await page.mouse.move(box.x + 40, box.y + box.height / 2)
    await expect(strip).toHaveAttribute('data-open', 'true')
    await expect.poll(lastCall).toBe(true)

    await pointerInBand(false)
    await expect(strip).toHaveAttribute('data-open', 'false')
    await expect.poll(lastCall).toBe(false)
  })
})
