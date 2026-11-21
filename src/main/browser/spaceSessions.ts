// One Electron session per space (`persist:space-<id>`): its cookies, permissions and Chrome
// extensions. Each session is set up once, the first time a tab of that space needs it.
import { rm } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { dialog, session, type BrowserWindow, type Session, type WebContents } from 'electron'
import { ElectronChromeExtensions } from 'electron-chrome-extensions'
import { installChromeWebStore } from 'electron-chrome-web-store'
import { permissionSummary } from '@core/browser/extensionPermissions'
import { isPermissionGranted } from '@core/browser/permissions'
import { chromeUserAgent } from '@core/browser/userAgent'
import { spacePartition } from '@shared/spaces'
import type { AdBlocker } from './adBlocker'

/** What extensions may do to the browser: tabs and windows are Big Browser's tabs and its one window. */
export interface ExtensionHost {
  /** Opens `url` as the active tab of the space and resolves with its web contents. */
  openTab(spaceId: string, url: string): Promise<WebContents>
  selectTab(contents: WebContents): void
  closeTab(contents: WebContents): void
  window(): BrowserWindow | null
}

export interface SpaceSessionsOptions {
  userData: string
  /** The built `browserMirror` preload (spike fix 1). */
  mirrorPreload: string
  host: ExtensionHost
  /** An unpacked extension loaded in every space (e2e, `BIG_BROWSER_TEST_EXTENSION`). */
  testExtension?: string
  /** Web Store update checks (off under test: they go to the network). Defaults to true. */
  autoUpdate?: boolean
  /** Installs without asking (e2e): a native dialog would block the test. Defaults to false. */
  autoAllowInstalls?: boolean
  /** Called once for each session as it is set up (downloads hook in here). */
  onSession?: (ses: Session) => void
  /** Deletes a folder and what it holds (a seam for tests). Defaults to a recursive `rm`. */
  removeDir?: (path: string) => Promise<void>
}

/**
 * The folder holding a space's Web Store extensions, or null when `spaceId` would resolve outside
 * `userData/extensions` (or to it): a guard before deleting it.
 */
export function extensionsDir(userData: string, spaceId: string): string | null {
  const root = resolve(userData, 'extensions')
  const dir = resolve(root, spaceId)
  const rel = relative(root, dir)
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null
  return dir
}

export class SpaceSessions {
  private readonly extensions = new Map<string, ElectronChromeExtensions>()
  private readonly spaces = new Map<Session, string>()
  /** Per space, the tabs opened by `chrome.windows.create` (what `windows.remove` closes). */
  private readonly windowTabs = new Map<string, Set<WebContents>>()
  /** Null until the blocker has loaded (it loads after the window opens), or if it failed. */
  private adBlocker: AdBlocker | null = null
  private adBlockEnabled = true

  constructor(private readonly opts: SpaceSessionsOptions) {}

  get(spaceId: string): Session {
    const ses = session.fromPartition(spacePartition(spaceId))
    if (this.spaces.has(ses)) return ses
    this.spaces.set(ses, spaceId)

    ses.setUserAgent(chromeUserAgent(ses.getUserAgent()))
    ses.setPermissionRequestHandler((_contents, permission, callback) =>
      callback(isPermissionGranted(permission)),
    )
    ses.setPermissionCheckHandler((_contents, permission) => isPermissionGranted(permission))

    // Registers the library's `chrome.*` preload first: the mirror below must run after it.
    this.extensions.set(spaceId, this.createExtensions(spaceId, ses))
    // Spike fix 1: Electron gives extension workers a native `browser` separate from `chrome`;
    // extensions that prefer it (1Password) would miss the APIs added to `chrome`.
    for (const type of ['frame', 'service-worker'] as const) {
      ses.registerPreloadScript({
        id: `big-browser-mirror-${type}`,
        type,
        filePath: this.opts.mirrorPreload,
      })
    }

    this.applyAdBlocking(ses)
    this.opts.onSession?.(ses)
    void this.loadExtensions(spaceId, ses)
    return ses
  }

  /** Blocks ads (or stops) in every space session, now and in those set up later. */
  setAdBlocking(blocker: AdBlocker | null, enabled: boolean): void {
    this.adBlocker = blocker
    this.adBlockEnabled = enabled
    for (const ses of this.spaces.keys()) this.applyAdBlocking(ses)
  }

