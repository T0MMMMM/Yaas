// Browser model: spaces, tabs and folders, persisted in SQLite. Pure domain — main maps tabs to
// views. A space's tabs sit in three sections: favorites, pinned (a tree of folders: the tabs and
// child folders of one parent — the top level or a folder — share one ordering) and today (a tree:
// children follow their parent).
import { randomUUID } from 'node:crypto'
import type {
  BrowserFolder,
  BrowserSnapshot,
  BrowserSpace,
  BrowserTab,
  ClosedEntry,
  ClosedFolder,
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
  icon: string | null
  section_collapsed: number
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
  last_active_at: string | null
  split_of: string | null
  split_ratio: number | null
}

interface FolderRow {
  id: string
  space_id: string
  name: string
  position: number
  collapsed: number
  parent_id: string | null
  icon: string | null
}

/**
 * One ordered list: a section's top level, or a folder. In pinned, a list's tabs share their
 * ordering with the folders whose parent it is.
 */
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
  icon: r.icon,
  sectionCollapsed: r.section_collapsed !== 0,
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
  lastActiveAt: r.last_active_at,
  splitOf: r.split_of,
  splitRatio: r.split_ratio,
})

const toFolder = (r: FolderRow): BrowserFolder => ({
  id: r.id,
  spaceId: r.space_id,
  name: r.name,
  position: r.position,
  collapsed: r.collapsed !== 0,
  parentId: r.parent_id,
  icon: r.icon,
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

const toClosedFolder = (r: FolderRow): ClosedFolder => ({
  id: r.id,
  spaceId: r.space_id,
  name: r.name,
  parentId: r.parent_id,
  position: r.position,
  collapsed: r.collapsed !== 0,
  icon: r.icon,
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
    readonly code: 'not_found' | 'invalid_move' | 'last_space',
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
  /** Closed tabs, in memory: a deleted folder's subtree is one entry. */
  private readonly closed = new UndoStack<ClosedEntry>()

  constructor(
    private readonly db: Database,
    options: BrowserStoreOptions,
  ) {
    const count = (this.db.prepare('SELECT COUNT(*) AS n FROM spaces').get() as { n: number }).n
    if (count === 0) {
      const space = this.insertSpace(options.defaultSpace.name, options.defaultSpace.color)
      this.setActiveSpace(space.id)
    }
    this.repairSplits()
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
      .prepare(
        `SELECT * FROM folders
         ORDER BY space_id, parent_id IS NOT NULL, parent_id, position`,
      )
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

  renameSpace(id: string, name: string): void {
    this.requireSpace(id)
    this.db.prepare('UPDATE spaces SET name = ? WHERE id = ?').run(name, id)
    this.emit()
  }

  setSpaceIcon(id: string, icon: string | null): void {
    this.requireSpace(id)
    this.db.prepare('UPDATE spaces SET icon = ? WHERE id = ?').run(icon, id)
    this.emit()
  }

  setSpaceColor(id: string, color: string): void {
    this.requireSpace(id)
    this.db.prepare('UPDATE spaces SET color = ? WHERE id = ?').run(color, id)
    this.emit()
  }

  setSpaceSectionCollapsed(id: string, collapsed: boolean): void {
    this.requireSpace(id)
    this.db
      .prepare('UPDATE spaces SET section_collapsed = ? WHERE id = ?')
      .run(collapsed ? 1 : 0, id)
    this.emit()
  }

  /**
   * Deletes a space with its tabs and folders (cascade). Not reopenable: the tabs and folders
   * closed earlier in it are forgotten too, so ⌘⇧T never brings them back elsewhere. When it was
   * the active space the next one by position becomes active, else the previous one. The last
   * space stays (`last_space`).
   */
  deleteSpace(id: string): void {
    this.requireSpace(id)
    const rows = this.spaceRows()
    if (rows.length <= 1) throw new BrowserError('last_space', "The last space can't be deleted")
    const index = rows.findIndex((r) => r.id === id)
    const wasActive = this.activeSpaceId(rows) === id
    const successor = rows[index + 1] ?? rows[index - 1]
    this.transaction(() => {
      this.db.prepare('DELETE FROM spaces WHERE id = ?').run(id)
      if (wasActive && successor) this.setActiveSpace(successor.id)
    })
    this.closed.rewrite((entry) => {
      const tabs = entry.tabs.filter((t) => t.spaceId !== id)
      const folders = entry.folders.filter((f) => f.spaceId !== id)
      return tabs.length > 0 || folders.length > 0 ? { tabs, folders } : null
    })
    this.emit()
  }

  /**
   * Opens a today tab. With a today `parentId` it goes after the parent's last descendant; a
   * child of a pinned or favourite tab goes to the top of today. Otherwise it is a top-level tab
   * right after the subtree of the active today tab's top-level ancestor, or at the end of today.
   * Today's positions always follow its drawn (depth-first) order.
   */
  openTab(
    spaceId: string,
    url: string,
    options: { activate?: boolean; parentId?: string } = {},
  ): BrowserTab {
    const space = this.requireSpace(spaceId)
    const activate = options.activate ?? true
    const parent = options.parentId ? this.findTab(options.parentId) : undefined
    const opener = parent?.space_id === spaceId ? this.firstOf(parent) : undefined
    const found = space.active_tab_id ? this.findTab(space.active_tab_id) : undefined
    const active = found ? this.firstOf(found) : undefined
    const today: ListKey = { spaceId, section: 'today', folderId: null }
    let position: number
    if (opener) {
      position = opener.section === 'today' ? this.lastDescendantPosition(opener) + 1 : 0
    } else if (active?.section === 'today') {
      position = this.lastDescendantPosition(this.topLevelAncestor(active)) + 1
    } else {
      position = this.listLength(today)
    }
    const parentId = opener?.section === 'today' ? opener.id : null
    const id = randomUUID()
    const now = new Date().toISOString()
    this.transaction(() => {
      this.shift(today, position, 1)
      this.db
        .prepare(
          `INSERT INTO tabs (id, space_id, url, title, favicon_url, position, created_at, section,
             folder_id, parent_id, last_active_at)
           VALUES (?, ?, ?, '', NULL, ?, ?, 'today', NULL, ?, ?)`,
        )
        .run(id, spaceId, url, position, now, parentId, activate ? now : null)
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
    this.leaveSplit(id)
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
    this.leaveSplit(id)
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
    this.closed.push({ folders: [], tabs: [toClosed(tab)] })
    this.emit()
  }

  /**
   * Moves a tab to `index` of a list (a folder, at any depth, only in pinned), keeping both lists
   * contiguous.
   * Leaving today drops its parent and hands its children to that parent. Into today, see
   * moveIntoToday: `index` is in drawn order and the tab's subtree moves with it.
   */
  moveTab(id: string, to: { section: TabSection; folderId?: string | null; index: number }): void {
    const tab = this.firstOf(this.requireTab(id))
    if (to.section === 'today') {
      this.transaction(() => {
        this.moveIntoToday(tab, to.index)
        this.syncSecond(tab.id)
      })
      this.emit()
      return
    }
    const folderId = to.section === 'pinned' ? (to.folderId ?? null) : null
    if (folderId !== null) this.requireFolderIn(tab.space_id, folderId)
    const source = keyOf(tab)
    const target: ListKey = { spaceId: tab.space_id, section: to.section, folderId }
    const sameList = source.section === target.section && source.folderId === target.folderId
    const leavesToday = tab.section === 'today'
    this.transaction(() => {
      // Out of every list while the others close up and make room.
      this.db.prepare('UPDATE tabs SET position = -1 WHERE id = ?').run(tab.id)
      this.shift(source, tab.position + 1, -1)
      const length = this.listLength(target) - (sameList ? 1 : 0)
      const index = Math.max(0, Math.min(to.index, length))
      this.shift(target, index, 1)
      if (leavesToday) {
        this.db
          .prepare('UPDATE tabs SET parent_id = ? WHERE parent_id = ?')
          .run(tab.parent_id, tab.id)
      }
      this.db
        .prepare(
          'UPDATE tabs SET section = ?, folder_id = ?, position = ?, parent_id = ? WHERE id = ?',
        )
        .run(to.section, folderId, index, leavesToday ? null : tab.parent_id, tab.id)
      this.syncSecond(tab.id)
    })
    this.emit()
  }

  /** A new folder at the end of its parent's list: the space's pinned top level, or `parentId`. */
  createFolder(spaceId: string, name: string, parentId: string | null = null): BrowserFolder {
    this.requireSpace(spaceId)
    if (parentId !== null) this.requireFolderIn(spaceId, parentId)
    const position = this.listLength({ spaceId, section: 'pinned', folderId: parentId })
    const id = randomUUID()
    this.db
      .prepare(
        `INSERT INTO folders (id, space_id, name, position, collapsed, created_at, parent_id, icon)
         VALUES (?, ?, ?, ?, 0, ?, ?, NULL)`,
      )
      .run(id, spaceId, name, position, new Date().toISOString(), parentId)
    this.emit()
    return toFolder(this.requireFolder(id))
  }

  /**
   * Moves a folder, with its subtree, to `index` of pinned's top level (`parentId` null) or of
   * another folder of its space, keeping both lists contiguous. A folder can't move into itself
   * or one of its descendants (`invalid_move`).
   */
  moveFolder(id: string, to: { parentId: string | null; index: number }): void {
    const folder = this.requireFolder(id)
    if (to.parentId !== null) {
      this.requireFolderIn(folder.space_id, to.parentId)
      if (this.folderSubtree(folder).some((f) => f.id === to.parentId)) {
        throw new BrowserError('invalid_move', `A folder can't move into itself: ${id}`)
      }
    }
    const source: ListKey = {
      spaceId: folder.space_id,
      section: 'pinned',
      folderId: folder.parent_id,
    }
    const target: ListKey = { spaceId: folder.space_id, section: 'pinned', folderId: to.parentId }
    const sameList = folder.parent_id === to.parentId
    this.transaction(() => {
      // Out of every list while the others close up and make room.
      this.db.prepare('UPDATE folders SET position = -1 WHERE id = ?').run(id)
      this.shift(source, folder.position + 1, -1)
      const length = this.listLength(target) - (sameList ? 1 : 0)
      const index = Math.max(0, Math.min(to.index, length))
      this.shift(target, index, 1)
      this.db
        .prepare('UPDATE folders SET parent_id = ?, position = ? WHERE id = ?')
        .run(to.parentId, index, id)
    })
    this.emit()
  }

  renameFolder(id: string, name: string): void {
    this.requireFolder(id)
    this.db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(name, id)
    this.emit()
  }

  /** `hue:<deg>` or an emoji; null goes back to the glyph in the name's hue. */
  setFolderIcon(id: string, icon: string | null): void {
    this.requireFolder(id)
    this.db.prepare('UPDATE folders SET icon = ? WHERE id = ?').run(icon, id)
    this.emit()
  }

  setFolderCollapsed(id: string, collapsed: boolean): void {
    this.requireFolder(id)
    this.db.prepare('UPDATE folders SET collapsed = ? WHERE id = ?').run(collapsed ? 1 : 0, id)
    this.emit()
  }

  /**
   * Deletes a folder with its child folders and all their tabs. When it held tabs, the whole
   * subtree is one reopenable entry.
   */
  deleteFolder(id: string): void {
    const folder = this.requireFolder(id)
    const folders = this.folderSubtree(folder)
    const folderIds = new Set(folders.map((f) => f.id))
    // A split inside comes back from reopenClosed as two normal tabs.
    this.transaction(() => {
      for (const second of this.secondRows(folder.space_id)) {
        if (second.folder_id === null || !folderIds.has(second.folder_id)) continue
        const first = this.findTab(second.split_of ?? '')
        if (first) this.unpair(first, second, false)
      }
    })
    const tabs = (
      this.db
        .prepare("SELECT * FROM tabs WHERE space_id = ? AND section = 'pinned' ORDER BY position")
        .all(folder.space_id) as unknown as TabRow[]
    ).filter((t) => t.folder_id !== null && folderIds.has(t.folder_id))
    const removed = new Set(tabs.map((t) => t.id))
    this.transaction(() => {
      const space = this.requireSpace(folder.space_id)
      const active = space.active_tab_id
      const next =
        active !== null && removed.has(active)
          ? this.nextActive(folder.space_id, active, removed)
          : active
      const deleteTab = this.db.prepare('DELETE FROM tabs WHERE id = ?')
      for (const tab of tabs) deleteTab.run(tab.id)
      // Children first, so no row is left pointing at a deleted parent.
      const deleteFolder = this.db.prepare('DELETE FROM folders WHERE id = ?')
      for (const f of [...folders].reverse()) deleteFolder.run(f.id)
      this.shift(
        { spaceId: folder.space_id, section: 'pinned', folderId: folder.parent_id },
        folder.position + 1,
        -1,
      )
      this.setActiveTab(folder.space_id, next)
    })
    if (tabs.length > 0) {
      this.closed.push({ folders: folders.map(toClosedFolder), tabs: tabs.map(toClosed) })
    }
    this.emit()
  }

  /**
   * Reopens the last closed tab, or deleted folder with its subtree, where it was: a folder goes
   * back with its id (at the top level when its parent is gone, not at all when its space is),
   * then each tab goes back in place when its space and folder exist, else at the end of the
   * active space's today. Activates the (first) reopened tab.
   */
  reopenClosed(): BrowserTab | null {
    const entry = this.closed.pop()
    if (!entry || entry.tabs.length === 0) return null
    let first: TabRow | undefined
    this.transaction(() => {
      // Parents before children, then tabs, each list in position order: all land where they were.
      for (const closed of entry.folders) this.restoreFolder(closed)
      for (const closed of [...entry.tabs].sort((a, b) => a.position - b.position)) {
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
   * Tab ids of a space in drawn order: favourites, pinned (each list's folders and tabs by their
   * shared position, a folder's list in its place, depth-first), then today depth-first by parent.
   */
  visibleOrder(spaceId: string): string[] {
    const tabs = this.db
      .prepare('SELECT * FROM tabs WHERE space_id = ? AND split_of IS NULL ORDER BY position')
      .all(spaceId) as unknown as TabRow[]
    const folders = this.db
      .prepare('SELECT * FROM folders WHERE space_id = ? ORDER BY position')
      .all(spaceId) as unknown as FolderRow[]
    const favorites = tabs.filter((t) => t.section === 'favorites').map((t) => t.id)
    const pinned = tabs.filter((t) => t.section === 'pinned')
    const folderIds = new Set(folders.map((f) => f.id))
    // A row whose folder is unknown belongs to the top level.
    const parentOf = (id: string | null): string | null =>
      id !== null && folderIds.has(id) ? id : null
    const pinnedList = (parentId: string | null): string[] =>
      [
        ...folders
          .filter((f) => parentOf(f.parent_id) === parentId)
          .map((f) => ({ position: f.position, ids: () => pinnedList(f.id) })),
        ...pinned
          .filter((t) => parentOf(t.folder_id) === parentId)
          .map((t) => ({ position: t.position, ids: () => [t.id] })),
      ]
        .sort((a, b) => a.position - b.position)
        .flatMap((item) => item.ids())
    const today = treeOrder(tabs.filter((t) => t.section === 'today'))
    return [...favorites, ...pinnedList(null), ...today]
  }

  activateTab(id: string): void {
    const tab = this.requireTab(id)
    this.transaction(() => {
      this.db.prepare('UPDATE spaces SET active_tab_id = ? WHERE id = ?').run(id, tab.space_id)
      this.db
        .prepare('UPDATE tabs SET last_active_at = ? WHERE id = ?')
        .run(new Date().toISOString(), id)
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

  /**
   * Pairs two tabs of one space as a split: `secondId` leaves its list (its today children move
   * up to its parent) and mirrors the first's section, folder and parent. Neither may already be
   * in a split (`invalid_move`).
   */
  splitTabs(firstId: string, secondId: string): void {
    const first = this.requireTab(firstId)
    const second = this.requireTab(secondId)
    if (first.id === second.id || first.space_id !== second.space_id) {
      throw new BrowserError('invalid_move', 'A split needs two tabs of one space')
    }
    if (this.pairOf(first) || this.pairOf(second)) {
      throw new BrowserError('invalid_move', 'A tab can be in one split only')
    }
    this.transaction(() => {
      this.db
        .prepare('UPDATE tabs SET split_of = ?, position = -1 WHERE id = ?')
        .run(first.id, second.id)
      this.shift(keyOf(second), second.position + 1, -1)
      if (second.section === 'today') {
        this.db
          .prepare('UPDATE tabs SET parent_id = ? WHERE parent_id = ?')
          .run(second.parent_id, second.id)
      }
      this.db.prepare('UPDATE tabs SET split_ratio = NULL WHERE id = ?').run(first.id)
      this.syncSecond(first.id)
      this.renumberToday(first.space_id)
    })
    this.emit()
  }

  /** Ends the split `id` is a half of: the second goes right after the first, in its list. */
  separate(id: string): void {
    const pair = this.pairOf(this.requireTab(id))
    if (!pair) throw new BrowserError('invalid_move', `Not in a split: ${id}`)
    this.transaction(() => this.unpair(pair.first, pair.second, false))
    this.emit()
  }

  /** The first page's share of the width of the split `id` is a half of, clamped to 0.25–0.75. */
  setSplitRatio(id: string, ratio: number): void {
    const pair = this.pairOf(this.requireTab(id))
    if (!pair) throw new BrowserError('invalid_move', `Not in a split: ${id}`)
    const clamped = Math.min(0.75, Math.max(0.25, ratio))
    this.db.prepare('UPDATE tabs SET split_ratio = ? WHERE id = ?').run(clamped, pair.first.id)
    this.emit()
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private spaceRows(): SpaceRow[] {
    return this.db.prepare('SELECT * FROM spaces ORDER BY position').all() as unknown as SpaceRow[]
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
    return { id, name, color, position, icon: null, sectionCollapsed: false }
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
    // A second half stands where its first is.
    const index = order.indexOf(this.findTab(anchor)?.split_of ?? anchor)
    const after = order.slice(index + 1).find((id) => !removed.has(id))
    const before = order
      .slice(0, Math.max(index, 0))
      .reverse()
      .find((id) => !removed.has(id))
    return after ?? before ?? null
  }

  /** A space's today tabs, by position. */
  private todayRows(spaceId: string): TabRow[] {
    return this.db
      .prepare(
        "SELECT * FROM tabs WHERE space_id = ? AND section = 'today' AND split_of IS NULL ORDER BY position",
      )
      .all(spaceId) as unknown as TabRow[]
  }

  /** Ids of `tab` and its descendants among `today`. */
  private subtreeIds(tab: TabRow, today: TabRow[]): Set<string> {
    const subtree = new Set([tab.id])
    for (let grew = true; grew;) {
      grew = false
      for (const t of today) {
        if (t.parent_id !== null && subtree.has(t.parent_id) && !subtree.has(t.id)) {
          subtree.add(t.id)
          grew = true
        }
      }
    }
    return subtree
  }

  /** Position of the last tab of `tab`'s today subtree (`tab`'s own when it has no children). */
  private lastDescendantPosition(tab: TabRow): number {
    const today = this.todayRows(tab.space_id)
    const subtree = this.subtreeIds(tab, today)
    return Math.max(...today.filter((t) => subtree.has(t.id)).map((t) => t.position), tab.position)
  }

  /** The today tab at the root of `tab`'s branch (`tab` itself when it is top-level). */
  private topLevelAncestor(tab: TabRow): TabRow {
    const byId = new Map(this.todayRows(tab.space_id).map((t) => [t.id, t]))
    const seen = new Set([tab.id])
    let root = tab
    for (;;) {
      const parent = root.parent_id === null ? undefined : byId.get(root.parent_id)
      if (!parent || seen.has(parent.id)) return root
      seen.add(parent.id)
      root = parent
    }
  }

  /**
   * Moves `tab` and its today subtree to `index` of today's drawn order, counted without the
   * moved tabs. The tab becomes top-level (a child is un-nested); dropped inside another tab's
   * subtree, it goes after that subtree. Today is then renumbered in drawn order. Run inside a
   * transaction.
   */
  private moveIntoToday(tab: TabRow, index: number): void {
    const fromToday = tab.section === 'today'
    if (!fromToday) {
      this.db.prepare('UPDATE tabs SET position = -1 WHERE id = ?').run(tab.id)
      this.shift(keyOf(tab), tab.position + 1, -1)
    }
    const today = this.todayRows(tab.space_id)
    const block = fromToday ? this.subtreeIds(tab, today) : new Set([tab.id])
    const order = treeOrder(today)
    const moved = fromToday ? order.filter((id) => block.has(id)) : [tab.id]
    const rest = today.filter((t) => !block.has(t.id))
    const restIds = new Set(rest.map((t) => t.id))
    const restOrder = order.filter((id) => restIds.has(id))
    const byId = new Map(rest.map((t) => [t.id, t]))
    const isRoot = (id: string): boolean => {
      const parent = byId.get(id)?.parent_id ?? null
      return parent === null || !restIds.has(parent)
    }
    let at = Math.max(0, Math.min(index, restOrder.length))
    while (at < restOrder.length && !isRoot(restOrder[at] ?? '')) at++
    this.db
      .prepare("UPDATE tabs SET section = 'today', folder_id = NULL, parent_id = NULL WHERE id = ?")
      .run(tab.id)
    const update = this.db.prepare('UPDATE tabs SET position = ? WHERE id = ?')
    ;[...restOrder.slice(0, at), ...moved, ...restOrder.slice(at)].forEach((id, position) =>
      update.run(position, id),
    )
  }

  /** `folder` and its descendants, parents before children, each list in position order. */
  private folderSubtree(folder: FolderRow): FolderRow[] {
    const all = this.db
      .prepare('SELECT * FROM folders WHERE space_id = ? ORDER BY position')
      .all(folder.space_id) as unknown as FolderRow[]
    const subtree = [folder]
    const seen = new Set([folder.id])
    for (let i = 0; i < subtree.length; i++) {
      const parentId = subtree[i]?.id
      for (const f of all) {
        if (f.parent_id === parentId && !seen.has(f.id)) {
          seen.add(f.id)
          subtree.push(f)
        }
      }
    }
    return subtree
  }

  /** Puts a deleted folder back with its id (see reopenClosed); nothing when its space is gone. */
  private restoreFolder(closed: ClosedFolder): void {
    if (!this.findSpace(closed.spaceId) || this.findFolder(closed.id)) return
    const parent = closed.parentId ? this.findFolder(closed.parentId) : undefined
    const parentId = parent?.space_id === closed.spaceId ? parent.id : null
    const key: ListKey = { spaceId: closed.spaceId, section: 'pinned', folderId: parentId }
    const position = Math.min(closed.position, this.listLength(key))
    this.shift(key, position, 1)
    this.db
      .prepare(
        `INSERT INTO folders (id, space_id, name, position, collapsed, created_at, parent_id, icon)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        closed.id,
        closed.spaceId,
        closed.name,
        position,
        closed.collapsed ? 1 : 0,
        new Date().toISOString(),
        parentId,
        closed.icon,
      )
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

  /** Number of entries in a list; a pinned list counts its child folders too. */
  private listLength(key: ListKey): number {
    const tabs = (
      this.db
        .prepare(
          `SELECT COUNT(*) AS n FROM tabs
           WHERE space_id = ? AND section = ? AND folder_id IS ? AND split_of IS NULL`,
        )
        .get(key.spaceId, key.section, key.folderId) as { n: number }
    ).n
    if (key.section !== 'pinned') return tabs
    const folders = (
      this.db
        .prepare('SELECT COUNT(*) AS n FROM folders WHERE space_id = ? AND parent_id IS ?')
        .get(key.spaceId, key.folderId) as { n: number }
    ).n
    return tabs + folders
  }

  /** Adds `delta` to the position of every entry of a list from position `from` on. */
  private shift(key: ListKey, from: number, delta: number): void {
    this.db
      .prepare(
        `UPDATE tabs SET position = position + ?
         WHERE space_id = ? AND section = ? AND folder_id IS ? AND position >= ?
           AND split_of IS NULL`,
      )
      .run(delta, key.spaceId, key.section, key.folderId, from)
    if (key.section === 'pinned') {
      this.db
        .prepare(
          `UPDATE folders SET position = position + ?
           WHERE space_id = ? AND parent_id IS ? AND position >= ?`,
        )
        .run(delta, key.spaceId, key.folderId, from)
    }
  }

  /** The split `tab` is a half of, or undefined. */
  private pairOf(tab: TabRow): { first: TabRow; second: TabRow } | undefined {
    if (tab.split_of !== null) {
      const first = this.findTab(tab.split_of)
      return first ? { first, second: tab } : undefined
    }
    const second = this.db
      .prepare('SELECT * FROM tabs WHERE split_of = ?')
      .get(tab.id) as unknown as TabRow | undefined
    return second ? { first: tab, second } : undefined
  }

  /** The row standing for `tab` in its list: its split's first tab when it is a second half. */
  private firstOf(tab: TabRow): TabRow {
    return (tab.split_of !== null ? this.findTab(tab.split_of) : undefined) ?? tab
  }

  /** A space's second halves. */
  private secondRows(spaceId: string): TabRow[] {
    return this.db
      .prepare('SELECT * FROM tabs WHERE space_id = ? AND split_of IS NOT NULL')
      .all(spaceId) as unknown as TabRow[]
  }

  /** The second half of `firstId` (if any) takes its first's section, folder and parent. */
  private syncSecond(firstId: string): void {
    this.db
      .prepare(
        `UPDATE tabs SET (section, folder_id, parent_id) =
           (SELECT section, folder_id, parent_id FROM tabs WHERE id = ?)
         WHERE split_of = ?`,
      )
      .run(firstId, firstId)
  }

  /**
   * Puts `second` back in its first's list, right after it, or `before` it (where the row was,
   * when the first is about to close). Run inside a transaction.
   */
  private unpair(first: TabRow, second: TabRow, before: boolean): void {
    const position = before ? first.position : first.position + 1
    this.shift(keyOf(first), position, 1)
    this.db
      .prepare('UPDATE tabs SET split_of = NULL, position = ? WHERE id = ?')
      .run(position, second.id)
    this.db.prepare('UPDATE tabs SET split_ratio = NULL WHERE id = ?').run(first.id)
    this.renumberToday(first.space_id)
  }

  /**
   * Before `id` closes: when it is a half of a split, the split ends and the other half takes the
   * row's place (and becomes active when `id` was).
   */
  private leaveSplit(id: string): void {
    const tab = this.requireTab(id)
    const pair = this.pairOf(tab)
    if (!pair) return
    const other = pair.first.id === id ? pair.second : pair.first
    this.transaction(() => {
      this.unpair(pair.first, pair.second, pair.first.id === id)
      const space = this.requireSpace(tab.space_id)
      if (space.active_tab_id === id) this.setActiveTab(tab.space_id, other.id)
    })
  }

  /** Today's positions follow its drawn (depth-first) order again. Run inside a transaction. */
  private renumberToday(spaceId: string): void {
    const update = this.db.prepare('UPDATE tabs SET position = ? WHERE id = ?')
    treeOrder(this.todayRows(spaceId)).forEach((id, position) => update.run(position, id))
  }

  /**
   * A second half whose first is gone, in another space, itself a second half or already paired,
   * and a tab left out of its list (position -1) without a split, go back to the end of their
   * list as normal tabs.
   */
  private repairSplits(): void {
    const broken = this.db
      .prepare(
        `SELECT t.* FROM tabs t LEFT JOIN tabs f ON f.id = t.split_of
         WHERE (t.split_of IS NOT NULL
                AND (f.id IS NULL OR f.space_id != t.space_id OR f.split_of IS NOT NULL
                     OR t.id != (SELECT MIN(id) FROM tabs WHERE split_of = t.split_of)))
            OR (t.split_of IS NULL AND t.position < 0)
         ORDER BY t.created_at`,
      )
      .all() as unknown as TabRow[]
    if (broken.length === 0) return
    this.transaction(() => {
      for (const tab of broken) {
        this.db.prepare('UPDATE tabs SET split_of = NULL, position = -1 WHERE id = ?').run(tab.id)
        const position = this.listLength(keyOf(tab)) - 1
        this.db.prepare('UPDATE tabs SET position = ? WHERE id = ?').run(position, tab.id)
      }
    })
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

  /** A folder of the space `spaceId` (`not_found` for one of another space). */
  private requireFolderIn(spaceId: string, id: string): FolderRow {
    const row = this.requireFolder(id)
    if (row.space_id !== spaceId) {
      throw new BrowserError('not_found', `Unknown folder in this space: ${id}`)
    }
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
