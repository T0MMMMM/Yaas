import { join } from 'node:path'
import { app, BrowserWindow, Menu, type WebContents } from 'electron'
import { Accounts } from '@core/accounts/accounts'
import { BrowserStore } from '@core/browser/browserStore'
import { authStatus, cliVersion, findCli } from '@core/providers/claude-code/cli'
import { SettingsStore } from '@core/settings/settingsStore'
import { openDatabase } from '@core/store/database'
import type { BrowserState } from '@shared/ipc/contract'
import { resolveInput } from '@shared/url'
import { OverlayView } from './browser/overlayView'
import { TabViews } from './browser/tabViews'
import { emit, registerCommands } from './ipc/router'
import { buildAppMenu } from './menu'
import {
  applyMaterial,
  createMainWindow,
  glassSupported,
  materialFor,
  PRELOAD_PATH,
  rendererUrl,
} from './windows/mainWindow'

// Tests and parallel dev profiles can point ACAB at a throwaway data dir.
const userDataOverride = process.env['ACAB_USER_DATA']
if (userDataOverride) app.setPath('userData', userDataOverride)

if (!app.requestSingleInstanceLock()) app.quit()

const db = openDatabase(join(app.getPath('userData'), 'acab.db'))
const settings = new SettingsStore(db)
// `npm run dev:onboarding` shows the onboarding on every launch (to work on it).
if (process.env['ACAB_ONBOARDING'] === '1') settings.update({ onboardingDone: false })
const accounts = new Accounts({
  db,
  authStatus: async (configDir) => {
    const cli = findCli()
    return cli ? authStatus(cli, configDir) : null
  },
  defaultColor: () => settings.get().accent,
})
const browser = new BrowserStore(db, {
  defaultSpace: { name: 'Personal', color: settings.get().accent },
})
let mainWindow: BrowserWindow | null = null
let tabViews: TabViews | null = null
let overlay: OverlayView | null = null

const platform =
  process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'windows' : 'linux'

/** The UI window and the overlay view: the only renderers that run the app's code. */
function trustedContents(): WebContents[] {
  if (!mainWindow) return []
  return overlay ? [mainWindow.webContents, overlay.webContents] : [mainWindow.webContents]
}

function isTrustedSender(sender: WebContents): boolean {
  return trustedContents().includes(sender)
}

/** Pushes the browser model plus the tabs' runtime state to the UI and the overlay. */
function emitBrowserState(): void {
  const state = browserState()
  for (const contents of trustedContents()) emit(contents, 'browser.changed', state)
}

function overlayView(): OverlayView {
  if (!overlay) throw new Error('No browser window')
  return overlay
}

function browserState(): BrowserState {
  return { ...browser.snapshot(), runtime: tabViews?.runtime() ?? {} }
}

function views(): TabViews {
  if (!tabViews) throw new Error('No browser window')
  return tabViews
}

function activeTabId(): string | null {
  const snapshot = browser.snapshot()
  return snapshot.activeTabIds[snapshot.activeSpaceId] ?? null
}

/** Activates the neighbour of the active tab in its space, wrapping around. */
function cycleTab(step: 1 | -1): void {
  const snapshot = browser.snapshot()
  const tabs = snapshot.tabs.filter((t) => t.spaceId === snapshot.activeSpaceId)
  const index = tabs.findIndex((t) => t.id === activeTabId())
  const next = tabs[(index + step + tabs.length) % tabs.length]
  if (tabs.length > 1 && next) browser.activateTab(next.id)
}

function emitShortcut(shortcut: 'focus-address' | 'settings'): void {
  if (!mainWindow) return
  // A focused page keeps the keyboard: hand it back to the UI so the user types into its field.
  mainWindow.webContents.focus()
  emit(mainWindow.webContents, 'browser.shortcut', shortcut)
}

function setupMenu(): void {
  const withActive = (run: (tabId: string) => void) => (): void => {
    const id = activeTabId()
    if (id) run(id)
  }
  Menu.setApplicationMenu(
    buildAppMenu({
      newTab: () => {
        browser.openTab(browser.snapshot().activeSpaceId, 'about:blank')
        emitShortcut('focus-address')
      },
      closeTab: withActive((id) => browser.closeTab(id)),
      focusAddress: () => emitShortcut('focus-address'),
      reload: withActive((id) => tabViews?.reload(id)),
      back: withActive((id) => tabViews?.goBack(id)),
      forward: withActive((id) => tabViews?.goForward(id)),
      nextTab: () => cycleTab(1),
      previousTab: () => cycleTab(-1),
      settings: () => emitShortcut('settings'),
    }),
  )
}

function openMainWindow(): void {
  const win = createMainWindow({ material: materialFor(settings.get().transparency) })
  mainWindow = win
  // Created before any tab view, then raised over each new one.
  const overlayView = new OverlayView(win, PRELOAD_PATH, rendererUrl(), () => {
    emit(win.webContents, 'overlay.closed', undefined)
  })
  overlay = overlayView
  tabViews = new TabViews(win, browser, emitBrowserState, () => overlayView.raise())
  tabViews.sync(browser.snapshot())
  win.on('closed', () => {
    mainWindow = null
    tabViews = null
    overlay = null
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
    'browser.state': () => browserState(),
    'browser.openTab': ({ spaceId, input }) =>
      browser.openTab(
        spaceId ?? browser.snapshot().activeSpaceId,
        input === undefined ? 'about:blank' : resolveInput(input),
      ),
    'browser.closeTab': ({ tabId }) => browser.closeTab(tabId),
    'browser.activateTab': ({ tabId }) => browser.activateTab(tabId),
    'browser.navigate': ({ tabId, input }) => views().navigate(tabId, resolveInput(input)),
    'browser.goBack': ({ tabId }) => views().goBack(tabId),
    'browser.goForward': ({ tabId }) => views().goForward(tabId),
    'browser.reload': ({ tabId }) => views().reload(tabId),
    'browser.createSpace': ({ name, color }) => browser.createSpace(name, color),
    'browser.activateSpace': ({ spaceId }) => browser.activateSpace(spaceId),
    'browser.setPageBounds': (bounds) => views().setBounds(bounds),
    'browser.setPageVisible': ({ visible }) => views().setVisible(visible),
    'overlay.open': ({ kind, anchor }) => overlayView().open(kind, anchor),
    'overlay.close': () => overlayView().close(),
    'ui.openSettings': () => emitShortcut('settings'),
    'ui.focusAddress': () => emitShortcut('focus-address'),
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
  for (const contents of trustedContents()) emit(contents, 'settings.changed', next)
})

browser.subscribe((snapshot) => {
  tabViews?.sync(snapshot)
  emitBrowserState()
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
  setupMenu()
  openMainWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openMainWindow()
  })
})
