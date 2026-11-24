import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import {
  app,
  BrowserWindow,
  clipboard,
  Menu,
  screen,
  session,
  shell,
  ShareMenu,
  type WebContents,
} from 'electron'
import { ElectronChromeExtensions } from 'electron-chrome-extensions'
import { Accounts } from '@core/accounts/accounts'
import { diffHosts } from '@core/browser/adblock'
import { BrowserStore } from '@core/browser/browserStore'
import { authStatus, cliVersion, findCli } from '@core/providers/claude-code/cli'
import { SettingsStore } from '@core/settings/settingsStore'
import { openDatabase } from '@core/store/database'
import { DB_FILE, migrateLegacyData } from '@core/store/legacyData'
import {
  WINDOW_CONTROLS_H,
  type BrowserState,
  type Settings,
  type Shortcut,
} from '@shared/ipc/contract'
import { resolveInput } from '@shared/url'
import { AdBlocker } from './browser/adBlocker'
import { Downloads } from './browser/downloads'
import { OverlayView } from './browser/overlayView'
import { folderMenu, spaceMenu, tabMenu, type SidebarMenuHost } from './browser/sidebarMenus'
import { MenuRegistry, menuRequest, type MenuItemDef, type MenuWhere } from './menus/menuRegistry'
import { DownloadsStore } from '@core/browser/downloadsStore'
import { HistoryStore } from '@core/browser/historyStore'
import { SpaceSessions, type ExtensionHost } from './browser/spaceSessions'
import { PAGE_RADIUS, TabViews } from './browser/tabViews'
import { shownSplit } from '@core/browser/splitBounds'
import { splitPartner } from '@core/browser/splitPartner'
import {
  ExternalUrlQueue,
  handleOpenUrl,
  handleSecondInstance,
  isDefaultBrowser,
  makeDefaultBrowser,
  protocolClientTarget,
  urlFromArgv,
  type DefaultBrowserApi,
} from './defaultBrowser'
import { emit, registerCommands } from './ipc/router'
import { buildAppMenu } from './menu'
import {
  applyMaterial,
  createMainWindow,
  glassSupported,
  materialFor,
  PRELOAD_PATH,
  rendererUrl,
  inTopBand,
  toggleMaximize,
} from './windows/mainWindow'

/** The `browser.*` mirror registered on every space session (spike fix 1). */
const MIRROR_PRELOAD_PATH = join(__dirname, '../preload/browserMirror.js')

