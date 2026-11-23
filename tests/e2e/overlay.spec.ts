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

    // The overlay is drawn above the page view: the menu can extend past the sidebar (once it has
    // grown out of its button).
    const sidebar = await page.getByTestId('sidebar').boundingBox()
    if (!sidebar) throw new Error('sidebar not found')
    await expect
      .poll(async () => {
        const menu = await overlay.getByTestId('menu').boundingBox()
        return menu ? menu.x + menu.width : 0
      })
      .toBeGreaterThan(sidebar.x + sidebar.width)

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
    // Smooth bump leaves a small breathing gap before the button (never touches it).
    const gap = button.y - (neck.y + neck.height)
    expect(gap).toBeGreaterThanOrEqual(1)
    expect(gap).toBeLessThanOrEqual(6)
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
    // Smooth bump leaves a small breathing gap below the button (never touches it).
    const gap = neck.y - (box.y + box.height)
    expect(gap).toBeGreaterThanOrEqual(1)
    expect(gap).toBeLessThanOrEqual(6)
  })
})

test('the tab menu is drawn', async () => {
  await withPage(async ({ page, overlay }) => {
    const row = page.getByTestId('today').getByTestId('tab').getByRole('button', { name: 'Page A' })
    const box = await row.boundingBox()
    if (!box) throw new Error('tab row not found')
    const at = { x: Math.round(box.x + 20), y: Math.round(box.y + box.height / 2) }
    await row.click({ button: 'right', position: { x: 20, y: box.height / 2 } })

    const menu = overlay.getByTestId('menu')
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem')).toHaveText([
      'Pin',
      'Add to Favourites',
      'Move to Folder',
      'Copy Link',
      'Duplicate',
      'Close',
    ])
    // Opened at the pointer, with no neck: its corner sits on the click (once grown).
    await expect(overlay.getByTestId('connector')).toHaveCount(0)
    await overlay.waitForFunction(
      () => document.querySelector('[data-testid="menu"]')?.getAnimations().length === 0,
    )
    const card = await menu.boundingBox()
    expect(Math.abs((card?.x ?? 0) - at.x)).toBeLessThanOrEqual(1)
    expect(Math.abs((card?.y ?? 0) - at.y)).toBeLessThanOrEqual(1)

    // A submenu opens beside its row on hover.
    await menu.getByRole('menuitem', { name: 'Move to Folder' }).hover()
    const submenu = overlay.getByTestId('submenu')
    await expect(submenu.getByRole('menuitem', { name: 'New Folder…' })).toBeVisible()
    const subBox = await submenu.boundingBox()
    expect(subBox?.x ?? 0).toBeGreaterThan((card?.x ?? 0) + (card?.width ?? 0) - 1)
    // Hovering another row closes it.
    await menu.getByRole('menuitem', { name: 'Copy Link' }).hover()
    await expect(submenu).toHaveCount(0)

    await menu.getByRole('menuitem', { name: 'Pin' }).click()
    await expect(menu).toHaveCount(0)
    await expect(page.getByTestId('pinned').getByTestId('tab')).toHaveText(['Page A'])
  })
})

test('a submenu stays open while the pointer crosses rows into it', async () => {
  await withPage(async ({ page, overlay }) => {
    await page.evaluate(() => window.bigBrowser.invoke('browser.createFolder', { name: 'Box' }))
    await page.getByTestId('tab').getByRole('button', { name: 'Page A' }).click({ button: 'right' })
    const menu = overlay.getByTestId('menu')
    const parent = menu.getByRole('menuitem', { name: 'Move to Folder' })
    await parent.hover()
    const submenu = overlay.getByTestId('submenu')
    const target = submenu.getByRole('menuitem', { name: 'New Folder…' })
    await expect(target).toBeVisible()
    const from = await parent.boundingBox()
    const to = await target.boundingBox()
    if (!from || !to) throw new Error('menu rows not found')
    // Diagonally down into the submenu: the way crosses Copy Link (and Duplicate) below.
    await overlay.mouse.move(from.x + 10, from.y + from.height / 2)
    await overlay.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 })
    await expect(submenu).toBeVisible()
    await target.click()
    await expect(menu).toHaveCount(0)
    await expect(page.getByTestId('pinned').getByTestId('folder')).toHaveCount(2)
  })
})

test('the tab menu works from the keyboard', async () => {
  await withPage(async ({ page, overlay }) => {
    await page.getByTestId('tab').getByRole('button', { name: 'Page A' }).click({ button: 'right' })
    const menu = overlay.getByTestId('menu')
    await expect(menu).toBeVisible()
    await overlay.keyboard.press('ArrowDown')
    await expect(menu.getByRole('menuitem', { name: 'Pin' })).toBeFocused()
    await overlay.keyboard.press('ArrowDown')
    await overlay.keyboard.press('ArrowDown')
    await overlay.keyboard.press('ArrowRight')
    const submenu = overlay.getByTestId('submenu')
    await expect(submenu.getByRole('menuitem', { name: 'New Folder…' })).toBeFocused()
    await overlay.keyboard.press('ArrowLeft')
    await expect(submenu).toHaveCount(0)
    await expect(menu.getByRole('menuitem', { name: 'Move to Folder' })).toBeFocused()
    await overlay.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(page.getByTestId('today').getByTestId('tab')).toHaveText(['Page A'])
  })
})

test("a vanished tab's menu item does nothing", async () => {
  await withPage(async ({ app, page, overlay }) => {
    const errors: string[] = []
    overlay.on('pageerror', (error) => errors.push(error.message))
    overlay.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    app.process().stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      if (/error/i.test(text)) errors.push(text)
    })

    const tab = page.getByTestId('tab').getByRole('button', { name: 'Page A' })
    await tab.click({ button: 'right' })
    const menu = overlay.getByTestId('menu')
    await expect(menu).toBeVisible()

    // Closed elsewhere (a shortcut, another window) while its menu is open.
    await page.evaluate(async () => {
      const state = await window.bigBrowser.invoke('browser.state')
      for (const t of state.tabs)
        await window.bigBrowser.invoke('browser.closeTab', { tabId: t.id })
    })
    await expect(page.getByTestId('tab')).toHaveCount(0)

    await menu.getByRole('menuitem', { name: 'Pin' }).click()
    await expect(menu).toHaveCount(0)
    await expect(page.getByTestId('pinned').getByTestId('tab')).toHaveCount(0)
    expect(errors).toEqual([])
  })
})
