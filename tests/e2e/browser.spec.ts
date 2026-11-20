import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { startSite } from './fixtures/site'
import { finishOnboarding, launchApp, overlayPage, uiPage } from './helpers'

type Site = Awaited<ReturnType<typeof startSite>>

/** A fresh app (onboarding done) and the local site, torn down after `run`. */
async function withBrowser(
  run: (ctx: {
    app: ElectronApplication
    page: Page
    site: Site
    userData: string
  }) => Promise<void>,
): Promise<void> {
  const userData = mkdtempSync(join(tmpdir(), 'acab-e2e-'))
  const site = await startSite()
  const app = await launchApp(userData)
  try {
    // The overlay and tab views are web contents too: pick the UI by its bridge.
    const page = await uiPage(app)
    await finishOnboarding(page)
    await run({ app, page, site, userData })
  } finally {
    await app.close().catch(() => undefined)
    await site.close()
    rmSync(userData, { recursive: true, force: true })
  }
}

/** Types into the address bar (opening it if needed) and presses Enter. */
async function go(page: Page, url: string): Promise<void> {
  const address = page.getByLabel('Address')
  if (!(await address.isVisible())) await page.getByTestId('url').click()
  await address.fill(url)
  await address.press('Enter')
}

/** Opens a tab from the sidebar and loads `url` in it. */
async function openTab(page: Page, url: string): Promise<void> {
  await page.getByTestId('new-tab').click()
  await expect(page.getByLabel('Address')).toBeFocused()
  await go(page, url)
}

/** Bounds of the page view main currently shows, or undefined when none is visible. */
const shownView = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]
      ?.contentView.children.find((v) => v.getVisible())
      ?.getBounds(),
  )

test('open, navigate, go back', async () => {
  await withBrowser(async ({ page, site }) => {
    const bar = page.getByTestId('address-bar')
    const port = new URL(site.url('/')).port

    await openTab(page, site.url('/a'))
    await expect(page.getByTestId('tab')).toHaveText(['Page A'])
    await expect(page.getByTestId('url-host')).toHaveText(`127.0.0.1:${port}`)
    await expect(page.getByTestId('url-rest')).toHaveText('/a')
    await expect(bar).toHaveCSS('background-color', 'rgb(18, 52, 86)')
    await expect(bar).toHaveCSS('color', 'rgb(255, 255, 255)')

    await go(page, site.url('/b'))
    await expect(page.getByTestId('tab')).toHaveText(['Page B'])
    await expect(bar).toHaveCSS('color', 'rgb(0, 0, 0)')

    await go(page, site.url('/c'))
    await expect(page.getByTestId('tab')).toHaveText(['Page C'])
    await expect.poll(() => bar.evaluate((el) => el.style.backgroundColor)).toBe('')

    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByTestId('tab')).toHaveText(['Page B'])
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByTestId('tab')).toHaveText(['Page A'])
  })
})

test('a popup opens as a tab in the same space', async () => {
  await withBrowser(async ({ app, page, site }) => {
    await openTab(page, site.url('/a'))
    await expect(page.getByTestId('tab')).toHaveText(['Page A'])

    await app.evaluate(({ webContents }) =>
      webContents
        .getAllWebContents()
        .find((w) => w.getURL().endsWith('/a'))
        ?.executeJavaScript("document.getElementById('pop').click()"),
    )
    await expect(page.getByTestId('tab')).toHaveText(['Page A', 'Page B'])
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1)
  })
})

test('close tabs down to the empty state', async () => {
  await withBrowser(async ({ page }) => {
    await expect(page.getByTestId('empty-state')).toBeVisible()
    await page.getByTestId('new-tab').click()
    await page.getByTestId('new-tab').click()
    await expect(page.getByTestId('tab')).toHaveCount(2)
    await expect(page.getByTestId('empty-state')).toHaveCount(0)

    await page.getByRole('button', { name: 'Close tab' }).first().click()
    await expect(page.getByTestId('tab')).toHaveCount(1)
    await page.getByRole('button', { name: 'Close tab' }).click()
    await expect(page.getByTestId('tab')).toHaveCount(0)
    await expect(page.getByTestId('empty-state')).toBeVisible()
  })
})

test('page follows the card', async () => {
  await withBrowser(async ({ app, page }) => {
    await page.getByTestId('new-tab').click()
    await expect.poll(() => shownView(app)).toBeTruthy()

    const handle = await page.getByTestId('sidebar-resizer').boundingBox()
    if (!handle) throw new Error('resizer not found')
    await page.mouse.move(handle.x + 4, 400)
    await page.mouse.down()
    await page.mouse.move(handle.x + 84, 400, { steps: 5 })
    await page.mouse.up()

    const slot = async () => {
      const box = await page.getByTestId('page-slot').boundingBox()
      if (!box) throw new Error('page slot not found')
      return {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      }
    }
    await expect
      .poll(async () => (await page.getByTestId('sidebar').boundingBox())?.width)
      .toBeGreaterThan(300)
    await expect
      .poll(async () => JSON.stringify(await shownView(app)))
      .toBe(JSON.stringify(await slot()))
  })
})

