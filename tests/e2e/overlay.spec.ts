import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { startSite } from './fixtures/site'
import { finishOnboarding, launchApp, overlayPage, uiPage } from './helpers'

type Site = Awaited<ReturnType<typeof startSite>>

/** A fresh app (onboarding done) showing the fixture page /a in a tab. */
async function withPage(
  run: (ctx: { app: ElectronApplication; page: Page; overlay: Page; site: Site }) => Promise<void>,
): Promise<void> {
  const userData = mkdtempSync(join(tmpdir(), 'acab-e2e-'))
  const site = await startSite()
  const app = await launchApp(userData)
  try {
    const page = await uiPage(app)
    await finishOnboarding(page)
    await page.getByTestId('new-tab').click()
    const address = page.getByLabel('Address')
    await address.fill(site.url('/a'))
    await address.press('Enter')
    await expect(page.getByTestId('tab')).toHaveText(['Page A'])
    await run({ app, page, overlay: await overlayPage(app), site })
  } finally {
    await app.close().catch(() => undefined)
    await site.close()
    rmSync(userData, { recursive: true, force: true })
  }
}

const plusButton = (page: Page) => page.getByRole('button', { name: 'New tab, space or settings' })

test('the + menu floats over the page', async () => {
  await withPage(async ({ page, overlay }) => {
    await plusButton(page).click()
    await expect(plusButton(page)).toHaveAttribute('aria-expanded', 'true')
    const settings = overlay.getByRole('menuitem', { name: 'Settings' })
    await expect(settings).toBeVisible()

    // The overlay is drawn above the page view: the menu can extend past the sidebar.
    const menu = await overlay.getByTestId('menu').boundingBox()
    const sidebar = await page.getByTestId('sidebar').boundingBox()
    if (!menu || !sidebar) throw new Error('menu or sidebar not found')
    expect(menu.x + menu.width).toBeGreaterThan(sidebar.x + sidebar.width)

    await settings.click()
    await expect(page.getByTestId('settings')).toBeVisible()
    await expect(plusButton(page)).toHaveAttribute('aria-expanded', 'false')
  })
})

test('a click outside closes the popover', async () => {
  await withPage(async ({ app, page, overlay, site }) => {
    await plusButton(page).click()
    await expect(overlay.getByTestId('menu')).toBeVisible()

    const size = await overlay.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }))
    await overlay.mouse.click(size.w / 2, size.h / 2)

    await expect(overlay.getByTestId('menu')).toHaveCount(0)
    await expect(plusButton(page)).toHaveAttribute('aria-expanded', 'false')
    const urls = await app.evaluate(({ webContents }) =>
      webContents.getAllWebContents().map((w) => w.getURL()),
    )
    expect(urls).toContain(site.url('/a'))
    await expect(page.getByTestId('url-rest')).toHaveText('/a')
  })
})

test('the overlay follows a resize', async () => {
  await withPage(async ({ app, page, overlay }) => {
    await plusButton(page).click()
    await expect(overlay.getByTestId('menu')).toBeVisible()

    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1000, 700))

    const bounds = () =>
      app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0]
        if (!win) return null
        const [width, height] = win.getContentSize()
        const view = win.contentView.children.find(
          (v) =>
            'webContents' in v &&
            (v.webContents as Electron.WebContents).getURL().endsWith('#overlay'),
        )
        return { view: view?.getBounds(), content: { x: 0, y: 0, width, height } }
      })
    await expect
      .poll(async () => {
        const b = await bounds()
        return JSON.stringify(b?.view) === JSON.stringify(b?.content)
      })
      .toBe(true)
  })
})
