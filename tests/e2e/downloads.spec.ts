import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { startSite } from './fixtures/site'
import { finishOnboarding, launchApp, overlayPage, uiPage } from './helpers'

/** Clicks the fixture's download link in the page showing `/downloads`. */
function clickDownload(app: ElectronApplication): Promise<void> {
  return app.evaluate(async ({ webContents }) => {
    const contents = webContents.getAllWebContents().find((w) => w.getURL().endsWith('/downloads'))
    if (!contents) throw new Error('No downloads page')
    await contents.executeJavaScript("document.getElementById('file').click()")
  })
}

const downloadsButton = (page: Page) =>
  page.getByTestId('sidebar').getByRole('button', { name: 'Downloads' })

test('downloads land in the folder and the list', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'big-browser-e2e-'))
  const folder = mkdtempSync(join(tmpdir(), 'big-browser-downloads-'))
  const site = await startSite()
  const app = await launchApp(userData)
  try {
    const page = await uiPage(app)
    await finishOnboarding(page)
    await app.evaluate(({ app: electronApp }, dir) => electronApp.setPath('downloads', dir), folder)

    await page.getByTestId('new-tab').click()
    const field = (await overlayPage(app)).getByLabel('Search or enter address')
    await field.fill(site.url('/downloads'))
    await field.press('Enter')
    await expect(page.getByTestId('tab')).toHaveText(['Files'])

    await clickDownload(app)
    await expect.poll(() => existsSync(join(folder, 'report.txt'))).toBe(true)
    expect(readFileSync(join(folder, 'report.txt'), 'utf8')).toBe('the report')

    await downloadsButton(page).click()
    const overlay = await overlayPage(app)
    const card = overlay.getByTestId('downloads')
    await expect(card).toBeVisible()
    const row = card.getByTestId('download')
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('report.txt')
    await expect(row).toHaveAttribute('data-state', 'completed')
    await expect(row.getByRole('button', { name: /^Show in (Finder|Explorer)$/ })).toBeVisible()

    // The same file again: the card, still open, gets a second row and the file a numbered name.
    await clickDownload(app)
    await expect.poll(() => existsSync(join(folder, 'report (1).txt'))).toBe(true)
    await expect(card.getByTestId('download')).toHaveCount(2)
    await expect(card.getByTestId('download').first()).toContainText('report (1).txt')

    await card.getByRole('button', { name: 'Clear' }).click()
    await expect(card.getByTestId('download')).toHaveCount(0)
    await expect(card).toContainText('No downloads yet')
    expect(existsSync(join(folder, 'report.txt'))).toBe(true)
    expect(existsSync(join(folder, 'report (1).txt'))).toBe(true)
  } finally {
    await app.close().catch(() => undefined)
    await site.close()
    rmSync(userData, { recursive: true, force: true })
    rmSync(folder, { recursive: true, force: true })
  }
})
