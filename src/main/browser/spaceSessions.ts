// One Electron session per space (`persist:space-<id>`): its cookies, permissions and Chrome
// extensions. Each session is set up once, the first time a tab of that space needs it.
import { join } from 'node:path'
import { session, type BrowserWindow, type Session, type WebContents } from 'electron'
import { ElectronChromeExtensions } from 'electron-chrome-extensions'
import { installChromeWebStore } from 'electron-chrome-web-store'
import { isPermissionGranted } from '@core/browser/permissions'
import { chromeUserAgent } from '@core/browser/userAgent'

/** What extensions may do to the browser: tabs and windows are ACAB's tabs and its one window. */
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
  /** An unpacked extension loaded in every space (e2e, `ACAB_TEST_EXTENSION`). */
  testExtension?: string
  /** Web Store update checks (off under test: they go to the network). Defaults to true. */
  autoUpdate?: boolean
}

export class SpaceSessions {
  private readonly extensions = new Map<string, ElectronChromeExtensions>()
  private readonly spaces = new Map<Session, string>()

  constructor(private readonly opts: SpaceSessionsOptions) {}

  get(spaceId: string): Session {
    const ses = session.fromPartition(`persist:space-${spaceId}`)
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
        id: `acab-browser-mirror-${type}`,
        type,
        filePath: this.opts.mirrorPreload,
      })
    }

    void this.loadExtensions(spaceId, ses)
    return ses
  }

  extensionsFor(spaceId: string): ElectronChromeExtensions | null {
    return this.extensions.get(spaceId) ?? null
  }

  /** The space whose session this is, or null for any other session (the UI's, the default). */
  spaceOf(ses: Session): string | null {
    return this.spaces.get(ses) ?? null
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
      // Like Chrome's popup windows, but as a tab of the one browser window (spike fix 2).
      createWindow: async (details) => {
        const url = Array.isArray(details.url) ? details.url[0] : details.url
        if (url) await host.openTab(spaceId, url)
        return requireWindow()
      },
    })
  }

  private async loadExtensions(spaceId: string, ses: Session): Promise<void> {
    try {
      await installChromeWebStore({
        session: ses,
        extensionsPath: join(this.opts.userData, 'extensions', spaceId),
        autoUpdate: this.opts.autoUpdate ?? true,
      })
      if (this.opts.testExtension) await ses.extensions.loadExtension(this.opts.testExtension)
    } catch (error) {
      console.error(`Extensions failed to load in space ${spaceId}:`, error)
    }
  }
}
