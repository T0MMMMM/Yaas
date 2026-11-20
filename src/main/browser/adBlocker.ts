// Built-in ad and tracker blocking (Ghostery's engine), on every space session, with sites the
// user allowed as exceptions. The rules without Electron are in `core/browser/adblock.ts`.
import { readFile, stat, writeFile } from 'node:fs/promises'
import { ipcMain, type Session } from 'electron'
import { ElectronBlocker } from '@ghostery/adblocker-electron'
import { diffAllowed, isCacheStale, loadEngine } from '@core/browser/adblock'

export interface AdBlockerOptions {
  /** Where the prebuilt engine is cached between launches; a launch refreshes it after 7 days. */
  cachePath: string
  /** A local filter list used instead of the prebuilt lists (e2e, `ACAB_ADBLOCK_FILTERS`). */
  filtersFile?: string
}

/**
 * The prebuilt ads-and-tracking engine: from the cache while it is under 7 days old, else
 * downloaded and cached again. Offline with an old cache, the old lists beat no blocking.
 */
async function loadPrebuilt(cachePath: string): Promise<ElectronBlocker> {
  const mtimeMs = await stat(cachePath).then(
    (stats) => stats.mtimeMs,
    () => null,
  )
  if (mtimeMs !== null && !isCacheStale(mtimeMs, Date.now())) {
    try {
      return ElectronBlocker.deserialize(await readFile(cachePath))
    } catch (error) {
      console.warn('Ad blocker cache unreadable, downloading the lists:', error)
    }
  }
  let fresh: ElectronBlocker
  try {
    fresh = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch)
  } catch (error) {
    if (mtimeMs === null) throw error
    console.warn('Ad blocker lists could not be refreshed, using the cached ones:', error)
    return ElectronBlocker.deserialize(await readFile(cachePath))
  }
  // A cache that can't be written costs a download next launch, not this engine.
  await writeFile(cachePath, fresh.serialize()).catch((error: unknown) =>
    console.error('Ad blocker cache could not be written:', error),
  )
  return fresh
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
          : loadPrebuilt(opts.cachePath),
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
