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
  const userData = mkdtempSync(join(tmpdir(), 'big-browser-e2e-'))
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
  page.evaluate((input) => window.bigBrowser.invoke('browser.openTab', { input }), url)

// Most tests drive the model through the bridge; the sidebar menus are drawn, so they are clicked.

test('pinned tabs and folders: pin, file into a folder, collapse, rename', async () => {
  await withBrowser(async ({ app, page, site }) => {
    const tab = await openTab(page, site.url('/a'))
    const today = page.getByTestId('today')
    await expect(today.getByTestId('tab')).toHaveText(['Page A'])

    await page.evaluate(
      (tabId) =>
        window.bigBrowser.invoke('browser.moveTab', { tabId, section: 'pinned', index: 0 }),
      tab.id,
    )
    const pinned = page.getByTestId('pinned')
    await expect(pinned.getByTestId('tab')).toHaveText(['Page A'])
    await expect(today.getByTestId('tab')).toHaveCount(0)

    const folder = await page.evaluate(() =>
      window.bigBrowser.invoke('browser.createFolder', { name: 'Reading' }),
    )
    await page.evaluate(
      ({ tabId, folderId }) =>
        window.bigBrowser.invoke('browser.moveTab', {
          tabId,
          section: 'pinned',
          folderId,
          index: 0,
        }),
      { tabId: tab.id, folderId: folder.id },
    )
    const folderRow = pinned.getByTestId('folder')
    await expect(folderRow.getByTestId('tab')).toHaveText(['Page A'])

    // A click on the folder row collapses it: its tab stays mounted but is no longer shown.
    await folderRow.getByRole('button', { name: 'Reading' }).click()
    await expect(folderRow.getByTestId('tab')).toHaveCount(1)
    await expect(folderRow.getByRole('button', { name: 'Page A' })).toHaveCount(0)
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

test('folders nest: a folder moved into another is drawn inside it, folded with it', async () => {
  await withBrowser(async ({ page, site }) => {
    const tab = await openTab(page, site.url('/a'))
    const [outer, inner] = await page.evaluate(async () => [
      await window.bigBrowser.invoke('browser.createFolder', { name: 'Outer' }),
      await window.bigBrowser.invoke('browser.createFolder', { name: 'Inner' }),
    ])
    if (!outer || !inner) throw new Error('folders not created')
    await page.evaluate(
      ({ tabId, folderId }) =>
        window.bigBrowser.invoke('browser.moveTab', {
          tabId,
          section: 'pinned',
          folderId,
          index: 0,
        }),
      { tabId: tab.id, folderId: inner.id },
    )
    const pinned = page.getByTestId('pinned')
    await expect(pinned.getByTestId('folder')).toHaveCount(2)

    await page.evaluate(
      ({ folderId, parentId }) =>
        window.bigBrowser.invoke('browser.moveFolder', { folderId, parentId, index: 0 }),
      { folderId: inner.id, parentId: outer.id },
    )
    const outerButton = pinned.getByRole('button', { name: 'Outer', exact: true })
    const outerRow = pinned
      .getByTestId('folder')
      .filter({ has: page.getByRole('button', { name: 'Outer', exact: true }) })
    // The inner folder (with its tab) is now one of the outer folder's children, one step in.
    const innerButton = outerRow.getByRole('button', { name: 'Inner', exact: true })
    await expect(innerButton).toBeVisible()
    await expect(outerRow.getByTestId('folder').getByTestId('tab')).toHaveText(['Page A'])
    const outerBox = await outerButton.boundingBox()
    const innerBox = await innerButton.boundingBox()
    expect(innerBox?.x ?? 0).toBeGreaterThan(outerBox?.x ?? 0)

    // Folding the outer folder hides both: its rows stay mounted, out of the accessibility tree.
    await outerButton.click()
    await expect(outerButton).toHaveAttribute('aria-expanded', 'false')
    await expect(outerRow.getByTestId('folder')).toHaveCount(1)
    await expect(outerRow.getByTestId('tab')).toHaveCount(1)
    await expect(outerRow.getByRole('button', { name: 'Inner', exact: true })).toHaveCount(0)
    await expect(outerRow.getByRole('button', { name: 'Page A' })).toHaveCount(0)
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
    await expect(auto.getByRole('button', { name: 'Page A' })).toHaveCount(0)
    await folderButton.click()
    await expect(auto.getByRole('button', { name: 'Page A' })).toHaveCount(1)

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
    window.bigBrowser
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
      (tabId) =>
        window.bigBrowser.invoke('browser.moveTab', { tabId, section: 'pinned', index: 0 }),
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
      window.bigBrowser.invoke('browser.createFolder', { name: 'Reading' }),
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

/** Presses on the first today tab and moves the pointer onto the lower half of the third. */
async function liftFirstOntoThird(page: Page): Promise<void> {
  const rows = page.getByTestId('today').getByTestId('tab')
  const first = await rows.nth(0).boundingBox()
  if (!first) throw new Error('No tab row')
  await page.mouse.move(first.x + 40, first.y + first.height / 2)
  await page.mouse.down()
  await page.mouse.move(first.x + 40, first.y + first.height / 2 + 6, { steps: 2 })
  // Lifted: the empty favourites grid now pushes the rows down, so the third is measured now.
  await expect(page.getByTestId('drag-clone')).toHaveCount(1)
  const third = await rows.nth(2).boundingBox()
  if (!third) throw new Error('No third tab row')
  await page.mouse.move(first.x + 40, third.y + third.height * 0.75, { steps: 6 })
}

/** The CSS `translate` of the nth today row ('none' when it does not move). */
const rowTranslate = (page: Page, nth: number) =>
  page
    .getByTestId('today')
    .getByTestId('tab')
    .nth(nth)
    .evaluate((el) => getComputedStyle(el).translate)

test('dragging lifts the row and opens a gap', async () => {
  await withBrowser(async ({ page, site }) => {
    await openTab(page, site.url('/a'))
    await openTab(page, site.url('/b'))
    await openTab(page, site.url('/c'))
    const today = page.getByTestId('today')
    await expect(today.getByTestId('tab')).toHaveText(['Page A', 'Page B', 'Page C'])

    await liftFirstOntoThird(page)
    // The row lifts: a clone follows the pointer, scaled up; the row itself keeps its slot.
    const clone = page.getByTestId('drag-clone')
    await expect(clone).toHaveCount(1)
    await expect(clone).toHaveCSS('scale', '1.03')
    await expect(today.getByTestId('tab').first()).toHaveCSS('visibility', 'hidden')
    // The rows it passes move up into its slot: the gap opens after Page C.
    await expect.poll(() => rowTranslate(page, 1)).not.toBe('none')
    await expect.poll(() => rowTranslate(page, 2)).not.toBe('none')
    await expect(page.getByTestId('drop-line')).toHaveCount(0)

    await page.mouse.up()
    await expect(today.getByTestId('tab')).toHaveText(['Page B', 'Page C', 'Page A'])
    await expect(clone).toHaveCount(0)
    await expect.poll(() => rowTranslate(page, 0)).toBe('none')
    await expect(today.getByTestId('tab').last()).toHaveCSS('visibility', 'visible')
  })
})

test('Escape cancels a drag', async () => {
  await withBrowser(async ({ page, site }) => {
    await openTab(page, site.url('/a'))
    await openTab(page, site.url('/b'))
    await openTab(page, site.url('/c'))
    const today = page.getByTestId('today')
    await expect(today.getByTestId('tab')).toHaveText(['Page A', 'Page B', 'Page C'])

    await liftFirstOntoThird(page)
    const clone = page.getByTestId('drag-clone')
    await expect(clone).toHaveCount(1)
    await expect.poll(() => rowTranslate(page, 1)).not.toBe('none')

    await page.keyboard.press('Escape')
    // The clone flies back and goes; the rows close the gap. The release moves nothing.
    await expect(clone).toHaveCount(0)
    await expect.poll(() => rowTranslate(page, 1)).toBe('none')
    await page.mouse.up()
    await expect(today.getByTestId('tab').first()).toHaveCSS('visibility', 'visible')
    await expect(today.getByTestId('tab')).toHaveText(['Page A', 'Page B', 'Page C'])
    // Nor did the release activate the pressed tab (Page C, the last opened, stays active).
    await expect(today.getByRole('button', { name: 'Page C' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})

test('leaving the window cancels a drag', async () => {
  await withBrowser(async ({ page, site }) => {
    await openTab(page, site.url('/a'))
    await openTab(page, site.url('/b'))
    await openTab(page, site.url('/c'))
    const today = page.getByTestId('today')
    await expect(today.getByTestId('tab')).toHaveText(['Page A', 'Page B', 'Page C'])

    await liftFirstOntoThird(page)
    const clone = page.getByTestId('drag-clone')
    await expect(clone).toHaveCount(1)

    // Alt-Tab mid-drag: the window loses focus (dispatched here, OS focus is not reliable).
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    await expect(clone).toHaveCount(0)
    await expect.poll(() => rowTranslate(page, 1)).toBe('none')
    // A release much later moves nothing.
    await page.mouse.up()
    await expect(today.getByTestId('tab').first()).toHaveCSS('visibility', 'visible')
    await expect(today.getByTestId('tab')).toHaveText(['Page A', 'Page B', 'Page C'])
  })
})

test('a folder drags into a folder', async () => {
  await withBrowser(async ({ page, site }) => {
    const tab = await openTab(page, site.url('/a'))
    const [outer, inner] = await page.evaluate(async () => [
      await window.bigBrowser.invoke('browser.createFolder', { name: 'Outer' }),
      await window.bigBrowser.invoke('browser.createFolder', { name: 'Inner' }),
    ])
    if (!outer || !inner) throw new Error('folders not created')
    await page.evaluate(
      ({ tabId, folderId }) =>
        window.bigBrowser.invoke('browser.moveTab', {
          tabId,
          section: 'pinned',
          folderId,
          index: 0,
        }),
      { tabId: tab.id, folderId: inner.id },
    )
    const pinned = page.getByTestId('pinned')
    const outerButton = pinned.getByRole('button', { name: 'Outer', exact: true })
    const innerButton = pinned.getByRole('button', { name: 'Inner', exact: true })
    await expect(innerButton).toBeVisible()

    // The inner folder (with its tab) lifts and is dropped on the middle of the outer one's row.
    const from = await innerButton.boundingBox()
    const to = await outerButton.boundingBox()
    if (!from || !to) throw new Error('No folder rows')
    await page.mouse.move(from.x + 40, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(to.x + 40, to.y + to.height / 2, { steps: 6 })
    await expect(page.getByTestId('drag-clone')).toHaveCount(1)
    // The outer folder's row is lit: the drop goes into it.
    await expect(pinned.getByTestId('folder').first().locator('[data-drop-target]')).toHaveCount(1)
    await page.mouse.up()

    const outerRow = pinned
      .getByTestId('folder')
      .filter({ has: page.getByRole('button', { name: 'Outer', exact: true }) })
    await expect(outerRow.getByRole('button', { name: 'Inner', exact: true })).toBeVisible()
    await expect(outerRow.getByTestId('folder').getByTestId('tab')).toHaveText(['Page A'])
    const folders = await page.evaluate(() =>
      window.bigBrowser
        .invoke('browser.state')
        .then((state) => state.folders.map((f) => ({ name: f.name, parentId: f.parentId }))),
    )
    expect(folders).toContainEqual({ name: 'Inner', parentId: outer.id })
    // The release did not fold the dropped folder (its click is swallowed).
    await expect(outerButton).toHaveAttribute('aria-expanded', 'true')
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
  const userData = mkdtempSync(join(tmpdir(), 'big-browser-e2e-'))
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
            window.bigBrowser.invoke('browser.moveTab', {
              tabId: id,
              section: 'favorites',
              index: 0,
            }),
          tabId,
        )
      }
    }
    await moveToFavorites(ids.slice(0, 3))
    await expect(tiles).toHaveCount(3)
    const tileHeight = await tiles.first().evaluate((el) => (el as HTMLElement).offsetHeight)
    expect(tileHeight).toBe(41)
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

test('closing a tab animates its row out', async () => {
  await withBrowser(async ({ page, site }) => {
    // Three tabs of one site would be an automatic folder, which dissolves when one closes.
    await page.evaluate(() => window.bigBrowser.invoke('settings.update', { autoFolders: false }))
    await openTab(page, site.url('/a'))
    const second = await openTab(page, site.url('/b'))
    await openTab(page, site.url('/c'))
    const today = page.getByTestId('today')
    await expect(today.getByTestId('tab')).toHaveText(['Page A', 'Page B', 'Page C'])
    const remaining = ['Page A', 'Page C']

    // Watches the DOM through the exit: an exiting row shows up, and the live rows never change.
    const seen = await page.evaluate(async (tabId) => {
      const list = document.querySelector('[data-testid=today]')
      if (!list) throw new Error('no today list')
      const live = (): string =>
        [...list.querySelectorAll('[data-testid=tab]')].map((e) => e.textContent).join('|')
      const lives = new Set<string>([live()])
      let exiting = 0
      const observer = new MutationObserver(() => {
        lives.add(live())
        exiting = Math.max(exiting, list.querySelectorAll('[data-testid=tab-exiting]').length)
      })
      observer.observe(list, { childList: true, subtree: true, attributes: true })
      await window.bigBrowser.invoke('browser.closeTab', { tabId })
      await new Promise((resolve) => setTimeout(resolve, 600))
      observer.disconnect()
      return {
        exiting,
        lives: [...lives],
        after: list.querySelectorAll('[data-testid=tab-exiting]').length,
      }
    }, second.id)
    expect(seen.exiting).toBe(1)
    expect(seen.after).toBe(0)
    // Right after the close the rows read Page A and Page C, never anything else.
    expect(seen.lives.filter((titles) => titles !== 'Page A|Page B|Page C')).toEqual([
      remaining.join('|'),
    ])
    await expect(today.getByTestId('tab')).toHaveText(remaining)
  })
})

/**
 * Sends one bridge command and returns the most exiting rows the sidebar drew at once while it
 * applied (watched for 600 ms, past the exit animation).
 */
async function exitingDuring(page: Page, channel: string, input: unknown): Promise<number> {
  return page.evaluate(
    async ({ channel, input }) => {
      const sidebar = document.querySelector('[data-testid=sidebar]')
      if (!sidebar) throw new Error('no sidebar')
      let exiting = 0
      const observer = new MutationObserver(() => {
        exiting = Math.max(exiting, sidebar.querySelectorAll('[data-testid=tab-exiting]').length)
      })
      observer.observe(sidebar, { childList: true, subtree: true, attributes: true })
      const invoke = window.bigBrowser.invoke as (
        channel: string,
        input: unknown,
      ) => Promise<unknown>
      await invoke(channel, input)
      await new Promise((resolve) => setTimeout(resolve, 600))
      observer.disconnect()
      return exiting
    },
    { channel, input },
  )
}

test('switching space draws no exiting rows', async () => {
  await withBrowser(async ({ page, site }) => {
    await openTab(page, site.url('/a'))
    await openTab(page, site.url('/b'))
    const home = await page.evaluate(() =>
      window.bigBrowser.invoke('browser.state').then((s) => s.activeSpaceId),
    )
    const work = await page.evaluate(() =>
      window.bigBrowser.invoke('browser.createSpace', { name: 'Work', color: '#3366ff' }),
    )
    await page.evaluate(
      ({ spaceId, input }) => window.bigBrowser.invoke('browser.openTab', { spaceId, input }),
      { spaceId: work.id, input: site.url('/c') },
    )
    await page.evaluate(
      (spaceId) => window.bigBrowser.invoke('browser.activateSpace', { spaceId }),
      home,
    )
    const today = page.getByTestId('today')
    await expect(today.getByTestId('tab')).toHaveText(['Page A', 'Page B'])

    expect(await exitingDuring(page, 'browser.activateSpace', { spaceId: work.id })).toBe(0)
    await expect(today.getByTestId('tab')).toHaveText(['Page C'])
    expect(await exitingDuring(page, 'browser.activateSpace', { spaceId: home })).toBe(0)
    await expect(today.getByTestId('tab')).toHaveText(['Page A', 'Page B'])
  })
})

test('moving a tab draws no exiting row', async () => {
  await withBrowser(async ({ page, site }) => {
    await page.evaluate(() => window.bigBrowser.invoke('settings.update', { autoFolders: false }))
    const a = await openTab(page, site.url('/a'))
    const b = await openTab(page, site.url('/b'))
    const folder = await page.evaluate(() =>
      window.bigBrowser.invoke('browser.createFolder', { name: 'Reading' }),
    )
    const today = page.getByTestId('today')
    await expect(today.getByTestId('tab')).toHaveText(['Page A', 'Page B'])

    // Into a pinned folder, then out of it to the top of pinned, then back to today.
    const move = { tabId: a.id, section: 'pinned', folderId: folder.id, index: 0 }
    expect(await exitingDuring(page, 'browser.moveTab', move)).toBe(0)
    const folderRow = page.getByTestId('pinned').getByTestId('folder')
    await expect(folderRow.getByTestId('tab')).toHaveText(['Page A'])
    const unfile = { tabId: a.id, section: 'pinned', folderId: null, index: 0 }
    expect(await exitingDuring(page, 'browser.moveTab', unfile)).toBe(0)
    const back = { tabId: b.id, section: 'pinned', index: 0 }
    expect(await exitingDuring(page, 'browser.moveTab', back)).toBe(0)
    await expect(page.getByTestId('pinned').getByTestId('tab')).toHaveCount(2)
    await expect(today.getByTestId('tab')).toHaveCount(0)
  })
})

test('a third tab of one site folds the others into an automatic folder without exiting rows', async () => {
  await withBrowser(async ({ page, site }) => {
    await openTab(page, site.url('/a'))
    await openTab(page, site.url('/b'))
    const today = page.getByTestId('today')
    await expect(today.getByTestId('tab')).toHaveText(['Page A', 'Page B'])

    expect(await exitingDuring(page, 'browser.openTab', { input: site.url('/c') })).toBe(0)
    await expect(today.getByTestId('auto-folder').getByTestId('tab')).toHaveText([
      'Page A',
      'Page B',
      'Page C',
    ])
  })
})

test('collapsing a folder keeps its tab rows in the DOM but hides them from assistive tech', async () => {
  await withBrowser(async ({ page, site }) => {
    const tab = await openTab(page, site.url('/a'))
    const folder = await page.evaluate(() =>
      window.bigBrowser.invoke('browser.createFolder', { name: 'Reading' }),
    )
    await page.evaluate(
      ({ tabId, folderId }) =>
        window.bigBrowser.invoke('browser.moveTab', {
          tabId,
          section: 'pinned',
          folderId,
          index: 0,
        }),
      { tabId: tab.id, folderId: folder.id },
    )
    const folderRow = page.getByTestId('pinned').getByTestId('folder')
    await expect(folderRow.getByRole('button', { name: 'Page A' })).toHaveCount(1)

    await folderRow.getByRole('button', { name: 'Reading' }).click()
    await expect(folderRow.getByTestId('tab')).toHaveCount(1)
    await expect(folderRow.getByRole('button', { name: 'Page A' })).toHaveCount(0)

    await folderRow.getByRole('button', { name: 'Reading' }).click()
    await expect(folderRow.getByRole('button', { name: 'Page A' })).toHaveCount(1)
  })
})

/** Whether the overlay view is shown, and its bounds (window DIP). */
const overlayView = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => {
    const view = BrowserWindow.getAllWindows()[0]?.contentView.children.find(
      (v) =>
        'webContents' in v && (v.webContents as Electron.WebContents).getURL().endsWith('#overlay'),
    )
    const contents =
      view && 'webContents' in view ? (view.webContents as Electron.WebContents) : null
    return {
      visible: view?.getVisible() ?? false,
      bounds: view?.getBounds(),
      focused: contents?.isFocused() ?? false,
    }
  })

test('tooltips slide from row to row', async () => {
  await withBrowser(async ({ app, page, site }) => {
    await openTab(page, site.url('/b'))
    await openTab(page, site.url('/a'))
    await page.evaluate(() => window.bigBrowser.invoke('browser.createFolder', { name: 'Reading' }))
    const folderRow = page.getByTestId('pinned').getByRole('button', { name: 'Reading' })
    await expect(folderRow).toBeVisible()
    const today = page.getByTestId('today')
    const rowA = today.getByRole('button', { name: 'Page A', exact: true })
    const rowB = today.getByRole('button', { name: 'Page B', exact: true })
    await expect(rowA).toBeVisible()
    // Replaced by the overlay's tooltip.
    await expect(rowA).not.toHaveAttribute('title')

    const overlay = await overlayPage(app)
    const tooltip = overlay.getByTestId('tooltip')
    await rowA.hover()
    expect(await tooltip.count()).toBe(0)
    await expect(tooltip).toContainText('Page A')
    await expect(tooltip).toContainText('127.0.0.1')
    // A strip over the page beside the sidebar, never focused.
    const sidebar = await page.getByTestId('sidebar').boundingBox()
    if (!sidebar) throw new Error('sidebar not found')
    const shown = await overlayView(app)
    expect(shown.visible).toBe(true)
    expect(shown.bounds?.x).toBeGreaterThanOrEqual(Math.floor(sidebar.x + sidebar.width))
    expect(shown.bounds?.width).toBe(320)
    expect(shown.focused).toBe(false)

    // Another row: the same card slides there, never gone in between.
    const key = await tooltip.getAttribute('data-key')
    await overlay.evaluate(() => {
      const w = window as unknown as { tooltipGaps: number }
      w.tooltipGaps = 0
      new MutationObserver(() => {
        if (document.querySelectorAll('[data-testid="tooltip"]').length !== 1) w.tooltipGaps++
      }).observe(document.body, { childList: true, subtree: true })
    })
    await rowB.hover()
    await expect(tooltip).toContainText('Page B')
    expect(await tooltip.getAttribute('data-key')).toBe(key)
    expect(
      await overlay.evaluate(() => (window as unknown as { tooltipGaps: number }).tooltipGaps),
    ).toBe(0)

    // Off the tab rows (a folder row keeps its native title), the tooltip goes, and a row left
    // before the delay never shows one.
    await folderRow.hover()
    await expect(tooltip).toHaveCount(0)
    await rowA.hover()
    await folderRow.hover()
    await page.waitForTimeout(700)
    await expect(tooltip).toHaveCount(0)
    await rowB.hover()
    await expect(tooltip).toContainText('Page B')

    // The pointer leaves the sidebar onto the page, over the strip: the tooltip hides at once, and
    // the click reaches the page.
    const rowBox = await rowB.boundingBox()
    if (!rowBox) throw new Error('row not found')
    await overlay.mouse.move(40, rowBox.y)
    await page.mouse.move(sidebar.x + sidebar.width + 40, rowBox.y)
    await expect.poll(async () => (await overlayView(app)).visible).toBe(false)
    const tabPage = app.windows().find((p) => p.url() === site.url('/a'))
    if (!tabPage) throw new Error('tab page not found')
    await tabPage.locator('#b').click()
    await expect(page.getByTestId('url-rest')).toHaveText('/b')

    // A menu wins: opening it drops the tooltip, and hovering rows while it is open shows none.
    // (Both tabs now show Page B.)
    const rows = today.getByTestId('tab').getByRole('button', { name: 'Page B', exact: true })
    await expect(rows).toHaveCount(2)
    await rows.first().hover()
    await expect(tooltip).toContainText('Page B')
    await page.getByRole('button', { name: 'New tab, space or settings' }).click()
    await expect(overlay.getByTestId('menu')).toBeVisible()
    await expect(tooltip).toHaveCount(0)
    await rows.last().hover()
    await page.waitForTimeout(700)
    await expect(tooltip).toHaveCount(0)
    await expect(overlay.getByTestId('menu')).toBeVisible()
    expect((await overlayView(app)).bounds?.x).toBe(0)
  })
})

test('a huge page title keeps its tooltip small', async () => {
  await withBrowser(async ({ app, page, site }) => {
    await openTab(page, site.url('/huge'))
    const row = page.getByTestId('today').getByTestId('tab').getByRole('button').first()
    await expect(row).toHaveAccessibleName(/^Huge title/)
    const overlay = await overlayPage(app)
    const tooltip = overlay.getByTestId('tooltip')
    await row.hover()
    await expect(tooltip).toContainText('Huge title')
    // Two lines of title and one of detail at most, far from the window's height.
    const box = await tooltip.boundingBox()
    if (!box) throw new Error('tooltip has no box')
    expect(box.height).toBeLessThan(150)
  })
})

test('the folder menu moves a folder', async () => {
  await withBrowser(async ({ app, page }) => {
    const [outer, inner] = await page.evaluate(async () => [
      await window.bigBrowser.invoke('browser.createFolder', { name: 'Outer' }),
      await window.bigBrowser.invoke('browser.createFolder', { name: 'Inner' }),
    ])
    if (!outer || !inner) throw new Error('folders not created')
    const pinned = page.getByTestId('pinned')
    await pinned.getByRole('button', { name: 'Inner', exact: true }).click({ button: 'right' })

    const overlay = await overlayPage(app)
    const menu = overlay.getByTestId('menu')
    await expect(menu.getByRole('menuitem')).toHaveText([
      'Rename',
      'Change Icon…',
      'Move to Folder',
      'Delete Folder',
    ])
    await menu.getByRole('menuitem', { name: 'Move to Folder' }).hover()
    const submenu = overlay.getByTestId('submenu')
    // Top level (where it is), then every folder outside its own subtree.
    await expect(submenu.getByRole('menuitem')).toHaveText(['Top level', 'Outer'])
    await expect(submenu.getByRole('menuitem', { name: 'Top level' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await submenu.getByRole('menuitem', { name: 'Outer' }).click()
    await expect(menu).toHaveCount(0)

    const outerRow = pinned
      .getByTestId('folder')
      .filter({ has: page.getByRole('button', { name: 'Outer', exact: true }) })
    await expect(outerRow.getByRole('button', { name: 'Inner', exact: true })).toBeVisible()
  })
})

/** The active space as main stores it. */
const activeSpace = (page: Page) =>
  page.evaluate(async () => {
    const state = await window.bigBrowser.invoke('browser.state')
    const space = state.spaces.find((s) => s.id === state.activeSpaceId)
    if (!space) throw new Error('no active space')
    return space
  })

/** Opens the active space's menu from its header's "…" button. */
async function openSpaceMenu(app: ElectronApplication, page: Page) {
  const header = page.getByTestId('space-header')
  await header.hover()
  await header.getByRole('button', { name: 'Space options' }).click()
  const overlay = await overlayPage(app)
  const menu = overlay.getByTestId('menu')
  await expect(menu).toBeVisible()
  return { overlay, menu }
}

test('the space section holds pinned items', async () => {
  await withBrowser(async ({ page, site }) => {
    const pinnedTab = await openTab(page, site.url('/a'))
    await openTab(page, site.url('/b'))
    await page.evaluate(
      (tabId) =>
        window.bigBrowser.invoke('browser.moveTab', { tabId, section: 'pinned', index: 0 }),
      pinnedTab.id,
    )
    const space = await activeSpace(page)
    await expect(page.getByTestId('space-header')).toContainText(space.name)

    const section = page.getByTestId('space-section')
    await expect(section.getByTestId('pinned').getByTestId('tab')).toHaveText(['Page A'])
    await expect(section.getByTestId('today')).toHaveCount(0)
    await expect(page.getByTestId('today').getByTestId('tab')).toHaveText(['Page B'])
  })
})

test('the space icon becomes a chevron', async () => {
  await withBrowser(async ({ app, page, site }) => {
    const tab = await openTab(page, site.url('/a'))
    await page.evaluate(
      (tabId) =>
        window.bigBrowser.invoke('browser.moveTab', { tabId, section: 'pinned', index: 0 }),
      tab.id,
    )

    // Change Space Icon…: an emoji field and a row of common emojis.
    const { overlay, menu } = await openSpaceMenu(app, page)
    await menu.getByRole('menuitem', { name: 'Change Space Icon…' }).click()
    const card = overlay.getByTestId('space-icon')
    await expect(card).toBeVisible()
    await expect(card.getByRole('button', { name: /^Use / })).toHaveCount(16)
    await card.getByRole('button', { name: 'Use 🚀' }).click()
    await expect(card).toHaveCount(0)
    await expect.poll(async () => (await activeSpace(page)).icon).toBe('🚀')

    const header = page.getByTestId('space-header')
    const space = await activeSpace(page)
    await expect(header).toContainText('🚀')
    // The footer's dot shows the emoji too.
    await expect(
      page.getByRole('tablist', { name: 'Spaces' }).getByRole('tab', { name: space.name }),
    ).toHaveText('🚀')

    // The emoji turns into a chevron on hover, which folds the section.
    await page.mouse.move(600, 400)
    await expect(header.getByTestId('space-chevron')).toBeHidden()
    await header.hover()
    await expect(header.getByTestId('space-chevron')).toBeVisible()
    await header.getByRole('button', { name: 'Collapse space section' }).click()
    const section = page.getByTestId('space-section')
    await expect(section).toHaveAttribute('inert', '')
    await expect(section.getByTestId('tab')).toHaveCount(1)
    await expect(section.getByRole('button', { name: 'Page A' })).toHaveCount(0)
    await expect.poll(async () => (await activeSpace(page)).sectionCollapsed).toBe(true)

    await header.getByRole('button', { name: 'Expand space section' }).click()
    await expect(section).not.toHaveAttribute('inert')
    await expect.poll(async () => (await activeSpace(page)).sectionCollapsed).toBe(false)

    // The emoji field keeps the first character typed; No icon goes back to the colour dot.
    const typed = await openSpaceMenu(app, page)
    await typed.menu.getByRole('menuitem', { name: 'Change Space Icon…' }).click()
    await typed.overlay.getByTestId('space-icon').getByLabel('Emoji').fill('🌱🌵')
    await expect.poll(async () => (await activeSpace(page)).icon).toBe('🌱')
    const again = await openSpaceMenu(app, page)
    await again.menu.getByRole('menuitem', { name: 'Change Space Icon…' }).click()
    await again.overlay.getByTestId('space-icon').getByRole('button', { name: 'No icon' }).click()
    await expect.poll(async () => (await activeSpace(page)).icon).toBe(null)
    await expect(header).not.toContainText('🌱')

    // Letters are refused with a hint (nothing is saved); the current emoji closes the card.
    await expect.poll(async () => (await activeSpace(page)).icon).toBe(null)
    const picky = await openSpaceMenu(app, page)
    await picky.menu.getByRole('menuitem', { name: 'Change Space Icon…' }).click()
    const pickyCard = picky.overlay.getByTestId('space-icon')
    await pickyCard.getByLabel('Emoji').fill('a')
    await expect(pickyCard.getByRole('alert')).toHaveText('Only emojis work here.')
    expect((await activeSpace(page)).icon).toBe(null)
    await pickyCard.getByRole('button', { name: 'Use 🚀' }).click()
    await expect.poll(async () => (await activeSpace(page)).icon).toBe('🚀')
    const same = await openSpaceMenu(app, page)
    await same.menu.getByRole('menuitem', { name: 'Change Space Icon…' }).click()
    // Typed over the selected current emoji (fill would change nothing).
    const field = same.overlay.getByTestId('space-icon').getByLabel('Emoji')
    await field.press('Control+A')
    await field.pressSequentially('🚀')
    await expect(same.overlay.getByTestId('space-icon')).toHaveCount(0)
  })
})

/** A folder's `icon` as main stores it. */
const folderIconOf = (page: Page, name: string) =>
  page.evaluate(async (folderName) => {
    const state = await window.bigBrowser.invoke('browser.state')
    const folder = state.folders.find((f) => f.name === folderName)
    if (!folder) throw new Error('no folder')
    return folder.icon
  }, name)

test('a folder takes a hue or an emoji', async () => {
  await withBrowser(async ({ app, page }) => {
    await page.evaluate(() => window.bigBrowser.invoke('browser.createFolder', { name: 'Reading' }))
    const pinned = page.getByTestId('pinned')
    const row = pinned.getByRole('button', { name: 'Reading', exact: true })
    const openCard = async () => {
      await row.click({ button: 'right' })
      const overlay = await overlayPage(app)
      await overlay.getByTestId('menu').getByRole('menuitem', { name: 'Change Icon…' }).click()
      const card = overlay.getByTestId('folder-icon')
      await expect(card).toBeVisible()
      return { overlay, card }
    }

    // The 3rd hue (330) recolours the glyph.
    const first = await openCard()
    await first.card.getByRole('radio').nth(2).click()
    await expect(first.card).toHaveCount(0)
    await expect.poll(() => folderIconOf(page, 'Reading')).toBe('hue:330')
    await expect(row.getByTestId('folder-glyph')).toHaveCSS('--hue', '330')

    // An emoji replaces the glyph.
    const second = await openCard()
    await second.card.getByLabel('Emoji').fill('🎧')
    await expect.poll(() => folderIconOf(page, 'Reading')).toBe('🎧')
    await expect(row.getByTestId('folder-emoji')).toHaveText('🎧')
    await expect(row.getByTestId('folder-glyph')).toHaveCount(0)

    // Default brings the glyph back.
    const third = await openCard()
    await third.card.getByRole('button', { name: 'Default' }).click()
    await expect.poll(() => folderIconOf(page, 'Reading')).toBe(null)
    await expect(row.getByTestId('folder-glyph')).toBeVisible()
    await expect(row.getByTestId('folder-emoji')).toHaveCount(0)
  })
})

test('opening a folder swings its flap and lifts the paper', async () => {
  await withBrowser(async ({ page }) => {
    await page.evaluate(() => window.bigBrowser.invoke('browser.createFolder', { name: 'Reading' }))
    const row = page.getByTestId('pinned').getByRole('button', { name: 'Reading', exact: true })
    const glyph = row.getByTestId('folder-glyph')
    const flap = glyph.locator('path').nth(1)
    await expect(glyph).toHaveAttribute('data-open', 'true')
    const open = await flap.evaluate((el) => getComputedStyle(el).transform)
    await row.click()
    await expect(glyph).toHaveAttribute('data-open', 'false')
    await expect.poll(() => flap.evaluate((el) => getComputedStyle(el).transform)).not.toBe(open)
    await expect(glyph.locator('rect')).toHaveCSS('opacity', '0')
  })
})

test('the space menu', async () => {
  await withBrowser(async ({ app, page }) => {
    // One space: it can't be deleted.
    let { overlay, menu } = await openSpaceMenu(app, page)
    await expect(menu.getByLabel('Filter')).toBeFocused()
    await expect(menu.getByRole('menuitem')).toHaveText([
      'Rename Space…',
      'Change Space Icon…',
      'Edit Look…',
      'New Folder',
      'Space Settings…',
      /^Delete Space…/,
    ])
    const remove = menu.getByRole('menuitem', { name: /^Delete Space…/ })
    await expect(remove).toHaveAttribute('aria-disabled', 'true')
    await expect(remove).toContainText('⌘⌫')

    // Hovering a row leaves the keyboard in the filter field.
    await menu.getByRole('menuitem', { name: 'Edit Look…' }).hover()
    await overlay.keyboard.type('del')
    await expect(menu.getByLabel('Filter')).toHaveValue('del')
    await expect(menu.getByRole('menuitem')).toHaveText([/^Delete Space…/])
    await overlay.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)

    // Edit Look…: the colour picker recolours the space.
    ;({ overlay, menu } = await openSpaceMenu(app, page))
    await menu.getByRole('menuitem', { name: 'Edit Look…' }).click()
    const look = overlay.getByTestId('space-color')
    await expect(look).toBeVisible()
    await look.getByRole('radio', { name: '#2BB673' }).click()
    await expect.poll(async () => (await activeSpace(page)).color).toBe('#2BB673')
    await overlay.keyboard.press('Escape')
    await expect(look).toHaveCount(0)

    // New Folder: created in this space, its name edited at once.
    ;({ menu } = await openSpaceMenu(app, page))
    await menu.getByRole('menuitem', { name: 'New Folder' }).click()
    const folderName = page.getByTestId('pinned').getByLabel('Folder name')
    await expect(folderName).toBeFocused()
    await folderName.press('Escape')

    // Space Settings… opens Settings.
    ;({ menu } = await openSpaceMenu(app, page))
    await menu.getByRole('menuitem', { name: 'Space Settings…' }).click()
    await expect(page.getByTestId('settings')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('settings')).toHaveCount(0)

    // Two spaces: Delete Space… asks first, then deletes and shows the other space.
    const first = await activeSpace(page)
    const second = await page.evaluate(() =>
      window.bigBrowser.invoke('browser.createSpace', { name: 'Work', color: '#2D9CDB' }),
    )
    await page.evaluate(
      (spaceId) => window.bigBrowser.invoke('browser.activateSpace', { spaceId }),
      second.id,
    )
    await expect(page.getByTestId('space-header')).toContainText('Work')
    ;({ overlay, menu } = await openSpaceMenu(app, page))
    await menu.getByLabel('Filter').pressSequentially('del')
    await expect(menu.getByRole('menuitem')).toHaveText([/^Delete Space…/])
    await menu.getByRole('menuitem', { name: /^Delete Space…/ }).click()
    const confirm = overlay.getByTestId('confirm')
    await expect(confirm).toContainText(
      'Delete “Work”? Its tabs, sign-ins, cookies and extensions will be deleted.',
    )
    await confirm.getByRole('button', { name: 'Delete' }).click()
    await expect(confirm).toHaveCount(0)
    const spaceIds = async () =>
      (await page.evaluate(() => window.bigBrowser.invoke('browser.state'))).spaces.map((s) => s.id)
    await expect.poll(spaceIds).toEqual([first.id])
    expect((await activeSpace(page)).id).toBe(first.id)
    await expect(page.getByTestId('space-header')).toContainText(first.name)
  })
})

test('rename space is ignored while the sidebar is icon-only', async () => {
  await withBrowser(async ({ app, page }) => {
    const sidebar = page.getByTestId('sidebar')
    await page.getByRole('button', { name: 'Icons only' }).click()
    await expect(sidebar).toHaveAttribute('data-compact', 'true')
    // Icon-only, the "…" button is hidden: the menu opens from a right-click on the header.
    await page.getByTestId('space-header').click({ button: 'right' })
    const menu = (await overlayPage(app)).getByTestId('menu')
    await menu.getByRole('menuitem', { name: 'Rename Space…' }).click()
    await expect(menu).toHaveCount(0)

    // Widened again, no stale field comes back unfocused.
    await page.getByRole('button', { name: 'Expand sidebar' }).click()
    await expect(sidebar).toHaveAttribute('data-compact', 'false')
    await expect(page.getByTestId('space-header').getByLabel('Space name')).toHaveCount(0)
  })
})

test('rename in place', async () => {
  await withBrowser(async ({ app, page }) => {
    const { menu } = await openSpaceMenu(app, page)
    await menu.getByRole('menuitem', { name: 'Rename Space…' }).click()
    const name = page.getByTestId('space-header').getByLabel('Space name')
    await expect(name).toBeFocused()
    await name.fill('Reading')
    await name.press('Enter')
    await expect(name).toHaveCount(0)
    await expect(page.getByTestId('space-header')).toContainText('Reading')
    await expect.poll(async () => (await activeSpace(page)).name).toBe('Reading')

    // Escape keeps the name.
    const again = await openSpaceMenu(app, page)
    await again.menu.getByRole('menuitem', { name: 'Rename Space…' }).click()
    await expect(name).toBeFocused()
    await name.fill('Other')
    await name.press('Escape')
    await expect(name).toHaveCount(0)
    expect((await activeSpace(page)).name).toBe('Reading')
  })
})

test('a split is one row', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'big-browser-e2e-'))
  const site = await startSite()
  const clickMenu = (app: ElectronApplication, id: string) =>
    app.evaluate(
      ({ Menu }, itemId) => Menu.getApplicationMenu()?.getMenuItemById(itemId)?.click(),
      id,
    )
  try {
    const first = await launchApp(userData)
    try {
      const page = await uiPage(first)
      await finishOnboarding(page)
      await openTab(page, site.url('/a'))
      await openTab(page, site.url('/b'))
      await openTab(page, site.url('/c'))
      await expect(page.getByTestId('tab')).toHaveCount(3)

      // ⌃⌘\ pairs the active tab with a neighbour of its list: one row for both.
      await clickMenu(first, 'splitView')
      const splitRow = page.getByTestId('split-row')
      await expect(splitRow).toHaveCount(1)
      await expect(page.getByTestId('tab')).toHaveCount(1)
      await expect(splitRow.getByTestId('split-half')).toHaveCount(2)
      const halves = await splitRow.getByTestId('split-half').allTextContents()
      expect(new Set(halves).size).toBe(2)

      // Dragged into a folder, the row takes both tabs with it.
      const folder = await page.evaluate(() =>
        window.bigBrowser.invoke('browser.createFolder', { name: 'Reading' }),
      )
      const pinned = page.getByTestId('pinned')
      await splitRow.dragTo(pinned.getByRole('button', { name: 'Reading' }))
      await expect(pinned.getByTestId('folder').getByTestId('split-row')).toHaveCount(1)
      const filed = (await storedTabs(page)).filter((t) => t.folderId === folder.id)
      expect(filed.map((t) => t.title).sort()).toEqual([...halves].sort())

      // Separate (the row's menu): two rows again, still in the folder.
      await splitRow.click({ button: 'right' })
      const overlay = await overlayPage(first)
      await overlay.getByTestId('menu').getByRole('menuitem', { name: 'Separate' }).click()
      await expect(overlay.getByTestId('menu')).toHaveCount(0)
      await expect(page.getByTestId('split-row')).toHaveCount(0)
      await expect(pinned.getByTestId('folder').getByTestId('tab')).toHaveText(halves)

      // Open in Split View (a tab's menu, on a tab other than the active one) pairs it with the
      // active tab; the split survives a relaunch.
      const activeTitle = await page.evaluate(async () => {
        const state = await window.bigBrowser.invoke('browser.state')
        return state.tabs.find((t) => t.id === state.activeTabIds[state.activeSpaceId])?.title
      })
      const other = page
        .getByTestId('tab')
        .filter({ hasNotText: activeTitle ?? '' })
        .first()
      const openInSplit = overlay
        .getByTestId('menu')
        .getByRole('menuitem', { name: 'Open in Split View' })
      // The last menu's overlay may still be hiding: right-click again until this one shows (a
      // right-click while it is open would close it, as a click outside).
      await expect(async () => {
        if (!(await openInSplit.isVisible())) await other.click({ button: 'right' })
        await expect(openInSplit).toBeVisible({ timeout: 2000 })
      }).toPass()
      await openInSplit.click()
      await expect(page.getByTestId('split-row')).toHaveCount(1)
      await expect(page.getByTestId('tab')).toHaveCount(1)
    } finally {
      await first.close()
    }

    const second = await launchApp(userData)
    try {
      const again = await uiPage(second)
      await expect(again.getByTestId('split-row')).toHaveCount(1)
      await expect(again.getByTestId('tab')).toHaveCount(1)
    } finally {
      await second.close()
    }
  } finally {
    await site.close()
    rmSync(userData, { recursive: true, force: true })
  }
})

test("a pinned split's × unloads both pages and keeps the split", async () => {
  await withBrowser(async ({ page, site }) => {
    await openTab(page, site.url('/a'))
    await openTab(page, site.url('/b'))
    await openTab(page, site.url('/c'))
    await page.evaluate(() => window.bigBrowser.invoke('browser.splitActive'))
    const pinned = page.getByTestId('pinned')
    await page.evaluate(async () => {
      const state = await window.bigBrowser.invoke('browser.state')
      const first = state.tabs.find((t) => state.tabs.some((o) => o.splitOf === t.id))
      if (!first) throw new Error('no split')
      await window.bigBrowser.invoke('browser.moveTab', {
        tabId: first.id,
        section: 'pinned',
        index: 0,
      })
    })
    const row = pinned.getByTestId('split-row')
    await expect(row).toHaveCount(1)
    await expect(row.locator(':scope > [data-loaded]')).toHaveAttribute('data-loaded', 'true')

    await row.hover()
    await row.getByRole('button', { name: 'Close split' }).click()
    await expect(row).toHaveCount(1)
    await expect(row.locator(':scope > [data-loaded]')).toHaveAttribute('data-loaded', 'false')
    const state = await page.evaluate(() => window.bigBrowser.invoke('browser.state'))
    const second = state.tabs.find((t) => t.splitOf !== null)
    expect(second?.section).toBe('pinned')
    const halves = state.tabs.filter((t) => t.id === second?.splitOf || t.id === second?.id)
    expect(halves.map((t) => state.runtime[t.id]?.loaded ?? false)).toEqual([false, false])
    // The focus left the pair for the remaining today tab.
    expect(state.activeTabIds[state.activeSpaceId]).not.toBe(second?.id)
    expect(state.activeTabIds[state.activeSpaceId]).not.toBe(second?.splitOf)
  })
})
