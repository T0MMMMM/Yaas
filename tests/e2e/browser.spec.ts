import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { startSite } from './fixtures/site'
import { finishOnboarding, launchApp, overlayPage, rightClickPage, uiPage } from './helpers'

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
  const userData = mkdtempSync(join(tmpdir(), 'big-browser-e2e-'))
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

/** Opens a tab from the sidebar's New tab row: it shows the command field, which loads `url`. */
async function openTab(app: ElectronApplication, page: Page, url: string): Promise<void> {
  const tabs = await page.getByTestId('tab').count()
  await page.getByTestId('new-tab').click()
  const field = (await overlayPage(app)).getByLabel('Search or enter address')
  await expect(field).toBeFocused()
  await field.fill(url)
  await field.press('Enter')
  await expect(page.getByTestId('tab')).toHaveCount(tabs + 1)
}

/** Opens a blank tab straight through the bridge (the UI only opens tabs with an address). */
async function blankTab(page: Page): Promise<void> {
  await page.evaluate(() => window.bigBrowser.invoke('browser.openTab', {}))
}

/** Bounds of the page view main currently shows, or undefined when none is visible. */
const shownView = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]
      ?.contentView.children.find((v) => v.getVisible())
      ?.getBounds(),
  )

/** Clicks an application menu item by id, as its accelerator would. */
const clickMenu = (app: ElectronApplication, id: string) =>
  app.evaluate(
    ({ Menu }, itemId) => Menu.getApplicationMenu()?.getMenuItemById(itemId)?.click(),
    id,
  )

/** The browser model and runtime, as main sends them to the UI. */
const browserState = (page: Page) => page.evaluate(() => window.bigBrowser.invoke('browser.state'))

