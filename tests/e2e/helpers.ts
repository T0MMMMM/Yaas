import { join } from 'node:path'
import {
  _electron as electron,
  expect,
  type ElectronApplication,
  type Page,
} from '@playwright/test'

/** Launches the built app with its data in `userData`. */
export function launchApp(userData: string): Promise<ElectronApplication> {
  return electron.launch({
    args: [join(__dirname, '../../out/main/index.js')],
    env: { ...process.env, ACAB_USER_DATA: userData },
  })
}

/** Walks through the onboarding with its defaults, up to the main UI. */
export async function finishOnboarding(page: Page): Promise<void> {
  await expect(page.getByTestId('visual-setup')).toBeVisible()
  await page.getByRole('button', { name: 'Open ACAB' }).click()
  await expect(page.getByTestId('sidebar')).toBeVisible()
}

/**
 * The ACAB UI page. After a relaunch the restored active tab's view is a web contents too, and
 * `firstWindow()` can resolve to it instead, so pick the page that exposes the `acab` bridge.
 */
export async function uiPage(app: ElectronApplication): Promise<Page> {
  const isUi = (page: Page) => page.evaluate(() => 'acab' in window).catch(() => false)
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
  if (!found) throw new Error('ACAB UI page not found')
  return found
}
