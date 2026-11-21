import { randomUUID } from 'node:crypto'
import type { HistoryEntry } from '@shared/model'
import type { Database } from '../store/database'

interface Row {
  id: string
  space_id: string
  url: string
  title: string
  visit_count: number
  last_visit: string
}

const toEntry = (row: Row): HistoryEntry => ({
  id: row.id,
  spaceId: row.space_id,
  url: row.url,
  title: row.title,
  visitCount: row.visit_count,
  lastVisit: row.last_visit,
})

const isWebUrl = (url: string): boolean => {
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

const ORDER = 'ORDER BY visit_count DESC, last_visit DESC, rowid DESC'

/**
 * The pages visited in each space. Personal data: it lives in the local database and is never
 * sent anywhere. One row per page (URL) per space, with a visit count.
 */
export class HistoryStore {
  constructor(private readonly db: Database) {}

  /** Notes a visit; anything but an http(s) page is ignored. */
  record(spaceId: string, url: string, title: string): void {
    if (!isWebUrl(url)) return
    this.db
      .prepare(
        `INSERT INTO history (id, space_id, url, title, visit_count, last_visit)
         VALUES (?, ?, ?, ?, 1, ?)
         ON CONFLICT(space_id, url) DO UPDATE SET
           visit_count = visit_count + 1, last_visit = excluded.last_visit,
           title = CASE WHEN excluded.title <> '' THEN excluded.title ELSE title END`,
      )
      .run(randomUUID(), spaceId, url, title, new Date().toISOString())
  }

  /** Sets the title of an already recorded page (titles arrive after the navigation). */
  setTitle(spaceId: string, url: string, title: string): void {
    this.db
      .prepare('UPDATE history SET title = ? WHERE space_id = ? AND url = ?')
      .run(title, spaceId, url)
  }

  frequent(spaceId: string, limit = 6): HistoryEntry[] {
    const rows = this.db
      .prepare(`SELECT * FROM history WHERE space_id = ? ${ORDER} LIMIT ?`)
      .all(spaceId, limit) as unknown as Row[]
    return rows.map(toEntry)
  }

  /** Pages of every space whose title or URL contains the query (case-insensitive). */
  search(query: string, limit = 8): HistoryEntry[] {
    if (!query.trim()) return []
    const needle = `%${query.replace(/[!%_]/g, '!$&')}%`
    const rows = this.db
      .prepare(
        `SELECT * FROM history WHERE title LIKE ? ESCAPE '!' OR url LIKE ? ESCAPE '!'
         ${ORDER} LIMIT ?`,
      )
      .all(needle, needle, limit) as unknown as Row[]
    return rows.map(toEntry)
  }

  forget(id: string): void {
    this.db.prepare('DELETE FROM history WHERE id = ?').run(id)
  }

  wipeSpace(spaceId: string): void {
    this.db.prepare('DELETE FROM history WHERE space_id = ?').run(spaceId)
  }
}