  extensionsFor(spaceId: string): ElectronChromeExtensions | null {
    return this.extensions.get(spaceId) ?? null
  }

  /**
   * Erases a deleted space's browsing data (cookies, storage, cache) and its extensions: unloaded
   * (their workers stop, and the Web Store updater, which checks the loaded ones, has nothing left
   * to update) and deleted from disk. Its tab views are already gone.
   */
  async wipe(spaceId: string): Promise<void> {
    const ses = session.fromPartition(spacePartition(spaceId))
    this.extensions.delete(spaceId)
    this.windowTabs.delete(spaceId)
    this.spaces.delete(ses)
    for (const { id } of ses.extensions.getAllExtensions()) ses.extensions.removeExtension(id)
    await ses.clearStorageData()
    await ses.clearCache()
    const dir = extensionsDir(this.opts.userData, spaceId)
    if (dir) await (this.opts.removeDir ?? removeTree)(dir)
  }

  /** The space whose session this is, or null for any other session (the UI's, the default). */
  spaceOf(ses: Session): string | null {
    return this.spaces.get(ses) ?? null
  }

  /** A blocker failure leaves the space without blocking, never half set up. */
  private applyAdBlocking(ses: Session): void {
    try {
      if (this.adBlockEnabled) this.adBlocker?.enable(ses)
      else this.adBlocker?.disable(ses)
    } catch (error) {
      console.error(`Ad blocking failed in space ${this.spaces.get(ses) ?? '?'}:`, error)
    }
  }

  private createExtensions(spaceId: string, ses: Session): ElectronChromeExtensions {
    const { host } = this.opts
    const requireWindow = (): BrowserWindow => {
      const win = host.window()
      if (!win) throw new Error('No browser window')
      return win
    }
    return new ElectronChromeExtensions({
      session: ses,
      createTab: async (details) => {
        const contents = await host.openTab(spaceId, details.url ?? 'about:blank')
        return [contents, requireWindow()]
      },
      selectTab: (contents) => host.selectTab(contents),
      removeTab: (contents) => host.closeTab(contents),
      // Like Chrome's popup windows, but as tabs of the one browser window (spike fix 2).
      createWindow: async (details) => {
        const urls = details.url === undefined ? [] : [details.url].flat()
        const tabs = this.windowTabs.get(spaceId) ?? new Set<WebContents>()
        this.windowTabs.set(spaceId, tabs)
        for (const url of urls) tabs.add(await host.openTab(spaceId, url))
        return requireWindow()
      },
      // Every "window" is the browser window: closing one closes the tabs `createWindow` opened,
      // never the window itself (the library would `destroy()` it without this handler).
      removeWindow: () => {
        // The library also calls this when the main window closes: nothing to do then.
        const win = host.window()
        if (!win || win.isDestroyed()) return
        const tabs = this.windowTabs.get(spaceId)
        this.windowTabs.delete(spaceId)
        for (const contents of tabs ?? []) if (!contents.isDestroyed()) host.closeTab(contents)
      },
    })
  }

  private async loadExtensions(spaceId: string, ses: Session): Promise<void> {
    try {
      await installChromeWebStore({
        session: ses,
        extensionsPath: join(this.opts.userData, 'extensions', spaceId),
        autoUpdate: this.opts.autoUpdate ?? true,
        beforeInstall: async ({ localizedName, manifest, browserWindow }) => {
          if (this.opts.autoAllowInstalls) return { action: 'allow' }
          const lines = permissionSummary(manifest)
          const options = {
            type: 'question' as const,
            title: 'Add extension',
            message: `Add "${localizedName}"?`,
            detail: lines.length
              ? `It can:\n${lines.map((line) => `- ${line}`).join('\n')}`
              : 'It asks for no special permissions.',
            buttons: ['Add extension', 'Cancel'],
            defaultId: 1,
            cancelId: 1,
          }
          const { response } = browserWindow
            ? await dialog.showMessageBox(browserWindow, options)
            : await dialog.showMessageBox(options)
          return { action: response === 0 ? 'allow' : 'deny' }
        },
      })
      if (this.opts.testExtension) await ses.extensions.loadExtension(this.opts.testExtension)
    } catch (error) {
      console.error(`Extensions failed to load in space ${spaceId}:`, error)
    }
  }
}

const removeTree = (path: string): Promise<void> => rm(path, { recursive: true, force: true })