// Tests and parallel dev profiles can point Big Browser at a throwaway data dir.
const userDataOverride = process.env['BIG_BROWSER_USER_DATA']
if (userDataOverride) app.setPath('userData', userDataOverride)
else {
  try {
    migrateLegacyData(app.getPath('appData'), app.getPath('userData'))
  } catch (error) {
    console.warn('Could not move the data kept under the former name (ACAB):', error)
  }
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()

const externalUrls = new ExternalUrlQueue()
if (gotLock) externalUrls.enqueue(urlFromArgv(process.argv))

const execFileAsync = promisify(execFile)

const defaultBrowserApi: DefaultBrowserApi = {
  platform: process.platform,
  target: protocolClientTarget(process.execPath, process.argv, Boolean(process.defaultApp)),
  isDefaultProtocolClient: (protocol, path, args) =>
    path
      ? app.isDefaultProtocolClient(protocol, path, args)
      : app.isDefaultProtocolClient(protocol),
  setAsDefaultProtocolClient: (protocol, path, args) =>
    path
      ? app.setAsDefaultProtocolClient(protocol, path, args)
      : app.setAsDefaultProtocolClient(protocol),
  runReg: async (args) => {
    const { stdout } = await execFileAsync('reg.exe', args, { windowsHide: true })
    return stdout
  },
  openExternal: (url) => shell.openExternal(url),
}

const db = openDatabase(join(app.getPath('userData'), DB_FILE))
const settings = new SettingsStore(db)
// `npm run dev:onboarding` shows the onboarding on every launch (to work on it).
if (process.env['BIG_BROWSER_ONBOARDING'] === '1') settings.update({ onboardingDone: false })
const accounts = new Accounts({
  db,
  authStatus: async (configDir) => {
    const cli = findCli()
    return cli ? authStatus(cli, configDir) : null
  },
  defaultColor: () => settings.get().accent,
})
const history = new HistoryStore(db)
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

/** The split whose divider is being dragged (its first or second tab), or null. */
let splitDrag: { tabId: string } | null = null

/** Whether `tabId` is (still) a half of a split. */
const inSplit = (tabId: string): boolean => shownSplit(browser.snapshot().tabs, tabId) !== null

/**
 * Ends a divider drag: stores the ratio under `x`, or (no `x`) goes back to the stored one. Runs
 * once per drag (the UI and the overlay may both report the release); the capture layer always goes,
 * even when the split vanished mid-drag.
 */
function endSplitDrag(x: number | null): void {
  const drag = splitDrag
  if (!drag) return
  splitDrag = null
  try {
    if (x !== null && tabViews && inSplit(drag.tabId)) {
      browser.setSplitRatio(drag.tabId, tabViews.splitRatioAt(x))
    }
  } finally {
    tabViews?.previewSplitRatio(null)
    overlay?.close()
  }
}

function overlayView(): OverlayView {
  if (!overlay) throw new Error('No browser window')
  return overlay
}

function browserState(): BrowserState {
  const snapshot = browser.snapshot()
  return { ...snapshot, runtime: tabViews?.runtime(snapshot.tabs.map((t) => t.id)) ?? {} }
}

function views(): TabViews {
  if (!tabViews) throw new Error('No browser window')
  return tabViews
}

/**
 * The user's close. An unloaded (favourite or pinned) tab stays in the model, often with an
 * unchanged snapshot, so `TabViews.sync` can't tell: its view is destroyed here.
 */
function closeTab(tabId: string): void {
  for (const id of browser.closeTab(tabId).unloaded) tabViews?.unload(id)
}

/** URLs an extension may open as a tab: web pages and extension pages, nothing local. */
const isTabUrl = (url: string): boolean =>
  url === 'about:blank' || /^(https?|chrome-extension):/i.test(url)

/** Tabs and the window, as the space sessions' extensions see them. */
const extensionHost: ExtensionHost = {
  openTab: async (spaceId, url) => {
    if (!isTabUrl(url)) throw new Error(`Extensions cannot open ${url} as a tab`)
    const tab = browser.openTab(spaceId, url)
    // Only the active space's tabs get a view: an extension of another space brings it forward.
    if (browser.snapshot().activeSpaceId !== spaceId) browser.activateSpace(spaceId)
    const contents = views().webContentsOf(tab.id)
    if (!contents) throw new Error('The new tab has no view')
    return contents
  },
  selectTab: (contents) => {
    const tabId = tabViews?.tabIdOf(contents)
    if (tabId) browser.activateTab(tabId)
  },
  closeTab: (contents) => {
    const tabId = tabViews?.tabIdOf(contents)
    if (tabId) closeTab(tabId)
  },
  window: () => mainWindow,
}

// One list for every space: each space session hands its downloads over as it is set up.
const downloads = new Downloads({
  store: new DownloadsStore(db),
  directory: () => app.getPath('downloads'),
  exists: existsSync,
  onChange: (list) => {
    for (const contents of trustedContents()) emit(contents, 'downloads.changed', list)
  },
})

const testExtension = process.env['BIG_BROWSER_TEST_EXTENSION']
const spaceSessions = new SpaceSessions({
  userData: app.getPath('userData'),
  mirrorPreload: MIRROR_PRELOAD_PATH,
  host: extensionHost,
  onSession: (ses) => downloads.attach(ses),
  ...(testExtension ? { testExtension } : {}),
  // Tests run on a throwaway data dir and never touch the network.
  autoUpdate: !userDataOverride,
  autoAllowInstalls: Boolean(userDataOverride),
})

let adBlocker: AdBlocker | null = null

function applyAdBlock({ enabled, allowedHosts }: Settings['adBlock']): void {
  adBlocker?.setAllowedHosts(allowedHosts)
  spaceSessions.setAdBlocking(adBlocker, enabled)
}

// Loaded without holding up the window: sessions set up before it arrives get it then. Under test
// (`BIG_BROWSER_USER_DATA`) the lists are never downloaded: a local list or no blocker at all.
const adBlockFilters = process.env['BIG_BROWSER_ADBLOCK_FILTERS']
if (userDataOverride && !adBlockFilters) {
  console.warn(
    'Ad blocker skipped: BIG_BROWSER_USER_DATA is set without BIG_BROWSER_ADBLOCK_FILTERS',
  )
} else {
  void AdBlocker.load({
    cachePath: join(app.getPath('userData'), 'adblock-engine.bin'),
    ...(adBlockFilters ? { filtersFile: adBlockFilters } : {}),
  }).then((loaded) => {
    adBlocker = loaded
    applyAdBlock(settings.get().adBlock)
  })
}

// Spike fix 2: window.open from an extension page (popup, background) opens a tab of its space,
// like Chrome, instead of a window that steals focus and closes the popup. Tab views, the UI and
// the overlay install their own handler right after creation, which replaces this one.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    const spaceId = spaceSessions.spaceOf(contents.session)
    if (spaceId && isTabUrl(url)) {
      setImmediate(() => void extensionHost.openTab(spaceId, url).catch(() => undefined))
    }
    return { action: 'deny' }
  })
})

