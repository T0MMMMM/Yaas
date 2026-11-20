import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { startSite } from './fixtures/site'
import { finishOnboarding, launchApp } from './helpers'

test('a page opens, navigates and reports back', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'acab-e2e-'))
  const site = await startSite()
  const app = await launchApp(userData)

  try {
    // Grab the UI page before any tab exists: tab views are web contents too.
    const page = await app.firstWindow()
    await finishOnboarding(page)

    const state = () => page.evaluate(() => window.acab.invoke('browser.state'))
    const tab = await page.evaluate(
      (input) => window.acab.invoke('browser.openTab', { input }),
      site.url('/a'),
    )
    const current = async () => {
      const s = await state()
      return { tab: s.tabs.find((t) => t.id === tab.id), runtime: s.runtime[tab.id] }
    }

    await expect.poll(async () => (await current()).tab?.title).toBe('Page A')
    await expect.poll(async () => (await current()).runtime?.themeColor).toBe('#123456')

    await page.evaluate((args) => window.acab.invoke('browser.navigate', args), {
      tabId: tab.id,
      input: site.url('/b'),
    })
    await expect.poll(async () => (await current()).tab?.title).toBe('Page B')
    await expect.poll(async () => (await current()).runtime?.canGoBack).toBe(true)

    await page.evaluate((tabId) => window.acab.invoke('browser.goBack', { tabId }), tab.id)
    await expect.poll(async () => (await current()).tab?.title).toBe('Page A')

    // A popup becomes a tab in the same space, never a new window.
    await app.evaluate(({ webContents }) =>
      webContents
        .getAllWebContents()
        .find((w) => w.getURL().endsWith('/a'))
        ?.executeJavaScript("document.getElementById('pop').click()"),
    )
    await expect
      .poll(async () => {
        const s = await state()
        return s.tabs.map((t) => t.spaceId === s.spaces[0]?.id)
      })
      .toEqual([true, true])
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1)
  } finally {
    await app.close()
    await site.close()
    rmSync(userData, { recursive: true, force: true })
  }
})
