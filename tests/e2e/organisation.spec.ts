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

test('closing a tab animates its row out', async () => {
  await withBrowser(async ({ page, site }) => {
    // Three tabs of one site would be an automatic folder, which dissolves when one closes.
    await page.evaluate(() => window.acab.invoke('settings.update', { autoFolders: false }))
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
      await window.acab.invoke('browser.closeTab', { tabId })
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
      const invoke = window.acab.invoke as (channel: string, input: unknown) => Promise<unknown>
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
      window.acab.invoke('browser.state').then((s) => s.activeSpaceId),
    )
    const work = await page.evaluate(() =>
      window.acab.invoke('browser.createSpace', { name: 'Work', color: '#3366ff' }),
    )
    await page.evaluate(
      ({ spaceId, input }) => window.acab.invoke('browser.openTab', { spaceId, input }),
      { spaceId: work.id, input: site.url('/c') },
    )
    await page.evaluate((spaceId) => window.acab.invoke('browser.activateSpace', { spaceId }), home)
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
    await page.evaluate(() => window.acab.invoke('settings.update', { autoFolders: false }))
    const a = await openTab(page, site.url('/a'))
    const b = await openTab(page, site.url('/b'))
    const folder = await page.evaluate(() =>
      window.acab.invoke('browser.createFolder', { name: 'Reading' }),
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
      window.acab.invoke('browser.createFolder', { name: 'Reading' }),
    )
    await page.evaluate(
      ({ tabId, folderId }) =>
        window.acab.invoke('browser.moveTab', { tabId, section: 'pinned', folderId, index: 0 }),
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
    await page.evaluate(() => window.acab.invoke('browser.createFolder', { name: 'Reading' }))
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
    // Three lines of title and two of detail at most, far from the window's height.
    const box = await tooltip.boundingBox()
    if (!box) throw new Error('tooltip has no box')
    expect(box.height).toBeLessThan(150)
  })
})
