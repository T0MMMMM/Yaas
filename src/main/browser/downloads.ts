// Downloads: every space session hands its downloads here. Files go straight to the system
// Downloads folder (no dialog); the store keeps the list across restarts, one for all spaces.
import { basename } from 'node:path'
import type { DownloadItem, Session } from 'electron'
import { uniqueDownloadPath } from '@core/browser/downloadPath'
import type { DownloadsStore } from '@core/browser/downloadsStore'
import type { Download } from '@shared/model'

/** At most one progress event per download in this time (a large file reports many times a second). */
export const PROGRESS_THROTTLE_MS = 250

export interface DownloadsOptions {
  store: DownloadsStore
  /** The folder files are saved to (the system Downloads folder). */
  directory: () => string
  exists: (path: string) => boolean
  /** The list changed: pushed to the UI. */
  onChange: (list: Download[]) => void
  now?: () => number
  /**
   * Whether file names differ only by case on this disk (`A.pdf` is `a.pdf`). Defaults to true on
   * Windows and macOS.
   */
  caseInsensitive?: boolean
}

export class Downloads {
  private readonly attached = new WeakSet<Session>()
  /** Paths promised to downloads still running (see `key`): their files may not exist yet. */
  private readonly reserved = new Set<string>()
  private readonly now: () => number
  /** A path as the disk compares it. */
  private readonly key: (path: string) => string

  constructor(private readonly opts: DownloadsOptions) {
    this.now = opts.now ?? Date.now
    const caseInsensitive =
      opts.caseInsensitive ?? (process.platform === 'win32' || process.platform === 'darwin')
    this.key = caseInsensitive ? (path) => path.toLowerCase() : (path) => path
  }

  /** Takes over the downloads of `ses`; a session is hooked once, however often it is passed. */
  attach(ses: Session): void {
    if (this.attached.has(ses)) return
    this.attached.add(ses)
    ses.on('will-download', (_event, item) => this.track(item))
  }

  list(): Download[] {
    return this.opts.store.list()
  }

  clear(): void {
    this.opts.store.clear()
    this.changed()
  }

  /** The saved file of a download, or null once it is forgotten. */
  pathOf(id: string): string | null {
    return this.opts.store.get(id)?.path ?? null
  }

  private changed(): void {
    this.opts.onChange(this.opts.store.list())
  }

  private track(item: DownloadItem): void {
    const { store, exists } = this.opts
    const path = uniqueDownloadPath(
      this.opts.directory(),
      item.getFilename(),
      (candidate) => this.reserved.has(this.key(candidate)) || exists(candidate),
    )
    this.reserved.add(this.key(path))
    item.setSavePath(path)
    const download = store.start({
      url: item.getURL(),
      path,
      // The name it was saved under (`a (1).pdf` when `a.pdf` was taken).
      filename: basename(path),
      totalBytes: item.getTotalBytes(),
    })
    this.changed()

    let lastEmit = this.now()
    item.on('updated', () => {
      const now = this.now()
      if (now - lastEmit < PROGRESS_THROTTLE_MS) return
      lastEmit = now
      store.progress(download.id, item.getReceivedBytes(), item.getTotalBytes())
      this.changed()
    })
    // The session may be wiped (its space deleted) while this runs: the item outlives it and the
    // row stays, so the download finishes and is recorded like any other.
    item.once('done', (_event, state) => {
      this.reserved.delete(this.key(path))
      store.progress(download.id, item.getReceivedBytes(), item.getTotalBytes())
      store.finish(download.id, state === 'completed' ? 'completed' : 'interrupted')
      this.changed()
    })
  }
}