function activeTabId(): string | null {
  const snapshot = browser.snapshot()
  return snapshot.activeTabIds[snapshot.activeSpaceId] ?? null
}

/** Activates the neighbour of the active tab in its space's drawn order, wrapping around. */
function cycleTab(step: 1 | -1): void {
  const tabs = browser.visibleOrder(browser.snapshot().activeSpaceId)
  const active = activeTabId()
  const index = active ? tabs.indexOf(active) : -1
  const next = tabs[(index + step + tabs.length) % tabs.length]
  if (tabs.length > 1 && next) browser.activateTab(next)
}

/** Splits the active tab with the next row of its list, else the previous (splitPartner). */
function splitActive(): void {
  const active = activeTabId()
  if (!active) return
  const snapshot = browser.snapshot()
  const partner = splitPartner(snapshot.tabs, browser.visibleOrder(snapshot.activeSpaceId), active)
  if (partner) browser.splitTabs(active, partner)
}

/** The macOS share menu with the tab's URL, at the pointer; elsewhere the URL is copied. */
function shareTab(tabId: string): void {
  const tab = browser.snapshot().tabs.find((t) => t.id === tabId)
  if (!tab) throw new Error(`Unknown tab ${tabId}`)
  if (process.platform === 'darwin' && mainWindow) {
    new ShareMenu({ urls: [tab.url] }).popup({ window: mainWindow })
  } else {
    clipboard.writeText(tab.url)
  }
}

const CHROME_WEB_STORE = 'https://chromewebstore.google.com/'

const sidebarMenuHost: SidebarMenuHost = {
  store: browser,
  closeTab,
  reloadTab: (tabId) => tabViews?.reload(tabId),
  isMuted: (tabId) => tabViews?.isMuted(tabId) ?? null,
  setMuted: (tabId, muted) => tabViews?.setMuted(tabId, muted),
  emitShortcut,
  openOverlay: (request) => overlayView().open(request),
}

/** The menu drawn in the overlay and what its items run. */
const menus = new MenuRegistry()

/**
 * Draws a menu in the overlay, at a point or from a button; the chosen item runs here. A page's
 * menu passes the page, which gets the keyboard back when the menu closes.
 */
function showMenu(where: MenuWhere, items: MenuItemDef[], returnFocusTo?: WebContents): void {
  overlayView().open(menuRequest(where, menus.open(items)), returnFocusTo)
}

