import { join } from 'node:path'
import { app, BrowserWindow, type WebContents } from 'electron'
import { Accounts } from '@core/accounts/accounts'
import { authStatus, cliVersion, findCli } from '@core/providers/claude-code/cli'
import { SettingsStore } from '@core/settings/settingsStore'
import { openDatabase } from '@core/store/database'
import { emit, registerCommands } from './ipc/router'
import { applyMaterial, createMainWindow, glassSupported, materialFor } from './windows/mainWindow'

// Tests and parallel dev profiles can point YAAS at a throwaway data dir.
const userDataOverride = process.env['YAAS_USER_DATA']
if (userDataOverride) app.setPath('userData', userDataOverride)

if (!app.requestSingleInstanceLock()) app.quit()

const db = openDatabase(join(app.getPath('userData'), 'yaas.db'))
const settings = new SettingsStore(db)
// `npm run dev:onboarding` shows the onboarding on every launch (to work on it).
if (process.env['YAAS_ONBOARDING'] === '1') settings.update({ onboardingDone: false })
const accounts = new Accounts({
  db,
  authStatus: async (configDir) => {
    const cli = findCli()
    return cli ? authStatus(cli, configDir) : null
  },
  defaultColor: () => settings.get().accent,
})
let mainWindow: BrowserWindow | null = null

const platform =
  process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'windows' : 'linux'

function isTrustedSender(sender: WebContents): boolean {
  return mainWindow !== null && sender === mainWindow.webContents
}

function openMainWindow(): void {
  mainWindow = createMainWindow({ material: materialFor(settings.get().transparency) })
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

registerCommands(
  {
    'app.info': () => ({ version: app.getVersion(), platform, glassSupported: glassSupported() }),
    'settings.get': () => settings.get(),
    'settings.update': (patch) => settings.update(patch),
    'claude.detect': async () => {
      const path = findCli()
      return { path, version: path ? await cliVersion(path) : null }
    },
    'accounts.list': () => accounts.list(),
    'accounts.importDefault': () => accounts.importDefault(),
  },
  isTrustedSender,
)

// The native material only changes at the thresholds (0 and liquid); how see-through the frame is
// in between is CSS. Re-applying vibrancy on every tick of a slider flickers.
let appliedMaterial = materialFor(settings.get().transparency)
settings.subscribe((next) => {
  if (!mainWindow) return
  const material = materialFor(next.transparency)
  if (material !== appliedMaterial) {
    appliedMaterial = material
    applyMaterial(mainWindow, material)
  }
  emit(mainWindow.webContents, 'settings.changed', next)
})

accounts.subscribe((list) => {
  if (mainWindow) emit(mainWindow.webContents, 'accounts.changed', list)
})

app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
})

app.on('will-quit', () => db.close())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

void app.whenReady().then(() => {
  openMainWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openMainWindow()
  })
})
