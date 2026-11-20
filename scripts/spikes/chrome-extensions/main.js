// THROWAWAY SPIKE — can Chrome extensions (1Password, adblock, others) run in Electron 45?
const { app, BrowserWindow, WebContentsView, session, ipcMain, Menu } = require('electron')
const path = require('node:path')
const { ElectronChromeExtensions } = require('electron-chrome-extensions')
const { installChromeWebStore } = require('electron-chrome-web-store')
const { ElectronBlocker } = require('@ghostery/adblocker-electron')
const fetch = require('cross-fetch')

const UI_HEIGHT = 84
const PARTITION = 'persist:acab'

/** @type {BrowserWindow} */ let win
/** @type {ElectronChromeExtensions} */ let extensions
const tabs = new Map() // id -> WebContentsView
let activeId = null

function log(...a) {
  console.log('[spike]', ...a)
}

function layout() {
  const [w, h] = win.getContentSize()
  for (const [id, view] of tabs) {
    view.setVisible(id === activeId)
    view.setBounds({ x: 0, y: UI_HEIGHT, width: w, height: h - UI_HEIGHT })
  }
}

function sendState() {
  const list = [...tabs.entries()].map(([id, v]) => ({
    id,
    title: v.webContents.getTitle() || v.webContents.getURL(),
    url: v.webContents.getURL(),
  }))
  win.webContents.send('tabs', { list, activeId })
}

function createTab(url = 'https://www.google.com') {
  const view = new WebContentsView({
    webPreferences: {
      session: session.fromPartition(PARTITION),
      sandbox: true,
      contextIsolation: true,
    },
  })
  const wc = view.webContents
  tabs.set(wc.id, view)
  win.contentView.addChildView(view)
  extensions.addTab(wc, win)
  wc.on('page-title-updated', sendState)
  wc.on('did-navigate', sendState)
  wc.on('did-navigate-in-page', sendState)
  wc.setWindowOpenHandler(({ url: u }) => {
    selectTab(createTab(u).webContents.id)
    return { action: 'deny' }
  })
  wc.on('context-menu', (_e, params) => {
    const items = extensions.getContextMenuItems(wc, params)
    items.push({ label: 'Inspect', click: () => wc.inspectElement(params.x, params.y) })
    Menu.buildFromTemplate(items).popup()
  })
  wc.loadURL(url)
  selectTab(wc.id)
  return view
}

function selectTab(id) {
  const view = tabs.get(id)
  if (!view) return
  activeId = id
  extensions.selectTab(view.webContents)
  layout()
  sendState()
}

function closeTab(id) {
  const view = tabs.get(id)
  if (!view) return
  win.contentView.removeChildView(view)
  view.webContents.close()
  tabs.delete(id)
  if (activeId === id) activeId = [...tabs.keys()].pop() ?? null
  if (activeId === null) createTab()
  else selectTab(activeId)
}

app.whenReady().then(async () => {
  const ses = session.fromPartition(PARTITION)
  // Chrome-like UA: some sites (Google sign-in, CWS) refuse "Electron" UAs.
  const ua = ses
    .getUserAgent()
    .replace(/\sElectron\/\S+/, '')
    .replace(/\sacab-spike\/\S+/, '')
  ses.setUserAgent(ua)
  app.userAgentFallback = ua

  extensions = new ElectronChromeExtensions({
    session: ses,
    createTab: async (details) => {
      log('ext createTab', JSON.stringify(details))
      const view = createTab(details.url)
      return [view.webContents, win]
    },
    selectTab: (wc) => selectTab(wc.id),
    removeTab: (wc) => closeTab(wc.id),
    createWindow: async (details) => {
      // Popup windows requested by extensions (1Password uses these).
      log('ext createWindow', JSON.stringify(details))
      const w = new BrowserWindow({
        width: details.width ?? 400,
        height: details.height ?? 600,
        webPreferences: { session: ses, sandbox: true, contextIsolation: true },
      })
      if (details.url) w.loadURL(Array.isArray(details.url) ? details.url[0] : details.url)
      return w
    },
    removeWindow: (w) => w.destroy(),
  })

  // Known fix for 1Password: mirror chrome.* onto the native browser.* object.
  ses.registerPreloadScript({
    id: 'browser-mirror-frame',
    type: 'frame',
    filePath: path.join(__dirname, 'browser-mirror.preload.js'),
  })
  ses.registerPreloadScript({
    id: 'browser-mirror-sw',
    type: 'service-worker',
    filePath: path.join(__dirname, 'browser-mirror.preload.js'),
  })

  ElectronChromeExtensions.handleCRXProtocol(session.defaultSession)
  extensions.on('browser-action-popup-created', (popup) => log('popup created', popup.extensionId))
  app.on('browser-window-created', (_e, w) => {
    log('window created')
    w.on('blur', () => log('window blur'))
    w.on('closed', () => log('window closed'))
  })
  app.on('web-contents-created', (_e, wc) => {
    // Like Chrome: window.open from extension popups/pages opens a tab in the browser window,
    // instead of a new window that steals focus and closes the popup (and itself with it).
    // Tabs override this with their own handler right after creation.
    wc.setWindowOpenHandler(({ url }) => {
      log('window.open -> tab', wc.getType(), url)
      setImmediate(() => win && selectTab(createTab(url).webContents.id))
      return { action: 'deny' }
    })
    wc.on('did-start-navigation', (d) => d.isMainFrame && log('nav', wc.getType(), d.url))
    wc.on('render-process-gone', (_ev, det) => log('render gone', det.reason))
  })

  await installChromeWebStore({ session: ses })
  log(
    'loaded extensions:',
    ses.extensions.getAllExtensions().map((e) => e.name),
  )

  // Built-in adblock (Ghostery engine), toggle with --no-adblock
  if (!process.argv.includes('--no-adblock')) {
    const blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch)
    blocker.enableBlockingInSession(ses)
    log('built-in adblock on')
  }

  win = new BrowserWindow({
    width: 1300,
    height: 850,
    title: 'ACAB spike',
    webPreferences: {
      preload: path.join(__dirname, 'ui.preload.js'),
      sandbox: false,
      contextIsolation: true,
    },
  })
  win.on('resize', layout)
  await win.loadFile(path.join(__dirname, 'ui.html'))

  ipcMain.on('new-tab', (_e, url) => createTab(url))
  ipcMain.on('select-tab', (_e, id) => selectTab(id))
  ipcMain.on('close-tab', (_e, id) => closeTab(id))
  ipcMain.on('navigate', (_e, input) => {
    const view = tabs.get(activeId)
    if (!view) return
    const url = /^[a-z]+:\/\//i.test(input)
      ? input
      : input.includes('.') && !input.includes(' ')
        ? `https://${input}`
        : `https://www.google.com/search?q=${encodeURIComponent(input)}`
    view.webContents.loadURL(url)
  })
  ipcMain.on('nav', (_e, cmd) => {
    const wc = tabs.get(activeId)?.webContents
    if (!wc) return
    if (cmd === 'back') wc.navigationHistory.goBack()
    if (cmd === 'forward') wc.navigationHistory.goForward()
    if (cmd === 'reload') wc.reload()
    if (cmd === 'devtools') wc.openDevTools({ mode: 'detach' })
  })

  createTab('https://chromewebstore.google.com/')
})

app.on('window-all-closed', () => app.quit())
