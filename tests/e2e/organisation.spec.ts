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
