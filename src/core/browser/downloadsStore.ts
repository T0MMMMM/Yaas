import { randomUUID } from 'node:crypto'
import type { Download, DownloadState } from '@shared/model'
import type { Database } from '../store/database'

interface Row {
  id: string
  url: string
  path: string
  filename: string
  total_bytes: number
  received_bytes: number
  state: string
  started_at: string
}

const toDownload = (row: Row): Download => ({
  id: row.id,
  url: row.url,
  path: row.path,
  filename: row.filename,
  totalBytes: row.total_bytes,
  receivedBytes: row.received_bytes,
  state: row.state as DownloadState,
  startedAt: row.started_at,
})

/**
 * The downloads of every space, newest first. Personal data: it lives in the local database and is
 * never sent anywhere. Clearing forgets the rows, never the files.
 */
export class DownloadsStore {
  constructor(private readonly db: Database) {
    // The app quit (or crashed) mid-download: nothing is writing those files any more.
    db.prepare("UPDATE downloads SET state = 'interrupted' WHERE state = 'progressing'").run()
  }

  start(d: { url: string; path: string; filename: string; totalBytes: number }): Download {
    const download: Download = {
      id: randomUUID(),
      ...d,
      receivedBytes: 0,
      state: 'progressing',
      startedAt: new Date().toISOString(),
    }
    this.db
      .prepare(
        `INSERT INTO downloads
           (id, url, path, filename, total_bytes, received_bytes, state, started_at)
         VALUES (?, ?, ?, ?, ?, 0, 'progressing', ?)`,
      )
      .run(download.id, d.url, d.path, d.filename, d.totalBytes, download.startedAt)
    return download
  }

  progress(id: string, receivedBytes: number, totalBytes: number): void {
    this.db
      .prepare('UPDATE downloads SET received_bytes = ?, total_bytes = ? WHERE id = ?')
      .run(receivedBytes, totalBytes, id)
  }

  finish(id: string, state: Exclude<DownloadState, 'progressing'>): void {
    this.db.prepare('UPDATE downloads SET state = ? WHERE id = ?').run(state, id)
  }

  get(id: string): Download | null {
    const row = this.db.prepare('SELECT * FROM downloads WHERE id = ?').get(id) as unknown as
      Row | undefined
    return row ? toDownload(row) : null
  }

  list(): Download[] {
    const rows = this.db
      .prepare('SELECT * FROM downloads ORDER BY started_at DESC, rowid DESC')
      .all() as unknown as Row[]
    return rows.map(toDownload)
  }

  /** Forgets the finished downloads; one still progressing stays. */
  clear(): void {
    this.db.prepare("DELETE FROM downloads WHERE state <> 'progressing'").run()
  }
}
