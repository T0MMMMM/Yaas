// Browser model: spaces and tabs, persisted in SQLite. Pure domain — main maps tabs to views.
import { randomUUID } from 'node:crypto'
import type { BrowserSnapshot, BrowserSpace, BrowserTab } from '@shared/model'
import type { Database } from '../store/database'

interface SpaceRow {
  id: string
  name: string
  color: string
  position: number
  active_tab_id: string | null
}

interface TabRow {
  id: string
  space_id: string
  url: string
  title: string
  favicon_url: string | null
  position: number
}

const toSpace = (r: SpaceRow): BrowserSpace => ({
  id: r.id,
  name: r.name,
  color: r.color,
  position: r.position,
})

const toTab = (r: TabRow): BrowserTab => ({
  id: r.id,
  spaceId: r.space_id,
  url: r.url,
  title: r.title,
  faviconUrl: r.favicon_url,
  position: r.position,
})

export class BrowserError extends Error {
  constructor(
    readonly code: 'not_found',
    message: string,
  ) {
    super(message)
  }
}

export interface BrowserStoreOptions {
  defaultSpace: { name: string; color: string }
}

type Listener = (snapshot: BrowserSnapshot) => void

const ACTIVE_SPACE_KEY = 'browser.activeSpace'

export class BrowserStore {
  private readonly listeners = new Set<Listener>()

  constructor(
    private readonly db: Database,
    options: BrowserStoreOptions,
  ) {
    const count = (this.db.prepare('SELECT COUNT(*) AS n FROM spaces').get() as { n: number }).n
    if (count === 0) {
      const space = this.insertSpace(options.defaultSpace.name, options.defaultSpace.color)
      this.setActiveSpace(space.id)
    }
  }

  snapshot(): BrowserSnapshot {
    const spaceRows = this.db
      .prepare('SELECT * FROM spaces ORDER BY position')
      .all() as unknown as SpaceRow[]
    const tabRows = this.db
      .prepare('SELECT * FROM tabs ORDER BY space_id, position')
      .all() as unknown as TabRow[]
    const stored = this.db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(ACTIVE_SPACE_KEY) as { value: string } | undefined
    let activeSpaceId = stored ? (JSON.parse(stored.value) as string) : ''
    if (!spaceRows.some((s) => s.id === activeSpaceId)) activeSpaceId = spaceRows[0]?.id ?? ''
    const activeTabIds: Record<string, string | null> = {}
    for (const s of spaceRows) activeTabIds[s.id] = s.active_tab_id
    return {
      spaces: spaceRows.map(toSpace),
      activeSpaceId,
      tabs: tabRows.map(toTab),
      activeTabIds,
    }
  }

  createSpace(name: string, color: string): BrowserSpace {
    const space = this.insertSpace(name, color)
    this.setActiveSpace(space.id)
    this.emit()
    return space
  }

  activateSpace(id: string): void {
    this.requireSpace(id)
    this.setActiveSpace(id)
    this.emit()
  }

  openTab(spaceId: string, url: string, options: { activate?: boolean } = {}): BrowserTab {
    const space = this.requireSpace(spaceId)
    const activate = options.activate ?? true
    const active = space.active_tab_id
      ? (this.db.prepare('SELECT position FROM tabs WHERE id = ?').get(space.active_tab_id) as
          { position: number } | undefined)
      : undefined
    const position =
      active?.position !== undefined
        ? active.position + 1
        : (
            this.db.prepare('SELECT COUNT(*) AS n FROM tabs WHERE space_id = ?').get(spaceId) as {
              n: number
            }
          ).n
    const id = randomUUID()
    this.transaction(() => {
      this.db
        .prepare('UPDATE tabs SET position = position + 1 WHERE space_id = ? AND position >= ?')
        .run(spaceId, position)
      this.db
        .prepare(
          `INSERT INTO tabs (id, space_id, url, title, favicon_url, position, created_at)
           VALUES (?, ?, ?, '', NULL, ?, ?)`,
        )
        .run(id, spaceId, url, position, new Date().toISOString())
      if (activate) {
        this.db.prepare('UPDATE spaces SET active_tab_id = ? WHERE id = ?').run(id, spaceId)
      }
    })
    this.emit()
    return { id, spaceId, url, title: '', faviconUrl: null, position }
  }

  closeTab(id: string): void {
    const tab = this.requireTab(id)
    this.transaction(() => {
      this.db.prepare('DELETE FROM tabs WHERE id = ?').run(id)
      this.db
        .prepare('UPDATE tabs SET position = position - 1 WHERE space_id = ? AND position > ?')
        .run(tab.space_id, tab.position)
      const space = this.requireSpace(tab.space_id)
      if (space.active_tab_id === id) {
        // The tab that slid into the freed slot is the one below; else the one above.
        const next = (
          this.db
            .prepare(
              'SELECT id FROM tabs WHERE space_id = ? AND position IN (?, ?) ORDER BY position DESC',
            )
            .all(tab.space_id, tab.position, tab.position - 1) as { id: string }[]
        )[0]
        this.db
          .prepare('UPDATE spaces SET active_tab_id = ? WHERE id = ?')
          .run(next?.id ?? null, tab.space_id)
      }
    })
    this.emit()
  }

  activateTab(id: string): void {
    const tab = this.requireTab(id)
    this.transaction(() => {
      this.db.prepare('UPDATE spaces SET active_tab_id = ? WHERE id = ?').run(id, tab.space_id)
      this.setActiveSpace(tab.space_id)
    })
    this.emit()
  }

  updateTab(id: string, patch: Partial<Pick<BrowserTab, 'url' | 'title' | 'faviconUrl'>>): void {
    const tab = this.requireTab(id)
    this.db
      .prepare('UPDATE tabs SET url = ?, title = ?, favicon_url = ? WHERE id = ?')
      .run(
        patch.url ?? tab.url,
        patch.title ?? tab.title,
        patch.faviconUrl === undefined ? tab.favicon_url : patch.faviconUrl,
        id,
      )
    this.emit()
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private insertSpace(name: string, color: string): BrowserSpace {
    const position = (
      this.db.prepare('SELECT COALESCE(MAX(position) + 1, 0) AS next FROM spaces').get() as {
        next: number
      }
    ).next
    const id = randomUUID()
    this.db
      .prepare(
        'INSERT INTO spaces (id, name, color, position, active_tab_id, created_at) VALUES (?, ?, ?, ?, NULL, ?)',
      )
      .run(id, name, color, position, new Date().toISOString())
    return { id, name, color, position }
  }

  private setActiveSpace(id: string): void {
    this.db
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .run(ACTIVE_SPACE_KEY, JSON.stringify(id))
  }

  private requireSpace(id: string): SpaceRow {
    const row = this.db.prepare('SELECT * FROM spaces WHERE id = ?').get(id) as unknown as
      SpaceRow | undefined
    if (!row) throw new BrowserError('not_found', `Unknown space: ${id}`)
    return row
  }

  private requireTab(id: string): TabRow {
    const row = this.db.prepare('SELECT * FROM tabs WHERE id = ?').get(id) as unknown as
      TabRow | undefined
    if (!row) throw new BrowserError('not_found', `Unknown tab: ${id}`)
    return row
  }

  private transaction(work: () => void): void {
    this.db.exec('BEGIN')
    try {
      work()
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  private emit(): void {
    if (this.listeners.size === 0) return
    const snapshot = this.snapshot()
    for (const listener of this.listeners) listener(snapshot)
  }
}
