import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { startSite } from './fixtures/site'
import { finishOnboarding, launchApp, uiPage } from './helpers'

type Site = Awaited<ReturnType<typeof startSite>>

const EXTENSION_NAME = 'ACAB Test Action'
const EXTENSION_PATH = join(__dirname, 'fixtures/extension')

/** A fresh app with the test extension, showing the fixture page /a in a tab of the first space. */
async function withExtension(
  run: (ctx: {
    app: ElectronApplication
    page: Page
    site: Site
    spaceId: string
  }) => Promise<void>,
): Promise<void> {
  const userData = mkdtempSync(join(tmpdir(), 'acab-e2e-'))
  const site = await startSite()
  const app = await launchApp(userData, { ACAB_TEST_EXTENSION: EXTENSION_PATH })
  try {
    const page = await uiPage(app)
    await finishOnboarding(page)
    // A space's session (and its extensions) is set up when its first tab view is created.
    await page.evaluate(
      (url) => window.acab.invoke('browser.openTab', { input: url }),
      site.url('/a'),
    )
    await expect(page.getByTestId('tab')).toHaveText(['Page A'])
    const { activeSpaceId } = await page.evaluate(() => window.acab.invoke('browser.state'))
    await run({ app, page, site, spaceId: activeSpaceId })
  } finally {
    await app.close().catch(() => undefined)
    await site.close()
    rmSync(userData, { recursive: true, force: true })
  }
}

/** Names of the extensions loaded in a space's session. */
const extensionNames = (app: ElectronApplication, spaceId: string) =>
  app.evaluate(
    ({ session }, id) =>
      session
        .fromPartition(`persist:space-${id}`)
        .extensions.getAllExtensions()
        .map((e) => e.name),
    spaceId,
  )

const windowCount = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)

/**
 * Loads the fixture's `page.html?<query>` in a bare web contents of the space session: an
 * extension page that is not a tab (like a popup). Loaded from main because tabs never navigate to
 * chrome-extension:// themselves. The view is kept on `globalThis.acabExtensionPage`.
 */
async function openExtensionPage(
  app: ElectronApplication,
  spaceId: string,
  query: string,
): Promise<void> {
  await expect.poll(() => extensionNames(app, spaceId)).toContain(EXTENSION_NAME)
  await app.evaluate(
    ({ session, WebContentsView }, { partition, name, query }) => {
      const ses = session.fromPartition(partition)
      const extension = ses.extensions.getAllExtensions().find((e) => e.name === name)
      if (!extension) throw new Error('Test extension not loaded')
      const view = new WebContentsView({
        webPreferences: { session: ses, sandbox: true, contextIsolation: true },
      })
      // Held so the unattached view is not garbage-collected (which closes its page).
      Object.assign(globalThis, { acabExtensionPage: view })
      void view.webContents.loadURL(`chrome-extension://${extension.id}/page.html?${query}`)
    },
    { partition: `persist:space-${spaceId}`, name: EXTENSION_NAME, query },
  )
}

test('the test extension loads in the active space', async () => {
  await withExtension(async ({ app, spaceId }) => {
    await expect.poll(() => extensionNames(app, spaceId)).toContain(EXTENSION_NAME)
  })
})

test('window.open from an extension page opens a tab', async () => {
  await withExtension(async ({ app, page, site, spaceId }) => {
    const target = site.url('/b')
    await openExtensionPage(app, spaceId, `open=${encodeURIComponent(target)}`)

    await expect(page.getByTestId('tab')).toHaveText(['Page A', 'Page B'])
    const { tabs } = await page.evaluate(() => window.acab.invoke('browser.state'))
    expect(tabs.find((t) => t.url === target)?.spaceId).toBe(spaceId)
    expect(await windowCount(app)).toBe(1)
  })
})

test('chrome.windows.remove closes the created tab, never the browser window', async () => {
  await withExtension(async ({ app, page, site, spaceId }) => {
    await openExtensionPage(app, spaceId, `create=${encodeURIComponent(site.url('/b'))}`)
    await expect(page.getByTestId('tab')).toHaveText(['Page A', 'Page B'])

    await expect
      .poll(() =>
        app.evaluate(() =>
          (
            globalThis as unknown as {
              acabExtensionPage: {
                webContents: { executeJavaScript: (code: string) => Promise<string> }
              }
            }
          ).acabExtensionPage.webContents.executeJavaScript('removeCreated()'),
        ),
      )
      .toBe('removed')
    await expect(page.getByTestId('tab')).toHaveText(['Page A'])
    expect(await windowCount(app)).toBe(1)
  })
})

test('a second space gets its own extensions', async () => {
  await withExtension(async ({ app, page, site, spaceId }) => {
    const work = await page.evaluate(
      (url) =>
        window.acab
          .invoke('browser.createSpace', { name: 'Work', color: '#3366ff' })
          .then(async (space) => {
            await window.acab.invoke('browser.openTab', { spaceId: space.id, input: url })
            return space
          }),
      site.url('/c'),
    )
    await expect(page.getByTestId('tab')).toHaveText(['Page C'])

    await expect.poll(() => extensionNames(app, work.id)).toContain(EXTENSION_NAME)
    const distinct = await app.evaluate(
      ({ session }, { a, b }) =>
        session.fromPartition(`persist:space-${a}`) !== session.fromPartition(`persist:space-${b}`),
      { a: spaceId, b: work.id },
    )
    expect(distinct).toBe(true)
  })
})
