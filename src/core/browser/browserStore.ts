// Browser model: spaces, tabs and folders, persisted in SQLite. Pure domain — main maps tabs to
// views. A space's tabs sit in three sections: favorites, pinned (top-level tabs and folders share
// one ordering, each folder orders its own tabs) and today (a tree: children follow their parent).
import { randomUUID } from 'node:crypto'
import type {
  BrowserFolder,
  BrowserSnapshot,
  BrowserSpace,
  BrowserTab,
  ClosedTab,
  TabSection,
} from '@shared/model'
import type { Database } from '../store/database'
import { UndoStack } from './undoStack'

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
  section: TabSection
  folder_id: string | null
  parent_id: string | null
}

interface FolderRow {
  id: string
  space_id: string
  name: string
  position: number
  collapsed: number
}

/** One ordered list of tabs: a section's top level (shared with folders in pinned), or a folder. */
interface ListKey {
  spaceId: string
  section: TabSection
  folderId: string | null
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
  section: r.section,
  folderId: r.folder_id,
  parentId: r.parent_id,
})

const toFolder = (r: FolderRow): BrowserFolder => ({
  id: r.id,
  spaceId: r.space_id,
  name: r.name,
  position: r.position,
  collapsed: r.collapsed !== 0,
})

const keyOf = (r: TabRow): ListKey => ({
  spaceId: r.space_id,
  section: r.section,
  folderId: r.folder_id,
})

const toClosed = (r: TabRow): ClosedTab => ({
  spaceId: r.space_id,
  url: r.url,
  title: r.title,
  section: r.section,
  folderId: r.folder_id,
  parentId: r.parent_id,
  position: r.position,
})