function emitShortcut(shortcut: Shortcut): void {
  if (!mainWindow) return
  // Any other target (address bar, settings, a folder's name) takes over from an open card, which
  // would otherwise stay drawn over the window and swallow the next click.
  if (shortcut.kind !== 'command' && shortcut.kind !== 'tab-finder') overlay?.close()
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
      // The command field: a tab is created only when what is typed in it is submitted.
      newTab: () => emitShortcut({ kind: 'command' }),
      findTab: () => emitShortcut({ kind: 'tab-finder' }),
      closeTab: withActive(closeTab),
      reopenClosed: () => {
        browser.reopenClosed()
      },
      focusAddress: () => emitShortcut({ kind: 'focus-address' }),
      reload: withActive((id) => tabViews?.reload(id)),
      back: withActive((id) => tabViews?.goBack(id)),
      forward: withActive((id) => tabViews?.goForward(id)),
      nextTab: () => cycleTab(1),
      previousTab: () => cycleTab(-1),
      splitView: splitActive,
      settings: () => emitShortcut({ kind: 'settings' }),
    }),
  )
}

/** How often main checks the pointer while the macOS traffic lights show. */
const TOP_BAND_POLL_MS = 50
let topBandWatch: ReturnType<typeof setInterval> | null = null

/**
 * While the window's top margin is open: it is a drag region (and on macOS the traffic lights sit
 * over it), where the page gets no pointer events, so main watches the pointer and tells the UI
 * when it leaves (or comes back to) the window's top band.
 */
function watchTopBand(win: BrowserWindow, visible: boolean): void {
  if (topBandWatch !== null) clearInterval(topBandWatch)
  topBandWatch = null
  if (!visible || (process.platform !== 'darwin' && process.platform !== 'win32')) return
  let inside = true
  topBandWatch = setInterval(() => {
    if (win.isDestroyed()) return
    const now = inTopBand(screen.getCursorScreenPoint(), win.getBounds(), WINDOW_CONTROLS_H)
    if (now === inside) return
    inside = now
    emit(win.webContents, 'window.topHover', now)
  }, TOP_BAND_POLL_MS)
}

const pageRadiusFor = (style: Settings['contextBarStyle']): number =>
  style === 'attached' ? 0 : PAGE_RADIUS

function focusMainWindow(): void {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
}

function openMainWindow(): void {
  const win = createMainWindow({ material: materialFor(settings.get().transparency) })
  mainWindow = win
  // Created before any tab view, then raised over each new one.
  const overlayView = new OverlayView(win, PRELOAD_PATH, rendererUrl(), () => {
    // The capture layer went away (e.g. the window lost it): a drag in progress is cancelled.
    endSplitDrag(null)
    menus.clear()
    emit(win.webContents, 'overlay.closed', undefined)
    emit(overlayView.webContents, 'overlay.closed', undefined)
  })
  overlay = overlayView
  // A release outside the window never arrives: drop the drag rather than store it later.
  win.on('blur', () => endSplitDrag(null))
  win.on('maximize', () => emit(win.webContents, 'window.maximized', true))
  win.on('unmaximize', () => emit(win.webContents, 'window.maximized', false))
  tabViews = new TabViews(
    win,
    browser,
    spaceSessions,
    emitBrowserState,
    showMenu,
    () => overlayView.raise(),
    history,
  )
  tabViews.setBorderRadius(pageRadiusFor(settings.get().contextBarStyle))
  tabViews.sync(browser.snapshot())
  externalUrls.attach({
    openTab: (url) => {
      browser.openTab(browser.snapshot().activeSpaceId, url)
    },
    focusWindow: focusMainWindow,
  })
  win.on('closed', () => {
    externalUrls.detach()
    mainWindow = null
    tabViews = null
    overlay = null
  })
}