test('open, navigate, go back', async () => {
  await withBrowser(async ({ app, page, site }) => {
    const bar = page.getByTestId('address-bar')
    const port = new URL(site.url('/')).port

    await openTab(app, page, site.url('/a'))
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
    await openTab(app, page, site.url('/a'))
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
    await blankTab(page)
    await blankTab(page)
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
    await blankTab(page)
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

test('the sidebar snaps to icons when dragged narrow', async () => {
  await withBrowser(async ({ app, page }) => {
    await blankTab(page)
    await expect.poll(() => shownView(app)).toBeTruthy()
    const sidebar = page.getByTestId('sidebar')
    const dragTo = async (x: number) => {
      const handle = await page.getByTestId('sidebar-resizer').boundingBox()
      if (!handle) throw new Error('resizer not found')
      await page.mouse.move(handle.x + 4, 400)
      await page.mouse.down()
      await page.mouse.move(x, 400, { steps: 5 })
      await page.mouse.up()
    }

    await dragTo(80)
    await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(72)
    await expect(sidebar).toHaveAttribute('data-compact', 'true')
    // Only the favicon shows; the title is its label and the overlay's tooltip.
    const row = page.getByTestId('tab').getByRole('button').first()
    await expect(row).toHaveAttribute('aria-label', /.+/)
    await row.hover()
    const tooltip = (await overlayPage(app)).getByTestId('tooltip')
    await expect(tooltip).toBeVisible()
    // Off the sidebar it goes; showing or hiding the overlay mid-drag would disturb the drag below.
    await page.mouse.move(400, 400)
    await expect(tooltip).toHaveCount(0)
    await expect(page.getByTestId('tab').locator('span')).toBeHidden()
    // The page card still follows the sidebar.
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
      .poll(async () => JSON.stringify(await shownView(app)))
      .toBe(JSON.stringify(await slot()))

    await dragTo(300)
    await expect.poll(async () => (await sidebar.boundingBox())?.width).toBeGreaterThan(250)
    await expect(sidebar).toHaveAttribute('data-compact', 'false')
  })
})

test('icon-only mode marks filed tabs', async () => {
  await withBrowser(async ({ app, page }) => {
    await blankTab(page)
    await expect.poll(() => shownView(app)).toBeTruthy()
    const sidebar = page.getByTestId('sidebar')
    const dragTo = async (x: number) => {
      const handle = await page.getByTestId('sidebar-resizer').boundingBox()
      if (!handle) throw new Error('resizer not found')
      await page.mouse.move(handle.x + 4, 400)
      await page.mouse.down()
      await page.mouse.move(x, 400, { steps: 5 })
      await page.mouse.up()
    }

    // The blank tab is filed in a pinned folder; a second tab stays in today.
    const folderId = await page.evaluate(async () => {
      const folder = await window.bigBrowser.invoke('browser.createFolder', { name: 'Reading' })
      const { tabs } = await window.bigBrowser.invoke('browser.state')
      const first = tabs[0]
      if (first) {
        await window.bigBrowser.invoke('browser.moveTab', {
          tabId: first.id,
          section: 'pinned',
          folderId: folder.id,
          index: 0,
        })
      }
      await window.bigBrowser.invoke('browser.openTab', {})
      return folder.id
    })
    expect(folderId).toBeTruthy()
    await expect(page.getByTestId('tab')).toHaveCount(2)

    await dragTo(90)
    await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(72)
    const filed = page.getByTestId('folder').getByTestId('tab')
    await expect(filed.getByTestId('folder-bar')).toHaveCount(1)
    await expect(
      page.getByTestId('today').getByTestId('tab').getByTestId('folder-bar'),
    ).toHaveCount(0)

    await dragTo(40)
    await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(48)
    // Nothing covers the address bar: its Back button is still hit.
    const backIsHit = await page.getByRole('button', { name: 'Back' }).evaluate((el) => {
      const box = el.getBoundingClientRect()
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
      return hit !== null && el.contains(hit)
    })
    expect(backIsHit).toBe(true)

    await dragTo(300)
    await expect(sidebar).toHaveAttribute('data-compact', 'false')
  })
})

test('settings hide the page', async () => {
  await withBrowser(async ({ app, page }) => {
    await blankTab(page)
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

test('the sidebar uses the system font and 34 px rows', async () => {
  await withBrowser(async ({ app, page, site }) => {
    await openTab(app, page, site.url('/a'))
    const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
    expect(fontFamily).not.toContain('Satoshi')
    expect(fontFamily).toMatch(/^(system-ui|-apple-system)/)
    const rowHeight = await page
      .getByTestId('tab')
      .evaluate((el) => (el as HTMLElement).offsetHeight)
    expect(rowHeight).toBe(34)

    await page.getByRole('button', { name: 'New tab, space or settings' }).click()
    const menu = (await overlayPage(app)).getByTestId('menu')
    await expect(menu).toBeVisible()
    await expect(menu).toHaveCSS('backdrop-filter', 'none')
  })
})

test('switching spaces recolours the frame gradient', async () => {
  await withBrowser(async ({ page }) => {
    const backdrop = page.getByTestId('frame-backdrop')
    await expect(backdrop).toBeVisible()
    const firstTop = await backdrop.getAttribute('data-frame-top')
    const firstBottom = await backdrop.getAttribute('data-frame-bottom')
    expect(firstTop).toMatch(/^#[0-9a-f]{6}$/i)
    expect(firstBottom).toMatch(/^#[0-9a-f]{6}$/i)
    expect(firstTop).not.toBe(firstBottom)

    await page.evaluate(async () => {
      const space = await window.bigBrowser.invoke('browser.createSpace', {
        name: 'Work',
        color: '#2BB673',
      })
      await window.bigBrowser.invoke('browser.activateSpace', { spaceId: space.id })
    })

    await expect.poll(() => backdrop.getAttribute('data-frame-top')).not.toBe(firstTop)
    const secondTop = await backdrop.getAttribute('data-frame-top')
    const secondBottom = await backdrop.getAttribute('data-frame-bottom')
    expect(secondTop).toMatch(/^#[0-9a-f]{6}$/i)
    expect(secondTop).not.toBe(secondBottom)
  })
})

test('switching spaces stacks a crossfade backdrop layer and settles back to one', async () => {
  await withBrowser(async ({ page }) => {
    const layers = page.getByTestId('frame-backdrop-layer')
    await expect(layers).toHaveCount(1)

    const peakLayers = await page.evaluate(async () => {
      const backdrop = document.querySelector('[data-testid="frame-backdrop"]')
      if (!backdrop) throw new Error('frame-backdrop not found')
      let peak = backdrop.querySelectorAll('[data-testid="frame-backdrop-layer"]').length
      const observer = new MutationObserver(() => {
        peak = Math.max(
          peak,
          backdrop.querySelectorAll('[data-testid="frame-backdrop-layer"]').length,
        )
      })
      observer.observe(backdrop, { childList: true })
      const space = await window.bigBrowser.invoke('browser.createSpace', {
        name: 'Work',
        color: '#2BB673',
      })
      await window.bigBrowser.invoke('browser.activateSpace', { spaceId: space.id })
      await new Promise((resolve) => setTimeout(resolve, 700))
      observer.disconnect()
      return peak
    })

    expect(peakLayers).toBeGreaterThanOrEqual(2)
    await expect(layers).toHaveCount(1)
    // Derived root tokens follow the active space color (not the default app accent).
    const dockSelected = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--bg-dock-selected'),
    )
    expect(dockSelected).toContain('#2BB673')
  })
})

test('the + menu opens over the page in liquid glass', async () => {
  await withBrowser(async ({ app, page }) => {
    await page.evaluate(() => window.bigBrowser.invoke('settings.update', { transparency: 1 }))
    // Liquid glass only exists where the platform supports it (macOS, Windows 11).
    const glassSupported = await page.evaluate(
      async () => (await window.bigBrowser.invoke('app.info')).glassSupported,
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
    await openTab(app, page, site.url('/a'))
    await expect(page.getByTestId('tab')).toHaveText(['Page A'])

    await page.getByRole('button', { name: 'New tab, space or settings' }).click()
    await (await overlayPage(app)).getByRole('menuitem', { name: 'New space' }).click()
    const spaces = page.getByRole('tablist', { name: 'Spaces' }).getByRole('tab')
    await expect(spaces).toHaveCount(2)
    await expect(spaces.nth(1)).toHaveAttribute('aria-label', 'Space 2')
    await expect(spaces.nth(1)).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('tab')).toHaveCount(0)

    await openTab(app, page, site.url('/c'))
    await expect(page.getByTestId('tab')).toHaveText(['Page C'])

    await spaces.first().click()
    await expect(page.getByTestId('tab')).toHaveText(['Page A'])
  })
})

test('magnetic buttons follow the setting', async () => {
  await withBrowser(async ({ page }) => {
    const dot = page.getByRole('tablist', { name: 'Spaces' }).getByRole('tab').first()
    const box = await dot.boundingBox()
    if (!box) throw new Error('space dot has no box')
    const hover = async () => {
      await page.mouse.move(0, 0)
      await page.mouse.move(box.x + box.width / 2 + 3, box.y + box.height / 2 + 3)
    }
    await hover()
    await expect.poll(() => dot.evaluate((el) => (el as HTMLElement).style.translate)).not.toBe('')
    await expect.poll(() => dot.evaluate((el) => (el as HTMLElement).style.scale)).toBe('1.08')

    await page.evaluate(() =>
      window.bigBrowser.invoke('settings.update', { magneticButtons: false }),
    )
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset['magnetic']))
      .toBe('off')
    await hover()
    await expect.poll(() => dot.evaluate((el) => (el as HTMLElement).style.translate)).toBe('')
    await expect.poll(() => dot.evaluate((el) => (el as HTMLElement).style.scale)).toBe('')
  })
})

test('magnetic buttons stay still under reduced motion', async () => {
  await withBrowser(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const dot = page.getByRole('tablist', { name: 'Spaces' }).getByRole('tab').first()
    const box = await dot.boundingBox()
    if (!box) throw new Error('space dot has no box')
    await page.mouse.move(0, 0)
    await page.mouse.move(box.x + box.width / 2 + 3, box.y + box.height / 2 + 3)
    await page.waitForTimeout(200)
    expect(await dot.evaluate((el) => (el as HTMLElement).style.translate)).toBe('')
    expect(await dot.evaluate((el) => (el as HTMLElement).style.scale)).toBe('')
  })
})

test('tabs survive a relaunch', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'big-browser-e2e-'))
  const site = await startSite()
  try {
    const first = await launchApp(userData)
    const page = await uiPage(first)
    await finishOnboarding(page)
    await openTab(first, page, site.url('/a'))
    await expect(page.getByTestId('tab')).toHaveText(['Page A'])
    await openTab(first, page, site.url('/b'))
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
  const userData = mkdtempSync(join(tmpdir(), 'big-browser-e2e-'))
  const site = await startSite()
  try {
    const first = await launchApp(userData)
    const page = await uiPage(first)
    await finishOnboarding(page)
    await openTab(first, page, site.url('/a'))
    await openTab(first, page, site.url('/b'))
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
    await openTab(app, page, site.url('/a'))
    await expect(page.getByTestId('tab')).toHaveText(['Page A'])

    // Give the page focus, as a user would after clicking into it.
    await app.evaluate(({ webContents }) =>
      webContents
        .getAllWebContents()
        .find((w) => w.getURL().endsWith('/a'))
        ?.executeJavaScript('document.body.focus()'),
    )

    // ⌘T opens the command field over the page; the tab is created when it is submitted.
    await clickMenu(app, 'newTab')
    const field = (await overlayPage(app)).getByLabel('Search or enter address')
    await expect(field).toBeFocused()
    await expect(page.getByTestId('tab')).toHaveCount(1)
    await field.fill(site.url('/b'))
    await field.press('Enter')
    await expect(page.getByTestId('tab')).toHaveCount(2)
    await expect(page.getByTestId('tab').nth(1).getByRole('button').first()).toHaveAttribute(
      'aria-current',
      'page',
    )

    await clickMenu(app, 'closeTab')
    await expect(page.getByTestId('tab')).toHaveCount(1)
  })
})

test('closing a pinned tab unloads it', async () => {
  await withBrowser(async ({ app, page, site }) => {
    await openTab(app, page, site.url('/a'))
    await openTab(app, page, site.url('/b'))
    await expect(page.getByTestId('tab')).toHaveText(['Page A', 'Page B'])
    const pinnedId = (await browserState(page)).tabs.find((t) => t.url.endsWith('/a'))?.id ?? ''
    await page.evaluate(async (tabId) => {
      await window.bigBrowser.invoke('browser.moveTab', { tabId, section: 'pinned', index: 0 })
      await window.bigBrowser.invoke('browser.activateTab', { tabId })
    }, pinnedId)
    const pinned = page.getByTestId('tab').filter({ hasText: 'Page A' }).getByRole('button').first()
    await expect(pinned).toHaveAttribute('data-loaded', 'true')

    await clickMenu(app, 'closeTab')
    await expect(page.getByTestId('tab')).toHaveCount(2)
    await expect(pinned).toHaveAttribute('data-loaded', 'false')
    const state = await browserState(page)
    expect(state.runtime[pinnedId]).toMatchObject({ loaded: false, webContentsId: null })
    expect(
      await app.evaluate(
        ({ webContents }) =>
          webContents.getAllWebContents().filter((w) => w.getURL().endsWith('/a')).length,
      ),
    ).toBe(0)
  })
})

test('reopen closed tab', async () => {
  await withBrowser(async ({ app, page, site }) => {
    await openTab(app, page, site.url('/a'))
    await openTab(app, page, site.url('/b'))
    await expect(page.getByTestId('tab')).toHaveText(['Page A', 'Page B'])

    await clickMenu(app, 'closeTab')
    await expect(page.getByTestId('tab')).toHaveText(['Page A'])
    await clickMenu(app, 'reopenClosed')
    await expect(page.getByTestId('tab')).toHaveText(['Page A', 'Page B'])
    const state = await browserState(page)
    const active = state.tabs.find((t) => t.id === state.activeTabIds[state.activeSpaceId])
    expect(active?.url).toBe(site.url('/b'))
  })
})

test('a link opened in a new tab is nested', async () => {
  await withBrowser(async ({ app, page, site }) => {
    await openTab(app, page, site.url('/a'))
    await expect(page.getByTestId('tab')).toHaveText(['Page A'])

    await app.evaluate(({ webContents }) =>
      webContents
        .getAllWebContents()
        .find((w) => w.getURL().endsWith('/a'))
        ?.executeJavaScript("document.getElementById('pop').click()"),
    )
    await expect(page.getByTestId('tab')).toHaveCount(2)
    const { tabs } = await browserState(page)
    const opener = tabs.find((t) => t.url.endsWith('/a'))
    const child = tabs.find((t) => t.id !== opener?.id)
    expect(child?.parentId).toBe(opener?.id)
  })
})

test('favicons are fetched', async () => {
  await withBrowser(async ({ app, page, site }) => {
    await openTab(app, page, site.url('/with-icon'))
    await expect(page.getByTestId('tab')).toHaveText(['With Icon'])
    await expect
      .poll(async () => (await browserState(page)).tabs[0]?.faviconUrl ?? '')
      .toMatch(/^data:image\/png;base64,/)
  })
})

test('the address bar switches the sidebar to icons and back', async () => {
  await withBrowser(async ({ page }) => {
    const sidebar = page.getByTestId('sidebar')
    await expect(sidebar).toHaveAttribute('data-compact', 'false')
    const before = (await sidebar.boundingBox())?.width ?? 0

    await page.getByRole('button', { name: 'Icons only' }).click()
    await expect(sidebar).toHaveAttribute('data-compact', 'true')
    await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(56)

    await page.getByRole('button', { name: 'Expand sidebar' }).click()
    await expect(sidebar).toHaveAttribute('data-compact', 'false')
    await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(before)
  })
})

test('copy link puts the page address on the clipboard', async () => {
  await withBrowser(async ({ app, page, site }) => {
    await openTab(app, page, site.url('/a'))
    await app.evaluate(({ clipboard }) => clipboard.writeText(''))
    await page.getByRole('button', { name: 'Copy link' }).click()
    await expect
      .poll(() => app.evaluate(({ clipboard }) => clipboard.readText()))
      .toBe(site.url('/a'))
    // A check mark confirms it for a moment.
    await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible()
  })
})

test('the settings button opens settings', async () => {
  await withBrowser(async ({ page }) => {
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await expect(page.getByTestId('settings')).toBeVisible()
  })
})

test('the page menu is drawn', async () => {
  await withBrowser(async ({ app, page, site }) => {
    await openTab(app, page, site.url('/a'))
    await go(page, site.url('/b'))
    await expect(page.getByTestId('tab')).toHaveText(['Page B'])
    // A mark that a reload wipes.
    const marked = () =>
      app.evaluate(({ webContents }) =>
        webContents
          .getAllWebContents()
          .find((w) => w.getURL().endsWith('/b'))
          ?.executeJavaScript('window.bigBrowserMark === 1'),
      )
    await app.evaluate(({ webContents }) =>
      webContents
        .getAllWebContents()
        .find((w) => w.getURL().endsWith('/b'))
        ?.executeJavaScript('window.bigBrowserMark = 1'),
    )
    expect(await marked()).toBe(true)

    const at = { x: 40, y: 60 }
    await rightClickPage(app, page, at)
    const overlay = await overlayPage(app)
    const menu = overlay.getByTestId('menu')
    await expect(menu.getByRole('menuitem')).toHaveText([
      'Back',
      'Forward',
      'Reload',
      'Copy Page URL',
      'Save Page As…',
      'Print…',
      'View Page Source',
      'Inspect Element',
    ])
    await expect(menu.getByRole('menuitem', { name: 'Forward' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    // At the pointer: the page's point plus the page view's origin in the window.
    await overlay.waitForFunction(
      () => document.querySelector('[data-testid="menu"]')?.getAnimations().length === 0,
    )
    const bounds = await shownView(app)
    const card = await menu.boundingBox()
    expect(Math.abs((card?.x ?? 0) - ((bounds?.x ?? 0) + at.x))).toBeLessThanOrEqual(1)
    expect(Math.abs((card?.y ?? 0) - ((bounds?.y ?? 0) + at.y))).toBeLessThanOrEqual(1)

    await menu.getByRole('menuitem', { name: 'Reload' }).click()
    await expect(menu).toHaveCount(0)
    await expect.poll(marked).toBe(false)
  })
})

test('the page menu fits what was clicked', async () => {
  await withBrowser(async ({ app, page, site }) => {
    await openTab(app, page, site.url('/a'))
    await expect(page.getByTestId('tab')).toHaveText(['Page A'])
    const overlay = await overlayPage(app)
    const menu = overlay.getByTestId('menu')

    // Right-click a link: link items with icons, including Open Link in Split View.
    const linkPoint = await app.evaluate(({ webContents }) =>
      webContents
        .getAllWebContents()
        .find((w) => w.getURL().endsWith('/a'))
        ?.executeJavaScript(
          '(() => { const r = document.getElementById("b").getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) } })()',
        ),
    )
    if (!linkPoint) throw new Error('Link rect not found')
    await rightClickPage(app, page, linkPoint)
    const items = menu.getByRole('menuitem')
    await expect(items).toHaveText([
      'Open Link in New Tab',
      'Open Link in Split View',
      'Open Link Here',
      'Download Linked File',
      'Copy Link',
      ...(process.platform === 'darwin' ? ['Share…'] : []),
      'Inspect Element',
    ])
    const linkCount = await items.count()
    for (let i = 0; i < linkCount; i++) {
      await expect(items.nth(i).locator('svg, img')).toHaveCount(1)
    }
    await menu.getByRole('menuitem', { name: 'Open Link in Split View' }).click()
    await expect(menu).toHaveCount(0)
    await expect(page.getByTestId('split-row')).toHaveCount(1)
    await expect(page.getByTestId('split-row').getByTestId('split-half')).toHaveText([
      'Page A',
      'Page B',
    ])
    await expect(page.getByTestId('url-rest')).toHaveText('/b')

    // Right-click a blank spot on the active half (/b): Copy Page URL copies its URL.
    await app.evaluate(({ clipboard }) => clipboard.writeText(''))
    await expect(async () => {
      if (!(await menu.isVisible())) await rightClickPage(app, page, { x: 100, y: 120 })
      await expect(menu).toBeVisible({ timeout: 1_000 })
    }).toPass()
    await expect(items).toHaveText([
      'Back',
      'Forward',
      'Reload',
      'Copy Page URL',
      'Save Page As…',
      'Print…',
      'View Page Source',
      'Inspect Element',
    ])
    const blankCount = await items.count()
    for (let i = 0; i < blankCount; i++) {
      await expect(items.nth(i).locator('svg, img')).toHaveCount(1)
    }
    await menu.getByRole('menuitem', { name: 'Copy Page URL' }).click()
    await expect(menu).toHaveCount(0)
    await expect
      .poll(() => app.evaluate(({ clipboard }) => clipboard.readText()))
      .toBe(site.url('/b'))
  })
})

test('the page keeps the keyboard after its menu', async () => {
  await withBrowser(async ({ app, page, site }) => {
    await openTab(app, page, site.url('/form'))
    await expect(page.getByTestId('tab')).toHaveText(['Form'])

    // Right-click in the field (which focuses it), then Select All from the drawn menu.
    await rightClickPage(app, page, { x: 40, y: 20 })
    const menu = (await overlayPage(app)).getByTestId('menu')
    await menu.getByRole('menuitem', { name: 'Select All' }).click()
    await expect(menu).toHaveCount(0)

    // The keyboard is back in the page: a key goes to whichever web contents has focus, as
    // a real key press would (asserted through web contents state, not OS focus).
    await expect
      .poll(() =>
        app.evaluate(({ webContents }) =>
          webContents
            .getAllWebContents()
            .find((w) => w.getURL().endsWith('/form'))
            ?.isFocused(),
        ),
      )
      .toBe(true)
    await app.evaluate(({ webContents }) => {
      const focused = webContents.getFocusedWebContents()
      if (!focused) throw new Error('No focused web contents')
      focused.sendInputEvent({ type: 'keyDown', keyCode: 'X' })
      focused.sendInputEvent({ type: 'char', keyCode: 'x' })
      focused.sendInputEvent({ type: 'keyUp', keyCode: 'X' })
    })
    await expect
      .poll(() =>
        app.evaluate(({ webContents }) =>
          webContents
            .getAllWebContents()
            .find((w) => w.getURL().endsWith('/form'))
            ?.executeJavaScript('document.getElementById("field").value'),
        ),
      )
      .toBe('x')
  })
})

test('visits are recorded in history, searched and forgotten', async () => {
  await withBrowser(async ({ page, site }) => {
    const frequent = () => page.evaluate(() => window.bigBrowser.invoke('history.frequent', {}))
    await blankTab(page)
    await go(page, site.url('/a'))
    await expect.poll(async () => (await frequent()).map((e) => e.title)).toEqual(['Page A'])
    expect((await frequent())[0]).toMatchObject({ url: site.url('/a'), visitCount: 1 })

    // A reload is another visit; a hash change is not.
    await go(page, site.url('/a#section'))
    await go(page, site.url('/a'))
    await expect.poll(async () => (await frequent())[0]?.visitCount).toBe(2)
    expect(await frequent()).toHaveLength(1)

    const found = await page.evaluate(() =>
      window.bigBrowser.invoke('history.search', { query: 'PAGE a' }),
    )
    expect(found.map((e) => e.url)).toEqual([site.url('/a')])

    const id = found[0]?.id ?? ''
    await page.evaluate(
      (entryId) => window.bigBrowser.invoke('history.forget', { id: entryId }),
      id,
    )
    expect(await frequent()).toEqual([])
  })
})

/** Visible page views (not the overlay strip), left to right. */
const shownPages = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) =>
    (BrowserWindow.getAllWindows()[0]?.contentView.children ?? [])
      .slice(0, -1) // the overlay is always the top child
      .filter((v) => v.getVisible())
      .map((v) => v.getBounds())
      .sort((p, q) => p.x - q.x),
  )

/** A real left click (input events, as the OS sends them) into a tab's page. */
async function clickPage(app: ElectronApplication, page: Page, tabId: string): Promise<void> {
  const id = await page.evaluate(async (tabId) => {
    const { runtime } = await window.bigBrowser.invoke('browser.state')
    return runtime[tabId]?.webContentsId ?? null
  }, tabId)
  if (id === null) throw new Error('the page has no view')
  await app.evaluate(({ webContents }, id) => {
    const contents = webContents.fromId(id)
    if (!contents) throw new Error(`No web contents ${id}`)
    const at = { x: 40, y: 40, button: 'left' as const, clickCount: 1 }
    contents.sendInputEvent({ type: 'mouseMove', x: at.x, y: at.y })
    contents.sendInputEvent({ ...at, type: 'mouseDown' })
    contents.sendInputEvent({ ...at, type: 'mouseUp' })
  }, id)
}

/** Opens `/a` and `/b` and splits them, `/a` first; returns their ids. */
async function splitAB(app: ElectronApplication, page: Page, site: Site) {
  const open = (input: string) =>
    page.evaluate((input) => window.bigBrowser.invoke('browser.openTab', { input }), input)
  const a = await open(site.url('/a'))
  const b = await open(site.url('/b'))
  await page.evaluate((ids) => window.bigBrowser.invoke('browser.splitTabs', ids), {
    firstId: a.id,
    secondId: b.id,
  })
  await expect.poll(async () => (await shownPages(app)).length).toBe(2)
  return { a, b }
}

/** The stored ratio of the split whose first tab is `firstId`. */
const storedRatio = async (page: Page, firstId: string) =>
  (await browserState(page)).tabs.find((t) => t.id === firstId)?.splitRatio ?? 0.5

/** The middle of the divider, in window coordinates. */
async function dividerCentre(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.getByTestId('split-divider').boundingBox()
  if (!box) throw new Error('divider not found')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test('a split shows two pages', async () => {
  await withBrowser(async ({ app, page, site }) => {
    const { a, b } = await splitAB(app, page, site)
    // The left page's view was just made by the split: its first click waits for it to load.
    await expect(async () => {
      await clickPage(app, page, a.id)
      await expect(page.getByTestId('url-rest')).toHaveText('/a', { timeout: 500 })
    }).toPass()

    // Both pages are shown, side by side, at the same height.
    const [left, right] = await shownPages(app)
    if (!left || !right) throw new Error('views not shown')
    expect(right.x).toBeGreaterThan(left.x + left.width)
    expect(right.y).toBe(left.y)

    // A drag as a user makes it: pressed, moved and released on the UI only (the divider captures
    // the pointer). Both pages follow before release; the ratio is stored on release.
    const { x, y } = await dividerCentre(page)
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x - 150, y, { steps: 5 })
    await expect.poll(async () => (await shownPages(app))[0]?.width ?? 0).toBeLessThan(left.width)
    expect((await shownPages(app))[1]?.x).toBeLessThan(right.x)
    await page.mouse.up()
    await expect.poll(() => storedRatio(page, a.id)).toBeLessThan(0.45)
    await expect((await overlayPage(app)).getByTestId('split-drag-layer')).toBeHidden()

    // A real click into the right page makes it the active tab: the address bar follows.
    await clickPage(app, page, b.id)
    await expect(page.getByTestId('url-rest')).toHaveText('/b')
    await clickPage(app, page, a.id)
    await expect(page.getByTestId('url-rest')).toHaveText('/a')
    await expect(page.getByTestId('split-divider')).toBeVisible()
  })
})

test('the overlay layer drives a split drag, Escape cancels one', async () => {
  await withBrowser(async ({ app, page, site }) => {
    const { a } = await splitAB(app, page, site)
    const before = await shownPages(app)
    const overlay = await overlayPage(app)
    const layer = overlay.getByTestId('split-drag-layer')

    // The pointer's events reach the overlay's capture layer instead of the UI.
    const { x, y } = await dividerCentre(page)
    await page.mouse.move(x, y)
    await page.mouse.down()
    await expect(layer).toBeVisible()
    await overlay.mouse.move(x, y)
    await overlay.mouse.down()
    await overlay.mouse.move(x + 200, y, { steps: 3 })
    await expect
      .poll(async () => (await shownPages(app))[0]?.width ?? 0)
      .toBeGreaterThan(before[0]?.width ?? 0)
    await overlay.mouse.up()
    await page.mouse.up() // the UI's release too: main ends the drag once
    await expect(layer).toBeHidden()
    await expect.poll(() => storedRatio(page, a.id)).toBeGreaterThan(0.55)
    const stored = await storedRatio(page, a.id)
    const after = await shownPages(app)

    // Escape puts the stored ratio back.
    await page.mouse.move(...(Object.values(await dividerCentre(page)) as [number, number]))
    await page.mouse.down()
    await expect(layer).toBeVisible()
    await overlay.mouse.move(x - 200, y, { steps: 3 })
    await expect.poll(async () => (await shownPages(app))[0]?.width).not.toBe(after[0]?.width)
    await overlay.keyboard.press('Escape')
    await expect(layer).toBeHidden()
    await page.mouse.up()
    await expect.poll(async () => JSON.stringify(await shownPages(app))).toBe(JSON.stringify(after))
    expect(await storedRatio(page, a.id)).toBe(stored)
  })
})

test('a split drag never leaves its layer behind', async () => {
  await withBrowser(async ({ app, page, site }) => {
    const { a, b } = await splitAB(app, page, site)
    const overlay = await overlayPage(app)
    const layer = overlay.getByTestId('split-drag-layer')
    const start = (tabId: string) =>
      page.evaluate(
        (tabId) => window.bigBrowser.invoke('browser.splitDrag', { phase: 'start', tabId }),
        tabId,
      )

    // The split goes away mid-drag (its tab closed): the release drops the layer, stores nothing.
    await start(a.id)
    await expect(layer).toBeVisible()
    await page.evaluate((tabId) => window.bigBrowser.invoke('browser.closeTab', { tabId }), b.id)
    await page.evaluate(() =>
      window.bigBrowser.invoke('browser.splitDrag', { phase: 'end', x: 300 }),
    )
    await expect(layer).toBeHidden()

    // A tab outside any split starts no drag.
    await start(a.id)
    await expect(layer).toBeHidden()

    // The window losing focus cancels a drag.
    const c = await page.evaluate(() => window.bigBrowser.invoke('browser.openTab', {}))
    await page.evaluate((ids) => window.bigBrowser.invoke('browser.splitTabs', ids), {
      firstId: a.id,
      secondId: c.id,
    })
    await start(a.id)
    await expect(layer).toBeVisible()
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.emit('blur'))
    await expect(layer).toBeHidden()
    expect(await storedRatio(page, a.id)).toBe(0.5)
  })
})
