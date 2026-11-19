import { app, BrowserWindow, type WebContents } from 'electron'
import { SettingsStore } from '@core/settings/settingsStore'
import { emit, registerCommands } from './ipc/router'
import { applyGlass, createMainWindow, glassSupported } from './windows/mainWindow'

// Tests and parallel dev profiles can point YAAS at a throwaway data dir.
const userDataOverride = process.env['YAAS_USER_DATA']
if (userDataOverride) app.setPath('userData', userDataOverride)

if (!app.requestSingleInstanceLock()) app.quit()

const settings = new SettingsStore()
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
  },
  isTrustedSender,
)

settings.subscribe((next) => {
  if (!mainWindow) return
  applyGlass(mainWindow, next.glass)
  emit(mainWindow.webContents, 'settings.changed', next)
})

app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

void app.whenReady().then(() => {
  openMainWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openMainWindow()
  })
})
