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
  const userData = mkdtempSync(join(tmpdir(), 'big-browser-e2e-'))
  const site = await startSite()
  const app = await launchApp(userData)
  try {
    const page = await uiPage(app)
    await finishOnboarding(page)
    await page.getByTestId('new-tab').click()
    const field = (await overlayPage(app)).getByLabel('Search or enter address')
    await field.fill(site.url('/a'))
    await field.press('Enter')
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

test('the + menu is joined to its button', async () => {
  await withPage(async ({ page, overlay }) => {
    await plusButton(page).click()
    const connector = overlay.getByTestId('connector')
    await expect(connector).toBeVisible()
    // Past the menu's open animation and the button's transitions, so both boxes are at rest.
    await overlay.waitForFunction(
      () => document.querySelector('[data-testid="menu"]')?.getAnimations().length === 0,
    )
    await page.waitForFunction(
      () =>
        document
          .querySelector('[aria-label="New tab, space or settings"]')
          ?.getAnimations({ subtree: true }).length === 0,
    )

    const neck = await connector.boundingBox()
    const button = await plusButton(page).boundingBox()
    if (!neck || !button) throw new Error('connector or + button not found')
    expect(Math.abs(neck.x + neck.width / 2 - (button.x + button.width / 2))).toBeLessThanOrEqual(1)
    expect(Math.abs(neck.y + neck.height - button.y)).toBeLessThanOrEqual(1)
  })
})

test('menus animate out', async () => {
  await withPage(async ({ page, overlay }) => {
    await plusButton(page).click()
    const menu = overlay.getByTestId('menu')
    await expect(menu).toBeVisible()

    await overlay.keyboard.press('Escape')
    await expect(menu).toHaveAttribute('data-state', 'closing')
    await expect(menu).toHaveCount(0)
    await expect(plusButton(page)).toHaveAttribute('aria-expanded', 'false')
  })
})

test('the site menu is joined to its button', async () => {
  await withPage(async ({ page, overlay }) => {
    const button = page.getByRole('button', { name: 'Site menu' })
    await button.click()
    const connector = overlay.getByTestId('connector')
    await expect(connector).toBeVisible()
    await overlay.waitForFunction(
      () => document.querySelector('[data-testid="site-menu"]')?.getAnimations().length === 0,
    )
    await page.waitForFunction(
      () =>
        document.querySelector('[aria-label="Site menu"]')?.getAnimations({ subtree: true })
          .length === 0,
    )

    const neck = await connector.boundingBox()
    const box = await button.boundingBox()
    if (!neck || !box) throw new Error('connector or site menu button not found')
    expect(Math.abs(neck.x + neck.width / 2 - (box.x + box.width / 2))).toBeLessThanOrEqual(1)
    // The neck hangs from the button's bottom edge down to the card.
    expect(Math.abs(neck.y - (box.y + box.height))).toBeLessThanOrEqual(1)
  })
})
