import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { startSite } from './fixtures/site'
import { finishOnboarding, launchApp, overlayPage, uiPage } from './helpers'

/** Both local fixtures: the e2e never downloads filter lists or extensions. */
const FIXTURES = {
  ACAB_ADBLOCK_FILTERS: join(__dirname, 'fixtures/ads.txt'),
  ACAB_TEST_EXTENSION: join(__dirname, 'fixtures/extension'),
}

/** A fresh app (onboarding done) showing the fixture page /a, with its site menu open. */
async function withSiteMenu(
  run: (ctx: { app: ElectronApplication; page: Page; overlay: Page; url: string }) => Promise<void>,
): Promise<void> {
  const userData = mkdtempSync(join(tmpdir(), 'acab-e2e-'))
  const site = await startSite()
  const app = await launchApp(userData, FIXTURES)
  try {
    const page = await uiPage(app)
    await finishOnboarding(page)
    const url = site.url('/a')
    await page.evaluate((input) => window.acab.invoke('browser.openTab', { input }), url)
    await expect(page.getByTestId('tab')).toHaveText(['Page A'])
    await page.getByRole('button', { name: 'Site menu' }).click()
    const overlay = await overlayPage(app)
    await expect(overlay.getByTestId('site-menu')).toBeVisible()
    await run({ app, page, overlay, url })
  } finally {
    await app.close().catch(() => undefined)
    await site.close()
    rmSync(userData, { recursive: true, force: true })
  }
}

const adBlockSwitch = (overlay: Page) =>
  overlay.getByRole('switch', { name: 'Block ads and trackers' })

test("the site menu shows the site's state", async () => {
  await withSiteMenu(async ({ overlay, url }) => {
    const menu = overlay.getByTestId('site-menu')
    await expect(menu).toContainText('Not secure')
    await expect(menu).toContainText(new URL(url).host)
    await expect(adBlockSwitch(overlay)).toHaveAttribute('aria-checked', 'true')
  })
})

test('turning off ad blocking adds the host', async () => {
  await withSiteMenu(async ({ page, overlay, url }) => {
    await adBlockSwitch(overlay).click()
    await expect(adBlockSwitch(overlay)).toHaveAttribute('aria-checked', 'false')
    const settings = await page.evaluate(() => window.acab.invoke('settings.get'))
    expect(settings.adBlock.allowedHosts).toContain(new URL(url).hostname)
  })
})

test('extension actions are listed', async () => {
  await withSiteMenu(async ({ overlay }) => {
    // CSS locators pierce the open shadow root of <browser-action-list>.
    await expect(overlay.locator('[title="ACAB Test Action"]')).toBeAttached()
  })
})

test('developer tools open for the tab', async () => {
  await withSiteMenu(async ({ app, page, overlay }) => {
    await overlay.getByRole('button', { name: 'Developer tools' }).click()
    const { runtime, activeSpaceId, activeTabIds } = await page.evaluate(() =>
      window.acab.invoke('browser.state'),
    )
    const tabId = activeTabIds[activeSpaceId]
    const contentsId = tabId ? (runtime[tabId]?.webContentsId ?? null) : null
    if (contentsId === null) throw new Error('The active tab has no web contents')
    await expect
      .poll(() =>
        app.evaluate(
          ({ webContents }, id) => webContents.fromId(id)?.isDevToolsOpened() ?? false,
          contentsId,
        ),
      )
      .toBe(true)
  })
})
