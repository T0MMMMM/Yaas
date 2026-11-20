// Built-in ad and tracker blocking (Ghostery's engine), on every space session, with sites the
// user allowed as exceptions. The rules without Electron are in `core/browser/adblock.ts`.
import { readFile, writeFile } from 'node:fs/promises'
import { ipcMain, type Session } from 'electron'
import { ElectronBlocker } from '@ghostery/adblocker-electron'
import { diffAllowed, loadEngine } from '@core/browser/adblock'

export interface AdBlockerOptions {
  /** Where the prebuilt engine is cached between launches (a refresh replaces it). */
  cachePath: string
  /** A local filter list used instead of the prebuilt lists (e2e, `ACAB_ADBLOCK_FILTERS`). */
  filtersFile?: string
}

/** Handlers Ghostery registers on `ipcMain` for its cosmetic preload, once per enabled session. */
const COSMETIC_CHANNELS = [
  '@ghostery/adblocker/inject-cosmetic-filters',
  '@ghostery/adblocker/is-mutation-observer-enabled',
] as const

export class AdBlocker {
  private allowedHosts: string[] = []
  private readonly sessions = new Set<Session>()

  private constructor(private readonly blocker: ElectronBlocker) {}

  /** Loads the engine; offline or failing, logs and resolves null (browsing without blocking). */
  static async load(opts: AdBlockerOptions): Promise<AdBlocker | null> {
    const { filtersFile } = opts
    const blocker = await loadEngine(
      () =>
        filtersFile
          ? readFile(filtersFile, 'utf8').then((text) => ElectronBlocker.parse(text))
          : ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {
              path: opts.cachePath,
              read: readFile,
              write: writeFile,
            }),
      (message, error) => console.error(message, error),
    )
    return blocker ? new AdBlocker(blocker) : null
  }

  // Ghostery's handlers are global but registered per session: a second `ipcMain.handle` would
  // throw, and disabling one session removes them for all. They don't depend on the session, so
  // drop them before enabling another session and put them back while any session still blocks.
  enable(session: Session): void {
    if (this.sessions.has(session)) return
    for (const channel of COSMETIC_CHANNELS) ipcMain.removeHandler(channel)
    this.blocker.enableBlockingInSession(session)
    this.sessions.add(session)
  }

  disable(session: Session): void {
    if (!this.sessions.delete(session)) return
    this.blocker.disableBlockingInSession(session)
    if (this.sessions.size === 0 || !this.blocker.config.loadCosmeticFilters) return
    ipcMain.handle(COSMETIC_CHANNELS[0], this.blocker.onInjectCosmeticFilters)
    ipcMain.handle(COSMETIC_CHANNELS[1], this.blocker.onIsMutationObserverEnabled)
  }

  /** Makes `hosts` the sites where blocking is off (the engine changes in place). */
  setAllowedHosts(hosts: string[]): void {
    const { added, removed } = diffAllowed(this.allowedHosts, hosts)
    this.allowedHosts = [...hosts]
    if (added.length > 0 || removed.length > 0) this.blocker.updateFromDiff({ added, removed })
  }
}