/** Ids of `tabs` (by position) in depth-first parent/child order; orphans are roots. */
function treeOrder(tabs: TabRow[]): string[] {
  const ids = new Set(tabs.map((t) => t.id))
  const children = new Map<string | null, TabRow[]>()
  for (const tab of tabs) {
    const parent = tab.parent_id !== null && ids.has(tab.parent_id) ? tab.parent_id : null
    children.set(parent, [...(children.get(parent) ?? []), tab])
  }
  const order: string[] = []
  const visit = (parent: string | null): void => {
    for (const child of children.get(parent) ?? []) {
      order.push(child.id)
      visit(child.id)
    }
  }
  visit(null)
  return order
}

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
  /** Closed tabs, in memory: a folder's tabs are one entry. */
  private readonly closed = new UndoStack<ClosedTab[]>()

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
      .prepare(
        `SELECT * FROM tabs ORDER BY space_id,
           CASE section WHEN 'favorites' THEN 0 WHEN 'pinned' THEN 1 ELSE 2 END,
           folder_id, position`,
      )
      .all() as unknown as TabRow[]
    const folderRows = this.db
      .prepare('SELECT * FROM folders ORDER BY space_id, position')
      .all() as unknown as FolderRow[]
    const activeTabIds: Record<string, string | null> = {}
    for (const s of spaceRows) activeTabIds[s.id] = s.active_tab_id
    return {
      spaces: spaceRows.map(toSpace),
      activeSpaceId: this.activeSpaceId(spaceRows),
      tabs: tabRows.map(toTab),
      folders: folderRows.map(toFolder),
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

  /**
   * Opens a today tab. With a today `parentId` it goes after the parent's last descendant; a
   * child of a pinned or favourite tab goes to the top of today. Otherwise it goes after the
   * active today tab's descendants, or at the end of today.
   */
  openTab(
    spaceId: string,
    url: string,
    options: { activate?: boolean; parentId?: string } = {},
  ): BrowserTab {
    const space = this.requireSpace(spaceId)
    const activate = options.activate ?? true
    const parent = options.parentId ? this.findTab(options.parentId) : undefined
    const opener = parent?.space_id === spaceId ? parent : undefined
    const active = space.active_tab_id ? this.findTab(space.active_tab_id) : undefined
    const today: ListKey = { spaceId, section: 'today', folderId: null }
    let position: number
    if (opener) {
      position = opener.section === 'today' ? this.lastDescendantPosition(opener) + 1 : 0
    } else if (active?.section === 'today') {
      position = this.lastDescendantPosition(active) + 1
    } else {
      position = this.listLength(today)
    }
    const parentId = opener?.section === 'today' ? opener.id : null
    const id = randomUUID()
    this.transaction(() => {
      this.shift(today, position, 1)
      this.db
        .prepare(
          `INSERT INTO tabs (id, space_id, url, title, favicon_url, position, created_at, section,
             folder_id, parent_id)
           VALUES (?, ?, ?, '', NULL, ?, ?, 'today', NULL, ?)`,
        )
        .run(id, spaceId, url, position, new Date().toISOString(), parentId)
      if (activate) {
        this.db.prepare('UPDATE spaces SET active_tab_id = ? WHERE id = ?').run(id, spaceId)
      }
    })
    this.emit()
    return toTab(this.requireTab(id))
  }

  /**
   * Closes a tab as the user's close does: a favourite or pinned tab is only unloaded (its entry
   * stays; main destroys its view), a today tab is deleted and can be reopened.
   */
  closeTab(id: string): 'deleted' | 'unloaded' {
    const tab = this.requireTab(id)
    if (tab.section === 'today') {
      this.removeTab(id)
      return 'deleted'
    }
    const space = this.requireSpace(tab.space_id)
    if (space.active_tab_id === id) {
      this.setActiveTab(tab.space_id, this.nextActive(tab.space_id, id, new Set([id])))
    }
    this.emit()
    return 'unloaded'
  }

  /** Deletes a tab whatever its section; its children move up to its parent. Reopenable. */
  removeTab(id: string): void {
    const tab = this.requireTab(id)
    this.transaction(() => {
      const space = this.requireSpace(tab.space_id)
      const next =
        space.active_tab_id === id
          ? this.nextActive(tab.space_id, id, new Set([id]))
          : space.active_tab_id
      this.db.prepare('DELETE FROM tabs WHERE id = ?').run(id)
      this.db.prepare('UPDATE tabs SET parent_id = ? WHERE parent_id = ?').run(tab.parent_id, id)
      this.shift(keyOf(tab), tab.position + 1, -1)
      this.setActiveTab(tab.space_id, next)
    })
    this.closed.push([toClosed(tab)])
    this.emit()
  }

  /**
   * Moves a tab to `index` of a list (a folder only in pinned), keeping both lists contiguous.
   * Leaving today drops its parent and hands its children to that parent.
   */
  moveTab(id: string, to: { section: TabSection; folderId?: string | null; index: number }): void {
    const tab = this.requireTab(id)
    const folderId = to.section === 'pinned' ? (to.folderId ?? null) : null
    if (folderId !== null && this.requireFolder(folderId).space_id !== tab.space_id) {
      throw new BrowserError('not_found', `Unknown folder in this space: ${folderId}`)
    }
    const source = keyOf(tab)
    const target: ListKey = { spaceId: tab.space_id, section: to.section, folderId }
    const sameList = source.section === target.section && source.folderId === target.folderId
    const leavesToday = tab.section === 'today' && to.section !== 'today'
    this.transaction(() => {
      // Out of every list while the others close up and make room.
      this.db.prepare('UPDATE tabs SET position = -1 WHERE id = ?').run(id)
      this.shift(source, tab.position + 1, -1)
      const length = this.listLength(target) - (sameList ? 1 : 0)
      const index = Math.max(0, Math.min(to.index, length))
      this.shift(target, index, 1)
      if (leavesToday) {
        this.db.prepare('UPDATE tabs SET parent_id = ? WHERE parent_id = ?').run(tab.parent_id, id)
      }
      this.db
        .prepare(
          'UPDATE tabs SET section = ?, folder_id = ?, position = ?, parent_id = ? WHERE id = ?',
        )
        .run(to.section, folderId, index, leavesToday ? null : tab.parent_id, id)
    })
    this.emit()
  }

  /** A new folder at the end of the space's pinned section. */
  createFolder(spaceId: string, name: string): BrowserFolder {
    this.requireSpace(spaceId)
    const position = this.listLength({ spaceId, section: 'pinned', folderId: null })
    const id = randomUUID()
    this.db
      .prepare(
        'INSERT INTO folders (id, space_id, name, position, collapsed, created_at) VALUES (?, ?, ?, ?, 0, ?)',
      )
      .run(id, spaceId, name, position, new Date().toISOString())
    this.emit()
    return { id, spaceId, name, position, collapsed: false }
  }

  renameFolder(id: string, name: string): void {
    this.requireFolder(id)
    this.db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(name, id)
    this.emit()
  }

  setFolderCollapsed(id: string, collapsed: boolean): void {
    this.requireFolder(id)
    this.db.prepare('UPDATE folders SET collapsed = ? WHERE id = ?').run(collapsed ? 1 : 0, id)
    this.emit()
  }

  /** Deletes a folder and its tabs; the tabs are reopenable together. */
  deleteFolder(id: string): void {
    const folder = this.requireFolder(id)
    const tabs = this.db
      .prepare('SELECT * FROM tabs WHERE folder_id = ? ORDER BY position')
      .all(id) as unknown as TabRow[]
    const removed = new Set(tabs.map((t) => t.id))
    this.transaction(() => {
      const space = this.requireSpace(folder.space_id)
      const active = space.active_tab_id
      const next =
        active !== null && removed.has(active)
          ? this.nextActive(folder.space_id, active, removed)
          : active
      this.db.prepare('DELETE FROM tabs WHERE folder_id = ?').run(id)
      this.db.prepare('DELETE FROM folders WHERE id = ?').run(id)
      this.shift(
        { spaceId: folder.space_id, section: 'pinned', folderId: null },
        folder.position + 1,
        -1,
      )
      this.setActiveTab(folder.space_id, next)
    })
    if (tabs.length > 0) this.closed.push(tabs.map(toClosed))
    this.emit()
  }

  /**
   * Reopens the last closed tab (or folder's tabs) where it was when its space and folder still
   * exist, else at the end of the active space's today. Activates the (first) reopened tab.
   */
  reopenClosed(): BrowserTab | null {
    const entry = this.closed.pop()
    if (!entry || entry.length === 0) return null
    let first: TabRow | undefined
    this.transaction(() => {
      for (const closed of entry) {
        const tab = this.restore(closed)
        first ??= tab
      }
      if (first) {
        this.setActiveTab(first.space_id, first.id)
        this.setActiveSpace(first.space_id)
      }
    })
    this.emit()
    return first ? toTab(first) : null
  }

  /**
   * Tab ids of a space in drawn order: favourites, pinned (folders and top-level tabs by their
   * shared position, each folder's tabs in order), then today depth-first by parent.
   */
  visibleOrder(spaceId: string): string[] {
    const tabs = this.db
      .prepare('SELECT * FROM tabs WHERE space_id = ? ORDER BY position')
      .all(spaceId) as unknown as TabRow[]
    const folders = this.db
      .prepare('SELECT * FROM folders WHERE space_id = ? ORDER BY position')
      .all(spaceId) as unknown as FolderRow[]
    const favorites = tabs.filter((t) => t.section === 'favorites').map((t) => t.id)
    const pinned = tabs.filter((t) => t.section === 'pinned')
    const folderIds = new Set(folders.map((f) => f.id))
    const pinnedItems = [
      ...folders.map((f) => ({
        position: f.position,
        ids: pinned.filter((t) => t.folder_id === f.id).map((t) => t.id),
      })),
      ...pinned
        .filter((t) => t.folder_id === null || !folderIds.has(t.folder_id))
        .map((t) => ({ position: t.position, ids: [t.id] })),
    ].sort((a, b) => a.position - b.position)
    const today = treeOrder(tabs.filter((t) => t.section === 'today'))
    return [...favorites, ...pinnedItems.flatMap((item) => item.ids), ...today]
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

  private activeSpaceId(spaceRows: SpaceRow[]): string {
    const stored = this.db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(ACTIVE_SPACE_KEY) as { value: string } | undefined
    const id = stored ? (JSON.parse(stored.value) as string) : ''
    return spaceRows.some((s) => s.id === id) ? id : (spaceRows[0]?.id ?? '')
  }

  private setActiveSpace(id: string): void {
    this.db
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .run(ACTIVE_SPACE_KEY, JSON.stringify(id))
  }

  private setActiveTab(spaceId: string, tabId: string | null): void {
    this.db.prepare('UPDATE spaces SET active_tab_id = ? WHERE id = ?').run(tabId, spaceId)
  }

  /** The tab after `anchor` in visible order that is not `removed`, else the one before, else null. */
  private nextActive(spaceId: string, anchor: string, removed: Set<string>): string | null {
    const order = this.visibleOrder(spaceId)
    const index = order.indexOf(anchor)
    const after = order.slice(index + 1).find((id) => !removed.has(id))
    const before = order
      .slice(0, Math.max(index, 0))
      .reverse()
      .find((id) => !removed.has(id))
    return after ?? before ?? null
  }

  /** Position of the last tab of `tab`'s today subtree (`tab`'s own when it has no children). */
  private lastDescendantPosition(tab: TabRow): number {
    const today = this.db
      .prepare("SELECT * FROM tabs WHERE space_id = ? AND section = 'today'")
      .all(tab.space_id) as unknown as TabRow[]
    const subtree = new Set([tab.id])
    let last = tab.position
    for (let grew = true; grew;) {
      grew = false
      for (const t of today) {
        if (t.parent_id !== null && subtree.has(t.parent_id) && !subtree.has(t.id)) {
          subtree.add(t.id)
          last = Math.max(last, t.position)
          grew = true
        }
      }
    }
    return last
  }

  /** Puts a closed tab back (see reopenClosed) and returns its new row. */
  private restore(closed: ClosedTab): TabRow {
    const spaceExists = this.findSpace(closed.spaceId) !== undefined
    const folder = closed.folderId ? this.findFolder(closed.folderId) : undefined
    const inPlace = spaceExists && (closed.folderId === null || folder?.space_id === closed.spaceId)
    let key: ListKey
    let position: number
    let parentId: string | null = null
    if (inPlace) {
      key = { spaceId: closed.spaceId, section: closed.section, folderId: closed.folderId }
      position = Math.min(closed.position, this.listLength(key))
      const parent = closed.parentId ? this.findTab(closed.parentId) : undefined
      if (parent?.space_id === closed.spaceId && parent.section === 'today') parentId = parent.id
    } else {
      const spaceId = this.activeSpaceId(
        this.db.prepare('SELECT * FROM spaces ORDER BY position').all() as unknown as SpaceRow[],
      )
      key = { spaceId, section: 'today', folderId: null }
      position = this.listLength(key)
    }
    const id = randomUUID()
    this.shift(key, position, 1)
    this.db
      .prepare(
        `INSERT INTO tabs (id, space_id, url, title, favicon_url, position, created_at, section,
           folder_id, parent_id)
         VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        key.spaceId,
        closed.url,
        closed.title,
        position,
        new Date().toISOString(),
        key.section,
        key.folderId,
        parentId,
      )
    return this.requireTab(id)
  }

  /** Number of entries in a list; pinned's top level counts its folders too. */
  private listLength(key: ListKey): number {
    const tabs = (
      this.db
        .prepare(
          'SELECT COUNT(*) AS n FROM tabs WHERE space_id = ? AND section = ? AND folder_id IS ?',
        )
        .get(key.spaceId, key.section, key.folderId) as { n: number }
    ).n
    if (key.section !== 'pinned' || key.folderId !== null) return tabs
    const folders = (
      this.db.prepare('SELECT COUNT(*) AS n FROM folders WHERE space_id = ?').get(key.spaceId) as {
        n: number
      }
    ).n
    return tabs + folders
  }

  /** Adds `delta` to the position of every entry of a list from position `from` on. */
  private shift(key: ListKey, from: number, delta: number): void {
    this.db
      .prepare(
        `UPDATE tabs SET position = position + ?
         WHERE space_id = ? AND section = ? AND folder_id IS ? AND position >= ?`,
      )
      .run(delta, key.spaceId, key.section, key.folderId, from)
    if (key.section === 'pinned' && key.folderId === null) {
      this.db
        .prepare('UPDATE folders SET position = position + ? WHERE space_id = ? AND position >= ?')
        .run(delta, key.spaceId, from)
    }
  }

  private findSpace(id: string): SpaceRow | undefined {
    return this.db.prepare('SELECT * FROM spaces WHERE id = ?').get(id) as unknown as
      SpaceRow | undefined
  }

  private findTab(id: string): TabRow | undefined {
    return this.db.prepare('SELECT * FROM tabs WHERE id = ?').get(id) as unknown as
      TabRow | undefined
  }

  private findFolder(id: string): FolderRow | undefined {
    return this.db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as unknown as
      FolderRow | undefined
  }

  private requireSpace(id: string): SpaceRow {
    const row = this.findSpace(id)
    if (!row) throw new BrowserError('not_found', `Unknown space: ${id}`)
    return row
  }

  private requireTab(id: string): TabRow {
    const row = this.findTab(id)
    if (!row) throw new BrowserError('not_found', `Unknown tab: ${id}`)
    return row
  }

  private requireFolder(id: string): FolderRow {
    const row = this.findFolder(id)
    if (!row) throw new BrowserError('not_found', `Unknown folder: ${id}`)
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