registerCommands(
  {
    'app.info': () => ({ version: app.getVersion(), platform, glassSupported: glassSupported() }),
    'app.defaultBrowser': async () => ({ isDefault: await isDefaultBrowser(defaultBrowserApi) }),
    'app.makeDefaultBrowser': () => makeDefaultBrowser(defaultBrowserApi),
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
    'browser.closeTab': ({ tabId }) => closeTab(tabId),
    'browser.removeTab': ({ tabId }) => browser.removeTab(tabId),
    'browser.moveTab': ({ tabId, section, folderId, index }) =>
      browser.moveTab(tabId, { section, index, ...(folderId === undefined ? {} : { folderId }) }),
    'browser.splitTabs': ({ firstId, secondId }) => browser.splitTabs(firstId, secondId),
    'browser.splitActive': splitActive,
    'browser.separate': ({ tabId }) => browser.separate(tabId),
    'browser.closeSplit': ({ tabId }) => {
      for (const id of browser.closeSplit(tabId).unloaded) tabViews?.unload(id)
    },
    'browser.setSplitRatio': ({ tabId, ratio }) => browser.setSplitRatio(tabId, ratio),
    'browser.splitDrag': (drag) => {
      if (drag.phase === 'start') {
        if (!inSplit(drag.tabId)) return
        splitDrag = { tabId: drag.tabId }
        overlayView().open({ kind: 'split-drag' })
      } else if (drag.phase === 'move') {
        if (splitDrag) tabViews?.previewSplitRatio(tabViews.splitRatioAt(drag.x))
      } else endSplitDrag(drag.phase === 'end' ? drag.x : null)
    },
    'browser.createFolder': ({ spaceId, name, parentId }) =>
      browser.createFolder(spaceId ?? browser.snapshot().activeSpaceId, name, parentId ?? null),
    'browser.moveFolder': ({ folderId, parentId, index }) =>
      browser.moveFolder(folderId, { parentId, index }),
    'browser.renameFolder': ({ folderId, name }) => browser.renameFolder(folderId, name),
    'browser.setFolderIcon': ({ folderId, icon }) => browser.setFolderIcon(folderId, icon),
    'browser.setFolderCollapsed': ({ folderId, collapsed }) =>
      browser.setFolderCollapsed(folderId, collapsed),
    'browser.deleteFolder': ({ folderId }) => browser.deleteFolder(folderId),
    'browser.reopenClosed': () => {
      browser.reopenClosed()
    },
    'browser.showTabMenu': ({ tabId, at }) => showMenu({ at }, tabMenu(sidebarMenuHost, tabId)),
    'browser.showFolderMenu': ({ folderId, at, anchor }) =>
      showMenu(
        { at },
        folderMenu(sidebarMenuHost, folderId, anchor ?? { x: at.x, y: at.y, width: 1, height: 1 }),
      ),
    'browser.showSpaceMenu': ({ spaceId, anchor }) =>
      showMenu({ anchor, placement: 'below' }, spaceMenu(sidebarMenuHost, spaceId, anchor)),
    'browser.activateTab': ({ tabId }) => browser.activateTab(tabId),
    'browser.navigate': ({ tabId, input }) => views().navigate(tabId, resolveInput(input)),
    'browser.goBack': ({ tabId }) => views().goBack(tabId),
    'browser.goForward': ({ tabId }) => views().goForward(tabId),
    'browser.reload': ({ tabId }) => views().reload(tabId),
    'browser.createSpace': ({ name, color }) => browser.createSpace(name, color),
    'browser.activateSpace': ({ spaceId }) => browser.activateSpace(spaceId),
    'browser.renameSpace': ({ spaceId, name }) => browser.renameSpace(spaceId, name),
    'browser.setSpaceIcon': ({ spaceId, icon }) => browser.setSpaceIcon(spaceId, icon),
    'browser.setSpaceColor': ({ spaceId, color }) => browser.setSpaceColor(spaceId, color),
    'browser.setSpaceSectionCollapsed': ({ spaceId, collapsed }) =>
      browser.setSpaceSectionCollapsed(spaceId, collapsed),
    'browser.deleteSpace': async ({ spaceId }) => {
      // The store's change event runs TabViews.sync: the deleted tabs' views are destroyed and
      // the next space's active tab is shown.
      browser.deleteSpace(spaceId)
      // The space is gone: a failing wipe must not fail the command, only be logged.
      try {
        await spaceSessions.wipe(spaceId)
      } catch (error) {
        console.warn("Could not wipe the deleted space's browsing data:", error)
      }
      try {
        history.wipeSpace(spaceId)
      } catch (error) {
        console.warn("Could not wipe the deleted space's history:", error)
      }
    },
    'history.frequent': ({ spaceId }) =>
      history.frequent(spaceId ?? browser.snapshot().activeSpaceId),
    'history.search': ({ query }) => history.search(query),
    'history.forget': ({ id }) => history.forget(id),
    'downloads.list': () => downloads.list(),
    'downloads.clear': () => downloads.clear(),
    'downloads.show': ({ id }) => {
      const path = downloads.pathOf(id)
      if (path) shell.showItemInFolder(path)
    },
    'browser.setPageBounds': (bounds) => views().setBounds(bounds),
    'browser.setPageVisible': ({ visible }) => views().setVisible(visible),
    'browser.copyLink': ({ tabId }) => {
      const tab = browser.snapshot().tabs.find((t) => t.id === tabId)
      if (tab) clipboard.writeText(tab.url)
    },
    'browser.share': ({ tabId }) => shareTab(tabId),
    'browser.toggleDevTools': ({ tabId }) => views().toggleDevTools(tabId),
    'browser.openWebStore': () => {
      browser.openTab(browser.snapshot().activeSpaceId, CHROME_WEB_STORE)
    },
    'window.setControlsVisible': ({ visible }) => {
      if (!mainWindow) return
      watchTopBand(mainWindow, visible)
    },
    'window.minimize': () => mainWindow?.minimize(),
    'window.toggleMaximize': () => {
      if (mainWindow) toggleMaximize(mainWindow)
    },
    'window.close': () => mainWindow?.close(),
    'window.isMaximized': () => mainWindow?.isMaximized() ?? false,
    'overlay.open': (request) => {
      // A popover of the UI replaces main's menu: its ids go stale.
      menus.clear()
      overlayView().open(request)
    },
    'overlay.close': () => overlayView().close(),
    'overlay.choose': ({ menuId, itemId }) => menus.choose(menuId, itemId),
    // From the overlay itself, the pointer is on the strip: hide it at once so the page gets the click.
    'overlay.tooltip': (tooltip, event) =>
      overlayView().tooltip(tooltip, { now: event.sender === overlayView().webContents }),
    'ui.openSettings': () => emitShortcut({ kind: 'settings' }),
    'ui.focusAddress': () => emitShortcut({ kind: 'focus-address' }),
    'ui.renameFolder': ({ folderId }) => emitShortcut({ kind: 'rename-folder', folderId }),
  },
  isTrustedSender,
)

