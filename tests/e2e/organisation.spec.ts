import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { startSite } from './fixtures/site'
import { finishOnboarding, launchApp, overlayPage, uiPage } from './helpers'

type Site = Awaited<ReturnType<typeof startSite>>

/** A fresh app (onboarding done) and the local site, torn down after `run`. */
async function withBrowser(
  run: (ctx: { app: ElectronApplication; page: Page; site: Site }) => Promise<void>,
): Promise<void> {
  const userData = mkdtempSync(join(tmpdir(), 'acab-e2e-'))
  const site = await startSite()
  const app = await launchApp(userData)
  try {
    const page = await uiPage(app)
    await finishOnboarding(page)
    await run({ app, page, site })
  } finally {
    await app.close().catch(() => undefined)
    await site.close()
    rmSync(userData, { recursive: true, force: true })
  }
}

/** Opens a tab on `url` straight through the bridge (the sidebar's + is not under test here). */
const openTab = (page: Page, url: string) =>
  page.evaluate((input) => window.acab.invoke('browser.openTab', { input }), url)

// Native context menus can't be clicked from Playwright: the tests call what their items call.

test('pinned tabs and folders: pin, file into a folder, collapse, rename', async () => {
  await withBrowser(async ({ app, page, site }) => {
    const tab = await openTab(page, site.url('/a'))
    const today = page.getByTestId('today')
    await expect(today.getByTestId('tab')).toHaveText(['Page A'])

    await page.evaluate(
      (tabId) => window.acab.invoke('browser.moveTab', { tabId, section: 'pinned', index: 0 }),
      tab.id,
    )
    const pinned = page.getByTestId('pinned')
    await expect(pinned.getByTestId('tab')).toHaveText(['Page A'])
    await expect(today.getByTestId('tab')).toHaveCount(0)

    const folder = await page.evaluate(() =>
      window.acab.invoke('browser.createFolder', { name: 'Reading' }),
    )
    await page.evaluate(
      ({ tabId, folderId }) =>
        window.acab.invoke('browser.moveTab', { tabId, section: 'pinned', folderId, index: 0 }),
      { tabId: tab.id, folderId: folder.id },
    )
    const folderRow = pinned.getByTestId('folder')
    await expect(folderRow.getByTestId('tab')).toHaveText(['Page A'])

    // A click on the folder row collapses it: its tab is no longer drawn.
    await folderRow.getByRole('button', { name: 'Reading' }).click()
    await expect(folderRow.getByTestId('tab')).toHaveCount(0)
    await expect(folderRow.getByRole('button', { name: 'Reading' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )

    // "Rename" in the folder's menu: main asks the sidebar to edit the name inline.
    await app.evaluate(({ BrowserWindow }, folderId) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('browser.shortcut', {
        kind: 'rename-folder',
        folderId,
      })
    }, folder.id)
    const name = folderRow.getByLabel('Folder name')
    await expect(name).toBeFocused()
    await name.fill('Later')
    await name.press('Enter')
    await expect(folderRow.getByRole('button', { name: 'Later' })).toBeVisible()
  })
})

test('three tabs of one site are drawn as an automatic folder, unless turned off', async () => {
  await withBrowser(async ({ app, page, site }) => {
    for (const path of ['/a', '/b', '/c']) await openTab(page, site.url(path))

    const today = page.getByTestId('today')
    const auto = today.getByTestId('auto-folder')
    await expect(auto).toHaveCount(1)
    const folderButton = auto.getByRole('button', { name: '127.0.0.1', exact: true })
    await expect(folderButton).toBeVisible()
    await expect(auto.getByTestId('tab')).toHaveText(['Page A', 'Page B', 'Page C'])

    // Collapsing an automatic folder hides its tabs too (kept per host in the UI).
    await folderButton.click()
    await expect(auto.getByTestId('tab')).toHaveCount(0)
    await folderButton.click()

    await page.getByRole('button', { name: 'New tab, space or settings' }).click()
    await (await overlayPage(app)).getByRole('menuitem', { name: 'Settings' }).click()
    await page
      .getByRole('navigation', { name: 'Settings sections' })
      .getByRole('button', { name: 'Appearance' })
      .click()
    await page.getByRole('switch', { name: 'Automatic folders' }).click()
    await page.keyboard.press('Escape')

    await expect(today.getByTestId('auto-folder')).toHaveCount(0)
    await expect(today.locator(':scope > [data-testid="tab"]')).toHaveText([
      'Page A',
      'Page B',
      'Page C',
    ])
  })
})

/** The tabs of the active space as main stores them (section and folder). */
const storedTabs = (page: Page) =>
  page.evaluate(() =>
    window.acab
      .invoke('browser.state')
      .then((state) =>
        state.tabs.map((t) => ({ title: t.title, section: t.section, folderId: t.folderId })),
      ),
  )

test('dragging a tab pins it, files it into a folder and moves it back to today', async () => {
  await withBrowser(async ({ page, site }) => {
    const a = await openTab(page, site.url('/a'))
    await openTab(page, site.url('/b'))
    await openTab(page, site.url('/c'))
    await page.evaluate(
      (tabId) => window.acab.invoke('browser.moveTab', { tabId, section: 'pinned', index: 0 }),
      a.id,
    )
    const pinned = page.getByTestId('pinned')
    const today = page.getByTestId('today')
    await expect(pinned.getByTestId('tab')).toHaveText(['Page A'])
    await expect(today.getByTestId('tab')).toHaveText(['Page B', 'Page C'])

    // The first today tab dropped on the pinned list's tab (its lower half): pinned after it.
    await today
      .getByTestId('tab')
      .first()
      .dragTo(pinned.getByTestId('tab').first(), {
        targetPosition: { x: 40, y: 26 },
      })
    await expect(pinned.getByTestId('tab')).toHaveText(['Page A', 'Page B'])
    await expect(today.getByTestId('tab')).toHaveText(['Page C'])

    // A tab dropped on the middle of a folder's row is filed into it.
    const folder = await page.evaluate(() =>
      window.acab.invoke('browser.createFolder', { name: 'Reading' }),
    )
    const folderButton = pinned.getByRole('button', { name: 'Reading' })
    await today.getByTestId('tab').first().dragTo(folderButton)
    await expect(pinned.getByTestId('folder').getByTestId('tab')).toHaveText(['Page C'])
    expect(await storedTabs(page)).toContainEqual({
      title: 'Page C',
      section: 'pinned',
      folderId: folder.id,
    })

    // Back to today: dropped on the upper half of a today tab, a pinned tab goes before it.
    await openTab(page, site.url('/with-icon'))
    await expect(today.getByTestId('tab')).toHaveCount(1)
    await pinned
      .getByTestId('tab')
      .first()
      .dragTo(today.getByTestId('tab').first(), {
        targetPosition: { x: 40, y: 6 },
      })
    await expect(today.getByTestId('tab')).toHaveText(['Page A', 'With Icon'])
    await expect(pinned.getByTestId('tab')).toHaveText(['Page B', 'Page C'])
  })
})

test('a tab with a real favicon can be dragged by its icon', async () => {
  await withBrowser(async ({ page, site }) => {
    await openTab(page, site.url('/a'))
    await openTab(page, site.url('/with-icon'))
    const today = page.getByTestId('today')
    await expect(today.getByTestId('tab')).toHaveText(['Page A', 'With Icon'])
    // The favicon is fetched by main and drawn as an inline image.
    const icon = today.getByTestId('tab').nth(1).locator('img')
    await expect(icon).toHaveAttribute('src', /^data:image\//)

    await icon.dragTo(today.getByTestId('tab').first(), { targetPosition: { x: 40, y: 6 } })
    await expect(today.getByTestId('tab')).toHaveText(['With Icon', 'Page A'])
  })
})

test('while a tab is dragged, an empty favourites grid appears to drop it on', async () => {
  await withBrowser(async ({ page, site }) => {
    await openTab(page, site.url('/a'))
    await openTab(page, site.url('/b'))
    const favorites = page.getByTestId('favorites')
    await expect(favorites).toHaveCount(0)

    const row = page.getByTestId('today').getByTestId('tab').first()
    const box = await row.boundingBox()
    if (!box) throw new Error('No tab row')
    await page.mouse.move(box.x + 40, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + 40, box.y + box.height / 2 + 10, { steps: 2 })
    await expect(favorites).toBeVisible()
    await expect(page.getByTestId('tab').filter({ hasText: 'Page A' })).toHaveAttribute(
      'data-dragged',
      'true',
    )
    const grid = await favorites.boundingBox()
    if (!grid) throw new Error('No favourites grid')
    await page.mouse.move(grid.x + grid.width / 2, grid.y + grid.height / 2, { steps: 4 })
    await expect(favorites).toHaveAttribute('data-drop-target', 'true')
    await page.mouse.up()

    await expect(favorites.getByTestId('favorite')).toHaveCount(1)
    await expect(favorites.getByRole('button', { name: 'Page A' })).toBeVisible()
    await expect(page.getByTestId('today').getByTestId('tab')).toHaveText(['Page B'])
  })
})

/** Counts web contents main creates from now on (a tab's view is one). */
const countCreatedContents = (app: ElectronApplication) =>
  app.evaluate(({ app: electronApp }) => {
    const counter = globalThis as unknown as { createdContents: number }
    counter.createdContents = 0
    electronApp.on('web-contents-created', () => {
      counter.createdContents += 1
    })
  })

const createdContents = (app: ElectronApplication) =>
  app.evaluate(() => (globalThis as unknown as { createdContents: number }).createdContents)

test("Clear closes today's tabs without loading any, ⌘⇧T reopens the last one", async () => {
  const userData = mkdtempSync(join(tmpdir(), 'acab-e2e-'))
  const site = await startSite()
  try {
    const first = await launchApp(userData)
    const page = await uiPage(first)
    await finishOnboarding(page)
    await openTab(page, site.url('/a'))
    await openTab(page, site.url('/b'))
    await expect(page.getByTestId('today').getByTestId('tab')).toHaveText(['Page A', 'Page B'])
    await first.close()

    // After a relaunch only the active tab (B) has a view; A is restored without one.
    const app = await launchApp(userData)
    try {
      const again = await uiPage(app)
      const rows = again.getByTestId('today').getByTestId('tab')
      await expect(rows).toHaveText(['Page A', 'Page B'])
      await expect(rows.nth(0).getByRole('button').first()).toHaveAttribute('data-loaded', 'false')

      await countCreatedContents(app)
      await again.getByRole('button', { name: 'Clear' }).click()
      await expect(rows).toHaveCount(0)
      expect(await createdContents(app)).toBe(0)

      // The active tab is closed last, so it is the first one back.
      await app.evaluate(({ Menu }) =>
        Menu.getApplicationMenu()?.getMenuItemById('reopenClosed')?.click(),
      )
      await expect(rows).toHaveText(['Page B'])
    } finally {
      await app.close()
    }
  } finally {
    await site.close()
    rmSync(userData, { recursive: true, force: true })
  }
})

test("a tab's close button only shows on hover", async () => {
  await withBrowser(async ({ page, site }) => {
    await openTab(page, site.url('/a'))
    await openTab(page, site.url('/b'))
    const row = page.getByTestId('today').getByTestId('tab').first()
    const close = row.getByRole('button', { name: 'Close tab' })
    await expect(close).toHaveCSS('opacity', '0')
    await row.hover()
    await expect(close).toHaveCSS('opacity', '1')
  })
})

test('long titles fade instead of ellipsing', async () => {
  await withBrowser(async ({ page, site }) => {
    await openTab(page, site.url('/long'))
    const title = page.getByTestId('today').getByTestId('tab').first().locator('span').last()
    await expect(title).toHaveText(/^A very long page title/)
    await expect(title).toHaveCSS('text-overflow', 'clip')
    const mask = await title.evaluate((el) => getComputedStyle(el).maskImage)
    expect(mask).not.toBe('none')
  })
})

test('New tab sits right under the separator', async () => {
  await withBrowser(async ({ page, site }) => {
    await openTab(page, site.url('/a'))
    await openTab(page, site.url('/b'))
    const header = await page.getByTestId('today-header').boundingBox()
    const newTab = await page.getByTestId('new-tab').boundingBox()
    const firstRow = await page.getByTestId('today').getByTestId('tab').first().boundingBox()
    if (!header || !newTab || !firstRow) throw new Error('Missing sidebar element')
    expect(newTab.y).toBeGreaterThan(header.y + header.height - 1)
    expect(newTab.y).toBeLessThan(firstRow.y)
  })
})

test('Clear only shows while the separator is hovered', async () => {
  await withBrowser(async ({ page, site }) => {
    await openTab(page, site.url('/a'))
    const clear = page.getByRole('button', { name: 'Clear' })
    await expect(clear).toHaveCSS('opacity', '0')
    await page.getByTestId('today-header').hover()
    await expect(clear).toHaveCSS('opacity', '1')
  })
})

test('favourite tiles fill the width and wrap', async () => {
  await withBrowser(async ({ page, site }) => {
    const urls = ['/a', '/b', '/c', '/long', '/with-icon']
    const ids: string[] = []
    for (const path of urls) {
      ids.push((await openTab(page, site.url(path))).id)
    }
    const tiles = page.getByTestId('favorites').getByTestId('favorite')
    const tops = async () =>
      (await tiles.evaluateAll((els) => els.map((el) => el.getBoundingClientRect()))).map((r) => ({
        top: Math.round(r.top),
        left: r.left,
        width: r.width,
        right: r.right,
      }))

    const moveToFavorites = async (tabIds: string[]) => {
      for (const tabId of tabIds) {
        await page.evaluate(
          (id) =>
            window.acab.invoke('browser.moveTab', { tabId: id, section: 'favorites', index: 0 }),
          tabId,
        )
      }
    }
    await moveToFavorites(ids.slice(0, 3))
    await expect(tiles).toHaveCount(3)
    const three = await tops()
    expect(new Set(three.map((t) => t.top)).size).toBe(1)
    const widths = three.map((t) => t.width)
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1)
    const grid = await page.getByTestId('favorites').boundingBox()
    if (!grid) throw new Error('No favourites grid')
    const span = Math.max(...three.map((t) => t.right)) - Math.min(...three.map((t) => t.left))
    expect(span).toBeGreaterThanOrEqual(grid.width * 0.9)

    await moveToFavorites(ids.slice(3))
    await expect(tiles).toHaveCount(5)
    expect(new Set((await tops()).map((t) => t.top)).size).toBe(2)
  })
})

test('no Search button at the top of the sidebar', async () => {
  await withBrowser(async ({ page }) => {
    await expect(page.getByTestId('sidebar').getByRole('button', { name: 'Search' })).toHaveCount(0)
  })
})
