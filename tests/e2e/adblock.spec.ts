import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { startSite } from './fixtures/site'
import { finishOnboarding, launchApp, uiPage } from './helpers'

/** The local filter list (one rule: `/ads/banner.png`): the e2e never downloads the real lists. */
const FILTERS = { ACAB_ADBLOCK_FILTERS: join(__dirname, 'fixtures/ads.txt') }

/**
 * `naturalWidth` of the `#ad` image of the tab showing `url` once it has loaded or failed: 0 when
 * blocked, 1 when shown. Null while no such tab has finished loading.
 */
const adWidth = (app: ElectronApplication, url: string) =>
  app.evaluate(async ({ webContents }, url) => {
    const contents = webContents.getAllWebContents().find((c) => c.getURL() === url)
    if (!contents || contents.isLoading()) return null
    return (await contents.executeJavaScript(`new Promise((resolve) => {
      const img = document.getElementById('ad')
      if (!img) return resolve(null)
      if (img.complete) return resolve(img.naturalWidth)
      img.onload = img.onerror = () => resolve(img.naturalWidth)
    })`)) as number | null
  }, url)

const openTab = (page: Page, url: string) =>
  page.evaluate((input) => window.acab.invoke('browser.openTab', { input }), url)

test('ads are blocked by default', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'acab-e2e-'))
  const site = await startSite()
  const app = await launchApp(userData, FILTERS)
  try {
    const page = await uiPage(app)
    await finishOnboarding(page)
    await openTab(page, site.url('/with-ad'))
    await expect.poll(() => adWidth(app, site.url('/with-ad'))).toBe(0)
  } finally {
    await app.close().catch(() => undefined)
    await site.close()
    rmSync(userData, { recursive: true, force: true })
  }
})

test('ads are blocked in every space', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'acab-e2e-'))
  const site = await startSite()
  const app = await launchApp(userData, FILTERS)
  try {
    const page = await uiPage(app)
    await finishOnboarding(page)
    const first = site.url('/with-ad')
    await openTab(page, first)
    await expect.poll(() => adWidth(app, first)).toBe(0)

    // Another host, so each tab is found by its URL; its own session, enabled second.
    const second = first.replace('127.0.0.1', 'localhost')
    await page.evaluate(
      (url) =>
        window.acab
          .invoke('browser.createSpace', { name: 'Work', color: '#3366ff' })
          .then((space) =>
            window.acab.invoke('browser.openTab', { spaceId: space.id, input: url }),
          ),
      second,
    )
    await expect.poll(() => adWidth(app, second)).toBe(0)
  } finally {
    await app.close().catch(() => undefined)
    await site.close()
    rmSync(userData, { recursive: true, force: true })
  }
})

test('allowing the site shows the ad and survives a relaunch', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'acab-e2e-'))
  const site = await startSite()
  const url = site.url('/with-ad')
  try {
    const first = await launchApp(userData, FILTERS)
    try {
      const page = await uiPage(first)
      await finishOnboarding(page)
      await openTab(page, url)
      await expect.poll(() => adWidth(first, url)).toBe(0)

      // Main reloads the tab when its host's exception changes: no reload here.
      await page.evaluate(
        (host) =>
          window.acab.invoke('settings.update', {
            adBlock: { enabled: true, allowedHosts: [host] },
          }),
        new URL(url).hostname,
      )
      await expect.poll(() => adWidth(first, url)).toBe(1)
    } finally {
      await first.close()
    }

    const second = await launchApp(userData, FILTERS)
    try {
      const page = await uiPage(second)
      // The blocker loads after the window opens: wait until it blocks the same page on another
      // host (not allowed), then reload the restored tab so it surely loads with the blocker on.
      const other = url.replace('127.0.0.1', 'localhost')
      await openTab(page, other)
      await expect
        .poll(async () => {
          const width = await adWidth(second, other)
          // Shown: loaded before the blocker arrived. Load it again.
          if (width === 1)
            await second.evaluate(({ webContents }, u) => {
              webContents
                .getAllWebContents()
                .find((c) => c.getURL() === u)
                ?.reload()
            }, other)
          return width
        })
        .toBe(0)

      const { tabs } = await page.evaluate(() => window.acab.invoke('browser.state'))
      const restored = tabs.find((t) => t.url === url)
      if (!restored) throw new Error('The allowed tab was not restored')
      await page.evaluate(
        (tabId) => window.acab.invoke('browser.activateTab', { tabId }),
        restored.id,
      )
      await page.evaluate((tabId) => window.acab.invoke('browser.reload', { tabId }), restored.id)
      await expect.poll(() => adWidth(second, url)).toBe(1)
    } finally {
      await second.close()
    }
  } finally {
    await site.close()
    rmSync(userData, { recursive: true, force: true })
  }
})