// The native material only changes at the thresholds (0 and liquid); how see-through the frame is
// in between is CSS. Re-applying vibrancy on every tick of a slider flickers.
let appliedMaterial = materialFor(settings.get().transparency)
let appliedAdBlock = settings.get().adBlock
let appliedContextBarStyle = settings.get().contextBarStyle
settings.subscribe((next) => {
  if (next.adBlock !== appliedAdBlock) {
    const { added, removed } = diffHosts(appliedAdBlock.allowedHosts, next.adBlock.allowedHosts)
    appliedAdBlock = next.adBlock
    applyAdBlock(next.adBlock)
    // A page whose site was just allowed (or no longer is) shows the change at once.
    for (const tabId of tabViews?.tabIdsOnHosts([...added, ...removed]) ?? []) {
      tabViews?.reload(tabId)
    }
  }
  if (next.contextBarStyle !== appliedContextBarStyle) {
    appliedContextBarStyle = next.contextBarStyle
    tabViews?.setBorderRadius(pageRadiusFor(next.contextBarStyle))
  }
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

app.on('open-url', (event, url) => {
  event.preventDefault()
  handleOpenUrl(url, externalUrls, () => {
    if (app.isReady() && !mainWindow) openMainWindow()
  })
})

app.on('second-instance', (_event, argv) => {
  handleSecondInstance(argv, externalUrls, focusMainWindow)
})

app.on('will-quit', () => db.close())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

void app.whenReady().then(() => {
  if (!gotLock) return
  // The UI and the overlay (default session) show extension icons from `crx://` (site menu).
  ElectronChromeExtensions.handleCRXProtocol(session.defaultSession)
  setupMenu()
  openMainWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openMainWindow()
  })
})
