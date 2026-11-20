import { join } from 'node:path'
import {
  _electron as electron,
  expect,
  type ElectronApplication,
  type Page,
} from '@playwright/test'

/** Launches the built app with its data in `userData`, plus any extra environment. */
export function launchApp(
  userData: string,
  env: Record<string, string> = {},
): Promise<ElectronApplication> {
  return electron.launch({
    args: [join(__dirname, '../../out/main/index.js')],
    env: { ...process.env, BIG_BROWSER_USER_DATA: userData, ...env },
  })
}

/** Walks through the onboarding with its defaults, up to the main UI. */
export async function finishOnboarding(page: Page): Promise<void> {
  await expect(page.getByTestId('visual-setup')).toBeVisible()
  await page.getByRole('button', { name: 'Open Big Browser' }).click()
  await expect(page.getByTestId('sidebar')).toBeVisible()
}

/**
 * The Big Browser UI page. After a relaunch the restored active tab's view is a web contents too, and
 * `firstWindow()` can resolve to it instead, so pick the page that exposes the `bigBrowser` bridge.
 */
export async function uiPage(app: ElectronApplication): Promise<Page> {
  // The overlay view loads the same renderer (and bridge) under `#overlay`: skip it.
  const isUi = (page: Page) =>
    !page.url().endsWith('#overlay') &&
    page.evaluate(() => 'bigBrowser' in window).catch(() => false)
  let found: Page | undefined
  // Poll rather than wait for the 'window' event: one fired between the scan and the wait is lost.
  await expect
    .poll(async () => {
      for (const page of app.windows()) {
        if (await isUi(page)) {
          found = page
          return true
        }
      }
      return false
    })
    .toBe(true)
  if (!found) throw new Error('Big Browser UI page not found')
  return found
}

/** The overlay view's page: the renderer loaded under `#overlay`, floating over the page. */
export async function overlayPage(app: ElectronApplication): Promise<Page> {
  let found: Page | undefined
  await expect
    .poll(() => {
      found = app.windows().find((page) => page.url().endsWith('#overlay'))
      return found !== undefined
    })
    .toBe(true)
  if (!found) throw new Error('Overlay page not found')
  return found
}
