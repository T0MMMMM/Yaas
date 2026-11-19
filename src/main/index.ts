import { join } from 'node:path'
import { app, BrowserWindow, type WebContents } from 'electron'
import { Accounts } from '@core/accounts/accounts'
import { authStatus, cliVersion, findCli } from '@core/providers/claude-code/cli'
import { SettingsStore } from '@core/settings/settingsStore'
import { openDatabase } from '@core/store/database'
import { emit, registerCommands } from './ipc/router'
import { applyGlass, createMainWindow, glassSupported } from './windows/mainWindow'

// Tests and parallel dev profiles can point YAAS at a throwaway data dir.
const userDataOverride = process.env['YAAS_USER_DATA']
if (userDataOverride) app.setPath('userData', userDataOverride)

if (!app.requestSingleInstanceLock()) app.quit()

const db = openDatabase(join(app.getPath('userData'), 'yaas.db'))
const settings = new SettingsStore(db)
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
  mainWindow = createMainWindow({ glass: settings.get().glass })
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

// Native material is only touched when the glass setting actually changes: re-applying vibrancy
// on every update (e.g. each tick of the grain slider) makes the window flicker.
let appliedGlass = settings.get().glass
settings.subscribe((next) => {
  if (!mainWindow) return
  if (next.glass !== appliedGlass) {
    appliedGlass = next.glass
    applyGlass(mainWindow, next.glass)
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