test('settings hide the page', async () => {
  await withBrowser(async ({ app, page }) => {
    await page.getByTestId('new-tab').click()
    await expect.poll(() => shownView(app)).toBeTruthy()

    await page.getByRole('button', { name: 'New tab, space or settings' }).click()
    await (await overlayPage(app)).getByRole('menuitem', { name: 'Settings' }).click()
    await expect(page.getByTestId('settings')).toBeVisible()
    await expect.poll(() => shownView(app)).toBeUndefined()

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('settings')).toHaveCount(0)
    await expect.poll(() => shownView(app)).toBeTruthy()
  })
})

test('the + menu opens over the page in liquid glass', async () => {
  await withBrowser(async ({ app, page }) => {
    await page.evaluate(() => window.acab.invoke('settings.update', { transparency: 1 }))
    // Liquid glass only exists where the platform supports it (macOS, Windows 11).
    const glassSupported = await page.evaluate(
      async () => (await window.acab.invoke('app.info')).glassSupported,
    )
    const overlay = await overlayPage(app)
    if (glassSupported) {
      await expect(overlay.locator('html')).toHaveAttribute('data-glass', 'liquid')
    }

    await page.getByRole('button', { name: 'New tab, space or settings' }).click()
    await expect(overlay.getByTestId('menu')).toBeVisible()
    await overlay.getByRole('menuitem', { name: 'Settings' }).click()
    await expect(page.getByTestId('settings')).toBeVisible()
  })
})

test('spaces keep their own tabs', async () => {
  await withBrowser(async ({ app, page, site }) => {
    await openTab(page, site.url('/a'))
    await expect(page.getByTestId('tab')).toHaveText(['Page A'])

    await page.getByRole('button', { name: 'New tab, space or settings' }).click()
    await (await overlayPage(app)).getByRole('menuitem', { name: 'New space' }).click()
    const spaces = page.getByRole('tablist', { name: 'Spaces' }).getByRole('tab')
    await expect(spaces).toHaveCount(2)
    await expect(spaces.nth(1)).toHaveAttribute('aria-label', 'Space 2')
    await expect(spaces.nth(1)).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('tab')).toHaveCount(0)

    await openTab(page, site.url('/c'))
    await expect(page.getByTestId('tab')).toHaveText(['Page C'])

    await spaces.first().click()
    await expect(page.getByTestId('tab')).toHaveText(['Page A'])
  })
})

test('tabs survive a relaunch', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'acab-e2e-'))
  const site = await startSite()
  try {
    const first = await launchApp(userData)
    const page = await uiPage(first)
    await finishOnboarding(page)
    await openTab(page, site.url('/a'))
    await expect(page.getByTestId('tab')).toHaveText(['Page A'])
    await openTab(page, site.url('/b'))
    await expect(page.getByTestId('tab')).toHaveText(['Page A', 'Page B'])
    await first.close()

    const second = await launchApp(userData)
    try {
      const again = await uiPage(second)
      await expect(again.getByTestId('tab')).toHaveText(['Page A', 'Page B'])
      await expect(again.getByTestId('tab').nth(1).getByRole('button').first()).toHaveAttribute(
        'aria-current',
        'page',
      )
      await expect(again.getByTestId('url-rest')).toHaveText('/b')
    } finally {
      await second.close()
    }
  } finally {
    await site.close()
    rmSync(userData, { recursive: true, force: true })
  }
})

test('restored tabs stay dim until visited', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'acab-e2e-'))
  const site = await startSite()
  try {
    const first = await launchApp(userData)
    const page = await uiPage(first)
    await finishOnboarding(page)
    await openTab(page, site.url('/a'))
    await openTab(page, site.url('/b'))
    await expect(page.getByTestId('tab')).toHaveText(['Page A', 'Page B'])
    await first.close()

    const second = await launchApp(userData)
    try {
      const again = await uiPage(second)
      const tabs = again.getByTestId('tab')
      await expect(tabs).toHaveText(['Page A', 'Page B'])
      await expect(tabs.nth(0).getByRole('button').first()).toHaveAttribute('data-loaded', 'false')
      await expect(tabs.nth(1).getByRole('button').first()).toHaveAttribute('data-loaded', 'true')

      await tabs.nth(0).getByRole('button').first().click()
      await expect(tabs.nth(0).getByRole('button').first()).toHaveAttribute('data-loaded', 'true')
    } finally {
      await second.close()
    }
  } finally {
    await site.close()
    rmSync(userData, { recursive: true, force: true })
  }
})

test('shortcuts work while a page has focus', async () => {
  await withBrowser(async ({ app, page, site }) => {
    const clickMenu = (id: string) =>
      app.evaluate(
        ({ Menu }, itemId) => Menu.getApplicationMenu()?.getMenuItemById(itemId)?.click(),
        id,
      )

    await openTab(page, site.url('/a'))
    await expect(page.getByTestId('tab')).toHaveText(['Page A'])

    // Give the page focus, as a user would after clicking into it.
    await app.evaluate(({ webContents }) =>
      webContents
        .getAllWebContents()
        .find((w) => w.getURL().endsWith('/a'))
        ?.executeJavaScript('document.body.focus()'),
    )

    await clickMenu('newTab')
    await expect(page.getByTestId('tab')).toHaveCount(2)
    await expect(page.getByLabel('Address')).toBeFocused()
    await expect(page.getByTestId('tab').nth(1).getByRole('button').first()).toHaveAttribute(
      'aria-current',
      'page',
    )

    await clickMenu('closeTab')
    await expect(page.getByTestId('tab')).toHaveCount(1)
  })
})
