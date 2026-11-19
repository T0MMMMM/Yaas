import { join } from 'node:path'
import { BrowserWindow, shell } from 'electron'

export const TITLEBAR_HEIGHT = 44

const isMac = process.platform === 'darwin'
const isWindows = process.platform === 'win32'

/** Windows 11 is build 22000+; Mica / Acrylic don't exist before. */
export function glassSupported(): boolean {
  if (isMac) return true
  if (!isWindows) return false
  const build = Number(process.getSystemVersion().split('.')[2] ?? 0)
  return build >= 22000
}

export function createMainWindow(options: { glass: boolean }): BrowserWindow {
  const glass = options.glass && glassSupported()

  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 760,
    minHeight: 520,
    show: false,
    title: 'YAAS',
    // Transparent so native material shows through; opaque fallback is set by CSS tokens.
    backgroundColor: glass ? '#00000000' : '#f3f2f5',
    ...(isMac && {
      titleBarStyle: 'hiddenInset' as const,
      trafficLightPosition: { x: 18, y: 16 },
      vibrancy: glass ? ('under-window' as const) : undefined,
      visualEffectState: 'followWindow' as const,
    }),
    ...(isWindows && {
      titleBarStyle: 'hidden' as const,
      titleBarOverlay: { color: '#00000000', symbolColor: '#a0a0a8', height: TITLEBAR_HEIGHT },
      backgroundMaterial: glass ? ('acrylic' as const) : ('none' as const),
    }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  })

  win.once('ready-to-show', () => win.show())

  // No in-app navigation, no popups: external links open in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault()
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))

  return win
}

/** Applies the glass setting live (DESIGN.md §4). */
export function applyGlass(win: BrowserWindow, enabled: boolean): void {
  const glass = enabled && glassSupported()
  if (isMac) {
    win.setVibrancy(glass ? 'under-window' : null)
  } else if (isWindows) {
    win.setBackgroundMaterial(glass ? 'acrylic' : 'none')
  }
  win.setBackgroundColor(glass ? '#00000000' : '#f3f2f5')
}
