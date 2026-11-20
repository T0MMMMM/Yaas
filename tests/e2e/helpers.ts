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
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByTestId('technical-setup')).toBeVisible()
  await page.getByRole('button', { name: 'Open ACAB' }).click()
  await expect(page.getByTestId('sidebar')).toBeVisible()
}
