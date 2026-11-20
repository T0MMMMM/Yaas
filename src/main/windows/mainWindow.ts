import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BrowserWindow, shell } from 'electron'

/** The app preload: exposes `window.bigBrowser` to the UI and the overlay, nothing else. */
export const PRELOAD_PATH = join(__dirname, '../preload/index.js')

/** Where the renderer loads from: the dev server, or the built file. */
export function rendererUrl(): string {
  return (
    process.env['ELECTRON_RENDERER_URL'] ??
    pathToFileURL(join(__dirname, '../renderer/index.html')).href
  )
}

const isMac = process.platform === 'darwin'
const isWindows = process.platform === 'win32'

/** Windows 11 is build 22000+; Mica / Acrylic don't exist before. */
export function glassSupported(): boolean {
  if (isMac) return true
  if (!isWindows) return false
  const build = Number(process.getSystemVersion().split('.')[2] ?? 0)
  return build >= 22000
}

/**
 * Window material, from the transparency setting (DESIGN.md §4):
 * - `opaque`: no material, CSS paints everything
 * - `frosted`: native blur of the desktop (vibrancy / acrylic) under a fading frame
 * - `clear`: liquid glass — no blur, the desktop itself shows through the frame
 */
export type Material = 'opaque' | 'frosted' | 'clear'

export const LIQUID_FROM = 0.9

export function materialFor(transparency: number): Material {
  if (!glassSupported() || transparency <= 0) return 'opaque'
  return transparency >= LIQUID_FROM ? 'clear' : 'frosted'
}

export function createMainWindow(options: { material: Material }): BrowserWindow {
  const { material } = options
  const glass = material !== 'opaque'

  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 760,
    minHeight: 520,
    show: false,
    title: 'Big Browser',
    // Transparent so native material shows through; opaque fallback is set by CSS tokens.
    backgroundColor: glass ? '#00000000' : '#f3f2f5',
    // macOS: a transparent window is what lets the desktop show through in `clear` mode.
    // It must be decided at creation, so it is always on; CSS keeps the opaque modes opaque.
    transparent: isMac,
    ...(isMac && {
      titleBarStyle: 'hiddenInset' as const,
      // In the window's top margin once it is open (WINDOW_CONTROLS_H), centred in its height.
      trafficLightPosition: { x: 14, y: 9 },
      vibrancy: material === 'frosted' ? ('under-window' as const) : undefined,
      visualEffectState: 'followWindow' as const,
    }),
    // Windows: no native caption buttons; the UI draws its own, revealed from the top edge.
    ...(isWindows && {
      titleBarStyle: 'hidden' as const,
      backgroundMaterial: glass ? ('acrylic' as const) : ('none' as const),
    }),
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  })

  // macOS: the traffic lights hide until the pointer rests on the top margin (WindowControls).
  if (isMac) win.setWindowButtonVisibility(false)

  win.once('ready-to-show', () => win.show())

  // No in-app navigation, no popups: external links open in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault()
  })

  void win.loadURL(rendererUrl())

  return win
}

/** Shows or hides the macOS traffic lights; the other platforms have nothing to toggle. */
export function setWindowControlsVisible(
  win: BrowserWindow,
  visible: boolean,
  platform: NodeJS.Platform = process.platform,
): void {
  if (platform === 'darwin') win.setWindowButtonVisibility(visible)
}

/**
 * Whether the pointer (screen DIP) is in the window's top band (`height` px tall, full width):
 * on macOS the traffic lights stay shown while it is, since the page gets no pointer events over
 * them.
 */
export function inTopBand(
  point: { x: number; y: number },
  bounds: { x: number; y: number; width: number; height: number },
  height: number,
): boolean {
  return (
    point.x >= bounds.x &&
    point.x < bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y < bounds.y + height
  )
}

/** The drawn maximize button (Windows): maximizes the window, or restores a maximized one. */
export function toggleMaximize(win: BrowserWindow): void {
  if (win.isMaximized()) win.unmaximize()
  else win.maximize()
}

/** Applies the material live (DESIGN.md §4). */
export function applyMaterial(win: BrowserWindow, material: Material): void {
  const glass = material !== 'opaque'
  if (isMac) {
    win.setVibrancy(material === 'frosted' ? 'under-window' : null)
  } else if (isWindows) {
    // No clear mode on Windows: acrylic is the closest to see-through.
    win.setBackgroundMaterial(glass ? 'acrylic' : 'none')
  }
  win.setBackgroundColor(glass ? '#00000000' : '#f3f2f5')
}
