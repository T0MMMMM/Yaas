import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { startSite } from './fixtures/site'
import { finishOnboarding, launchApp, overlayPage, uiPage } from './helpers'

type Site = Awaited<ReturnType<typeof startSite>>

/** A fresh app (onboarding done) with the fixture pages /a and /b open, /b active. */
async function withTabs(
  run: (ctx: { app: ElectronApplication; page: Page; overlay: Page; site: Site }) => Promise<void>,
): Promise<void> {
  const userData = mkdtempSync(join(tmpdir(), 'acab-e2e-'))
  const site = await startSite()
  const app = await launchApp(userData)
  try {
    const page = await uiPage(app)
    await finishOnboarding(page)
    for (const path of ['/a', '/b']) {
      await page.evaluate(
        (input) => window.acab.invoke('browser.openTab', { input }),
        site.url(path),
      )
    }
    await expect(page.getByTestId('tab')).toHaveText(['Page A', 'Page B'])
    await run({ app, page, overlay: await overlayPage(app), site })
  } finally {
    await app.close().catch(() => undefined)
    await site.close()
    rmSync(userData, { recursive: true, force: true })
  }
}

/** Clicks an application menu item by id: Playwright key presses never reach accelerators. */
const clickMenu = (app: ElectronApplication, id: string) =>
  app.evaluate(
    ({ Menu }, itemId) => Menu.getApplicationMenu()?.getMenuItemById(itemId)?.click(),
    id,
  )

/** The URL of the active tab, from the model main sends the UI. */
const activeUrl = (page: Page) =>
  page.evaluate(async () => {
    const state = await window.acab.invoke('browser.state')
    return state.tabs.find((t) => t.id === state.activeTabIds[state.activeSpaceId])?.url
  })

test('⌘K finds a tab by part of its title and activates it', async () => {
  await withTabs(async ({ app, page, overlay, site }) => {
    expect(await activeUrl(page)).toBe(site.url('/b'))

    await clickMenu(app, 'findTab')
    const field = overlay.getByLabel('Find a tab')
    await expect(field).toBeFocused()
    // An empty query lists the space's tabs.
    await expect(overlay.getByRole('option')).toHaveCount(2)

    // Every word matches both titles; the one that starts with the query comes first.
    await field.pressSequentially('page a')
    await expect(overlay.getByRole('option').first()).toContainText('Page A')
    await expect(overlay.getByRole('option').first()).toHaveAttribute('aria-selected', 'true')
    await field.press('Enter')

    await expect(overlay.getByTestId('finder')).toHaveCount(0)
    await expect.poll(() => activeUrl(page)).toBe(site.url('/a'))
  })
})

test('the sidebar’s Search button opens the tab finder', async () => {
  await withTabs(async ({ page, overlay }) => {
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(overlay.getByLabel('Find a tab')).toBeFocused()
    await overlay.getByLabel('Find a tab').press('Escape')
    await expect(overlay.getByTestId('finder')).toHaveCount(0)
  })
})

test('⌘T opens what is typed in a new tab, Escape opens none', async () => {
  await withTabs(async ({ app, page, overlay, site }) => {
    await clickMenu(app, 'newTab')
    const field = overlay.getByLabel('Search or enter address')
    await expect(field).toBeFocused()
    await expect(page.getByTestId('tab')).toHaveCount(2)
    await field.press('Escape')
    await expect(overlay.getByTestId('command-field')).toHaveCount(0)
    await expect(page.getByTestId('tab')).toHaveCount(2)

    await clickMenu(app, 'newTab')
    await expect(field).toBeFocused()
    await field.fill(site.url('/c'))
    await expect(overlay.getByRole('option').first()).toHaveText(`Go to ${site.url('/c')}`)
    await field.press('Enter')

    await expect(page.getByTestId('tab')).toHaveText(['Page A', 'Page B', 'Page C'])
    await expect.poll(() => activeUrl(page)).toBe(site.url('/c'))
  })
})

test('⌘T switches to an open tab it matches', async () => {
  await withTabs(async ({ app, page, overlay, site }) => {
    await clickMenu(app, 'newTab')
    const field = overlay.getByLabel('Search or enter address')
    await field.fill('page a')
    const tab = overlay.getByRole('option', { name: /Page A/ })
    await expect(tab).toContainText('Switch to tab')
    await field.press('ArrowDown')
    await field.press('Enter')

    await expect.poll(() => activeUrl(page)).toBe(site.url('/a'))
    await expect(page.getByTestId('tab')).toHaveCount(2)
  })
})

test('⌘Z reopens a closed tab from the UI, never from a text field', async () => {
  await withTabs(async ({ app, page }) => {
    await clickMenu(app, 'closeTab')
    await expect(page.getByTestId('tab')).toHaveText(['Page A'])

    // The UI has focus, no field does: ⌘Z is "reopen closed tab".
    await page.getByTestId('tab').first().getByRole('button').first().focus()
    await page.keyboard.press('ControlOrMeta+z')
    await expect(page.getByTestId('tab')).toHaveText(['Page A', 'Page B'])

    // In the address bar ⌘Z stays the text undo.
    await clickMenu(app, 'closeTab')
    await expect(page.getByTestId('tab')).toHaveText(['Page A'])
    await clickMenu(app, 'focusAddress')
    const address = page.getByLabel('Address')
    await expect(address).toBeFocused()
    await address.pressSequentially('xyz')
    await address.press('ControlOrMeta+z')
    // Give a reopen the time it would take to show.
    await page.waitForTimeout(300)
    await expect(page.getByTestId('tab')).toHaveText(['Page A'])
  })
})

test('the + menu filters its items and creates a folder', async () => {
  await withTabs(async ({ page, overlay }) => {
    await page.getByRole('button', { name: 'New tab, space or settings' }).click()
    const filter = overlay.getByLabel('Filter')
    await expect(filter).toBeFocused()
    await filter.pressSequentially('fold')
    await expect(overlay.getByRole('menuitem')).toHaveText(['New folder'])
    await filter.press('Enter')

    // The new folder's name is edited at once.
    const name = page.getByTestId('pinned').getByLabel('Folder name')
    await expect(name).toBeFocused()
    await name.fill('Reading')
    await name.press('Enter')
    await expect(page.getByTestId('folder').getByRole('button', { name: 'Reading' })).toBeVisible()
  })
})

test('the New tab row and + item open the command field, not a tab', async () => {
  await withTabs(async ({ page, overlay }) => {
    const field = overlay.getByLabel('Search or enter address')
    await page.getByTestId('new-tab').click()
    await expect(field).toBeFocused()
    await field.press('Escape')
    await expect(overlay.getByTestId('command-field')).toHaveCount(0)

    await page.getByRole('button', { name: 'New tab, space or settings' }).click()
    await overlay.getByRole('menuitem', { name: 'New tab' }).click()
    await expect(field).toBeFocused()
    await field.press('Escape')
    await expect(page.getByTestId('tab')).toHaveCount(2)
  })
})

test('⌘L while the command field is open closes it and edits the address', async () => {
  await withTabs(async ({ app, page, overlay }) => {
    await clickMenu(app, 'newTab')
    await expect(overlay.getByLabel('Search or enter address')).toBeFocused()
    await clickMenu(app, 'focusAddress')
    await expect(overlay.getByTestId('command-field')).toHaveCount(0)
    await expect(page.getByLabel('Address')).toBeFocused()
  })
})
