import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import type { TabSection } from '@shared/model'
import {
  autoFolderHost,
  tabsOf,
  todaySubtree,
  type SidebarNode,
  type SidebarSections,
} from '../workspace/workspace'
import { DragLift, layoutBox } from './dragLift'

// ---------- drop maths (pure) ----------

/** Where a drop on one side of a row goes in the store's order, and where its gap opens. */
export interface DropEdge {
  index: number
  /** Client Y of the boundary between rows where the gap opens. */
  y: number
}

/**
 * A drop row as measured in the sidebar (client coordinates). `kind: 'list'` is a section's whole
 * area: a drop on it that hits no row lands next to the nearest drawn row of that section, or at
 * its end. Rows are given in each list's order, and a row that is not drawn (a collapsed folder's
 * tab) has no height but still counts. Today's rows carry `snap`: the store's index and line for
 * a drop before or after them, since its drawn order is not the store's.
 */
export interface DropRow {
  id: string
  kind: 'tab' | 'folder' | 'list'
  section: TabSection
  folderId: string | null
  top: number
  height: number
  /** A favourite tile's horizontal extent: tiles share rows of the grid. */
  left?: number
  width?: number
  /** The dragged row or its subtree: a drop on it is no move. */
  self?: boolean
  /** The shown tab's row, when the dragged tab may pair with it: its middle half splits them. */
  splits?: boolean
  snap?: { before: DropEdge; after: DropEdge }
}

/** What is dragged: a tab (a row or a tile) or a pinned folder, by its `data-drop` key. */
export type DragKey = `${'tab' | 'folder'}:${string}`

/** A place in a list: its section, folder and index. */
export interface ListTarget {
  section: TabSection
  folderId: string | null
  index: number
}

/**
 * Where a drop goes: a place in a list, or beside the shown tab as a split (`splitWith`, its id).
 * See moveOf for the call it makes.
 */
export type DropTarget = ListTarget | { splitWith: string }

/** The `data-drop` key of a measured element: a tab, a folder, an automatic folder, a list. */
export type DropKey = `${'tab' | 'folder' | 'auto' | 'list'}:${string}`

/**
 * A drop target and what shows it: the client Y between two rows where the gap opens (dragLift),
 * or the folder or list it goes into (highlighted); neither for a place among the tiles.
 */
export interface DropHit {
  target: DropTarget
  line: number | null
  zone: DropKey | null
}

/** Whether the pointer is on a drawn row (on a tile, its x counts too when it is known). */
const inside = (y: number, r: DropRow, x?: number): boolean =>
  r.height > 0 &&
  y >= r.top &&
  y < r.top + r.height &&
  (x === undefined ||
    r.left === undefined ||
    r.width === undefined ||
    (x >= r.left && x < r.left + r.width))

const bottom = (r: DropRow): number => r.top + r.height

/** The tab and folder rows of a list (the dragged tab's left out), in the list's order. */
const listRows = (rows: DropRow[], section: TabSection, folderId: string | null): DropRow[] =>
  rows.filter(
    (r) => r.kind !== 'list' && !r.self && r.section === section && r.folderId === folderId,
  )

/** At the end of a folder, of the favourites or of an empty list: `zone` is highlighted. */
const into = (
  rows: DropRow[],
  section: TabSection,
  folderId: string | null,
  zone: DropKey,
): DropHit => ({
  target: { section, folderId, index: listRows(rows, section, folderId).length },
  line: null,
  zone,
})

/** The bottom of a row as drawn: a folder's is below its last drawn row, at any depth. */
function drawnBottom(rows: DropRow[], row: DropRow): number {
  if (row.kind !== 'folder') return bottom(row)
  const last = listRows(rows, 'pinned', row.id)
    .filter((r) => r.height > 0)
    .at(-1)
  return last ? drawnBottom(rows, last) : bottom(row)
}

/** Before or after a row (a folder's "after" is below its drawn rows). */
function beside(rows: DropRow[], row: DropRow, after: boolean): DropHit {
  const at = { section: row.section, folderId: row.folderId }
  if (row.snap) {
    const edge = after ? row.snap.after : row.snap.before
    return { target: { ...at, index: edge.index }, line: edge.y, zone: null }
  }
  const index = listRows(rows, row.section, row.folderId).indexOf(row) + (after ? 1 : 0)
  const line = after ? drawnBottom(rows, row) : row.top
  return { target: { ...at, index }, line, zone: null }
}

/** A favourite is dragged: the tiles reorder among themselves. */
const reorderingTiles = (rows: DropRow[]): boolean =>
  rows.some((r) => r.self && r.kind === 'tab' && r.section === 'favorites')

/** Among the tiles, the left half of a tile is before it, the right half after. */
function onTile(x: number, rows: DropRow[], tile: DropRow): DropHit {
  const after = x >= (tile.left ?? 0) + (tile.width ?? 0) / 2
  const index = listRows(rows, 'favorites', null).indexOf(tile) + (after ? 1 : 0)
  return { target: { section: 'favorites', folderId: null, index }, line: null, zone: null }
}

/** Between tiles: beside the nearest tile of the grid row the pointer is on, else at the end. */
function nearTile(x: number, y: number, rows: DropRow[]): DropHit {
  const band = listRows(rows, 'favorites', null).filter((r) => inside(y, r))
  const gap = (r: DropRow): number =>
    Math.max((r.left ?? 0) - x, x - (r.left ?? 0) - (r.width ?? 0), 0)
  const nearest = band.reduce<DropRow | null>(
    (best, r) => (best === null || gap(r) < gap(best) ? r : best),
    null,
  )
  if (!nearest) {
    const index = listRows(rows, 'favorites', null).length
    return { target: { section: 'favorites', folderId: null, index }, line: null, zone: null }
  }
  return onTile(x, rows, nearest)
}

/**
 * The upper half of a row is before it, the lower half after; a folder's middle half is into, the
 * shown tab's middle half (`splits`) pairs the dragged tab with it.
 */
function onRow(y: number, rows: DropRow[], row: DropRow, x?: number): DropHit {
  if (row.section === 'favorites') {
    if (x !== undefined && reorderingTiles(rows)) return onTile(x, rows, row)
    return into(rows, 'favorites', null, 'list:favorites')
  }
  const rel = (y - row.top) / row.height
  if (row.splits && rel >= 0.25 && rel < 0.75) {
    return { target: { splitWith: row.id }, line: null, zone: `tab:${row.id}` }
  }
  if (row.kind === 'folder' && rel >= 0.25 && rel < 0.75) {
    return into(rows, 'pinned', row.id, `folder:${row.id}`)
  }
  return beside(rows, row, row.kind === 'folder' ? rel >= 0.75 : rel >= 0.5)
}

/**
 * `dropTarget` with what the sidebar draws for it. `pointerX` places a dragged favourite among
 * the tiles (without it, tiles are told apart by y alone).
 */
export function dropHit(pointerY: number, rows: DropRow[], pointerX?: number): DropHit | null {
  if (rows.some((r) => r.self && inside(pointerY, r, pointerX))) return null
  const row = rows.find((r) => r.kind !== 'list' && !r.self && inside(pointerY, r, pointerX))
  if (row) return onRow(pointerY, rows, row, pointerX)
  const zone = rows.find((r) => r.kind === 'list' && inside(pointerY, r))
  if (!zone) return null
  if (zone.section === 'favorites') {
    if (pointerX !== undefined && reorderingTiles(rows)) return nearTile(pointerX, pointerY, rows)
    return into(rows, 'favorites', null, 'list:favorites')
  }
  // Between rows or below the last one: next to the nearest drawn row of the section (a folder's
  // tabs included).
  const distance = (r: DropRow): number => Math.max(r.top - pointerY, pointerY - bottom(r), 0)
  const nearest = rows
    .filter((r) => r.kind !== 'list' && !r.self && r.section === zone.section && r.height > 0)
    .reduce<DropRow | null>(
      (best, r) => (best === null || distance(r) < distance(best) ? r : best),
      null,
    )
  if (!nearest) return into(rows, zone.section, null, `list:${zone.section}`)
  return beside(rows, nearest, pointerY >= nearest.top)
}

/**
 * Where a tab dropped at `pointerY` goes: the upper half of a row is before it, the lower half
 * after it; the middle 50 % of a folder row is into the folder (at its end); the tiles grid is
 * the end of the favourites (a dragged favourite goes by x among them: see dropHit). Indices
 * count the list's rows as given (today: its rows' `snap`).
 * null: no move (not over a list, or over the dragged row itself).
 */
export function dropTarget(pointerY: number, rows: DropRow[]): DropTarget | null {
  return dropHit(pointerY, rows)?.target ?? null
}

/** A measured element: its client box (a tile's x too), null when it is not drawn. */
type Measure = (
  key: DropKey,
) => { top: number; height: number; left?: number; width?: number } | null

/**
 * Today's rows in drawn order, each with the store's index for a drop before or after it.
 * `skip` (the dragged subtree) is out of the store's order; its drawn rows are `self`.
 * - A top-level row: before it, or after its subtree (where the store puts a drop on any of
 *   its tabs, children included — the gap opens there).
 * - An automatic folder of another site than the dragged tab's is one block: before its first
 *   tab, or before the next drawn row — where the dropped tab is drawn. For a tab of its own
 *   site, its rows are plain today rows (the tab joins the folder wherever it lands).
 */
function todayRows(
  sections: SidebarSections,
  skip: Set<string>,
  draggedHost: string | null,
  measure: Measure,
): DropRow[] {
  const order = sections.todayOrder
  const parentOf = new Map(order.map((e) => [e.id, e.parentId]))
  const rootOf = (id: string): string => {
    let at = id
    for (let parent = parentOf.get(at); parent; parent = parentOf.get(at)) at = parent
    return at
  }
  const rest = order.filter((e) => !skip.has(e.id))
  const indexOf = new Map(rest.map((e, i) => [e.id, i]))
  /** Store index just after each root's subtree. */
  const endOf = new Map<string, number>()
  rest.forEach((e, i) => endOf.set(rootOf(e.id), i + 1))
  const drawnIds = tabsOf(sections.today).map((t) => t.id)
  const nextIndex = (lastId: string | undefined): number => {
    const after = drawnIds.slice(lastId === undefined ? 0 : drawnIds.indexOf(lastId) + 1)
    const next = after.find((id) => indexOf.has(id))
    return next === undefined ? rest.length : (indexOf.get(next) ?? rest.length)
  }

  const base = { kind: 'tab', section: 'today', folderId: null } as const
  const box = (key: DropKey) => measure(key) ?? { top: 0, height: 0 }
  const rows: DropRow[] = []
  const tabRows: DropRow[] = []
  /** One row per tab or split of `nodes` (a split's second half has none). */
  const addTabs = (nodes: SidebarNode[]): void => {
    for (const node of nodes) {
      if (node.kind === 'folder' || node.kind === 'auto-folder') {
        addTabs(node.children)
        continue
      }
      const id = node.kind === 'tab' ? node.tab.id : node.first.id
      const row: DropRow = { ...base, id, ...box(`tab:${id}`) }
      if (skip.has(id)) row.self = true
      else tabRows.push(row)
      rows.push(row)
    }
  }
  for (const node of sections.today) {
    if (node.kind !== 'auto-folder' || node.host === draggedHost) {
      addTabs([node])
      continue
    }
    const ids = tabsOf(node.children).map((t) => t.id)
    const block = box(`auto:${node.host}`)
    const first = ids.find((id) => indexOf.has(id))
    rows.push({
      ...base,
      id: `auto:${node.host}`,
      ...block,
      snap: {
        before: { index: first === undefined ? 0 : (indexOf.get(first) ?? 0), y: block.top },
        after: { index: nextIndex(ids.at(-1)), y: block.top + block.height },
      },
    })
    // Dragged tabs inside the block (a nested child of another site) stay no-move targets.
    for (const id of ids.filter((i) => skip.has(i))) {
      rows.push({ ...base, id, self: true, ...box(`tab:${id}`) })
    }
  }
  /** The bottom of each root's last drawn row: where a drop after its subtree is drawn. */
  const subtreeBottom = new Map<string, number>()
  for (const r of tabRows) {
    if (r.height > 0) subtreeBottom.set(rootOf(r.id), bottom(r))
  }
  for (const r of tabRows) {
    const root = rootOf(r.id)
    const after: DropEdge = {
      index: endOf.get(root) ?? rest.length,
      y: subtreeBottom.get(root) ?? bottom(r),
    }
    const before: DropEdge = root === r.id ? { index: indexOf.get(r.id) ?? 0, y: r.top } : after
    r.snap = { before, after }
  }
  return rows
}

/** A pinned folder's own id and those of everything in it (folders and tabs, at any depth). */
function folderSubtree(nodes: SidebarNode[], folderId: string): Set<string> {
  const ids = new Set<string>()
  const collect = (node: SidebarNode): void => {
    if (node.kind === 'tab') ids.add(node.tab.id)
    else if (node.kind === 'split') ids.add(node.first.id).add(node.second.id)
    else {
      if (node.kind === 'folder') ids.add(node.folder.id)
      node.children.forEach(collect)
    }
  }
  const find = (list: SidebarNode[]): boolean =>
    list.some((node) => {
      if (node.kind !== 'folder') return false
      if (node.folder.id !== folderId) return find(node.children)
      collect(node)
      return true
    })
  find(nodes)
  return ids
}

/** The row of `id` in a pinned or today list (at any depth), or undefined. */
function nodeOf(nodes: SidebarNode[], id: string): SidebarNode | undefined {
  for (const node of nodes) {
    if (node.kind === 'tab' && node.tab.id === id) return node
    if (node.kind === 'split' && (node.first.id === id || node.second.id === id)) return node
    if (node.kind === 'folder' || node.kind === 'auto-folder') {
      const found = nodeOf(node.children, id)
      if (found) return found
    }
  }
  return undefined
}

/**
 * Whether the tab `draggedId` may be dropped on the shown tab `activeId` to split them: two
 * tabs, neither a split, the shown one a row of pinned or today (not a favourite tile).
 */
function splittable(
  sections: SidebarSections,
  draggedId: string,
  activeId: string | null,
): boolean {
  if (activeId === null || activeId === draggedId) return false
  if (sections.favoriteSeconds.has(draggedId)) return false
  const lists = [...sections.pinned, ...sections.today]
  return nodeOf(lists, activeId)?.kind === 'tab' && nodeOf(lists, draggedId)?.kind !== 'split'
}

/**
 * The drop rows of a space's sidebar while `dragged` is dragged. The dragged row and what moves
 * with it (a today tab's subtree, everything in a folder) are `self`: a drop on them is no move.
 * A folder only goes into pinned: today and the favourites are left out. Today's rows map to the
 * store's order (`todayOrder`) whatever automatic folders regroup on screen, so indices are the
 * store's (see todayRows). The shown tab `activeId`'s row `splits` when the dragged tab may pair
 * with it.
 */
export function dropRows(
  sections: SidebarSections,
  dragged: DragKey,
  measure: Measure,
  activeId: string | null = null,
): DropRow[] {
  const folder = dragged.startsWith('folder:')
  const draggedId = dragged.slice(dragged.indexOf(':') + 1)
  const skip = folder
    ? folderSubtree(sections.pinned, draggedId)
    : todaySubtree(sections.todayOrder, draggedId).add(draggedId)
  const tab = folder
    ? undefined
    : [...sections.favorites, ...tabsOf(sections.pinned), ...tabsOf(sections.today)].find(
        (t) => t.id === draggedId,
      )
  const rows: DropRow[] = []
  const add = (key: DropKey, row: Pick<DropRow, 'id' | 'kind' | 'section' | 'folderId'>): void => {
    const box = measure(key)
    const self = skip.has(row.id)
    rows.push({ ...row, top: 0, height: 0, ...box, ...(self && { self }) })
  }
  const tabRow = (id: string, section: TabSection, folderId: string | null = null): void =>
    add(`tab:${id}`, { id, kind: 'tab', section, folderId })
  const list = (section: TabSection): void => {
    const box = measure(`list:${section}`)
    if (box) rows.push({ id: section, kind: 'list', section, folderId: null, ...box })
  }

  if (!folder) {
    list('favorites')
    for (const t of sections.favorites) tabRow(t.id, 'favorites')
  }
  list('pinned')
  /** A pinned list's rows in drawn order, each folder followed by its own list. */
  const pinnedRows = (nodes: SidebarNode[], folderId: string | null): void => {
    for (const node of nodes) {
      if (node.kind === 'tab') tabRow(node.tab.id, 'pinned', folderId)
      else if (node.kind === 'split') tabRow(node.first.id, 'pinned', folderId)
      else if (node.kind === 'folder') {
        add(`folder:${node.folder.id}`, {
          id: node.folder.id,
          kind: 'folder',
          section: 'pinned',
          folderId,
        })
        pinnedRows(node.children, node.folder.id)
      }
    }
  }
  pinnedRows(sections.pinned, null)
  if (folder) return rows
  list('today')
  rows.push(...todayRows(sections, skip, tab ? autoFolderHost(tab.url) : null, measure))
  if (splittable(sections, draggedId, activeId)) {
    const shown = rows.find((r) => r.kind === 'tab' && r.id === activeId && !r.self)
    if (shown) shown.splits = true
  }
  return rows
}

/** The IPC call a drop makes: a tab moves with `browser.moveTab`, a folder `browser.moveFolder`. */
export type DropMove =
  | {
      channel: 'browser.moveTab'
      input: { tabId: string; section: TabSection; folderId: string | null; index: number }
    }
  | {
      channel: 'browser.moveFolder'
      input: { folderId: string; parentId: string | null; index: number }
    }
  | { channel: 'browser.splitTabs'; input: { firstId: string; secondId: string } }

/**
 * What dropping `dragged` on `target` calls; null when it can't go there (a folder out of pinned,
 * or onto a tab to split).
 */
export function moveOf(dragged: DragKey, target: DropTarget): DropMove | null {
  const id = dragged.slice(dragged.indexOf(':') + 1)
  if ('splitWith' in target) {
    if (!dragged.startsWith('tab:')) return null
    return { channel: 'browser.splitTabs', input: { firstId: target.splitWith, secondId: id } }
  }
  if (dragged.startsWith('tab:')) {
    return { channel: 'browser.moveTab', input: { tabId: id, ...target } }
  }
  if (target.section !== 'pinned') return null
  return {
    channel: 'browser.moveFolder',
    input: { folderId: id, parentId: target.folderId, index: target.index },
  }
}

// ---------- the drag (pointer events) ----------

/** Pointer travel before a press on a row becomes a drag (a shorter one stays a click). */
const DRAG_THRESHOLD = 4

/** After a drop, how long the gap may wait for the new order before it closes anyway. */
const SETTLE_FALLBACK_MS = 500

export interface TabDrag {
  /** What is dragged and what moves with it (a today tab's subtree); empty when nothing is. */
  dragging: ReadonlySet<DragKey>
  /** The highlighted folder or list, if the drop goes into one. */
  zone: DropKey | null
  /** Starts tracking a press on a row: it becomes a drag once the pointer has moved. */
  press: (key: DragKey, event: ReactPointerEvent) => void
}

const NONE: ReadonlySet<DragKey> = new Set()

export const TabDragContext = createContext<TabDrag>({
  dragging: NONE,
  zone: null,
  press: () => undefined,
})

/** A row's side of the drag (a tab, a tile or a folder): whether it is dragged, and its handler. */
export function useDragHandle(key: DragKey): {
  dragged: boolean
  onPointerDown: (event: ReactPointerEvent) => void
} {
  const { dragging, press } = useContext(TabDragContext)
  return { dragged: dragging.has(key), onPointerDown: (event) => press(key, event) }
}

/** A click that follows a drag (released over the pressed row) must not activate the tab. */
function swallowNextClick(): void {
  const swallow = (e: MouseEvent): void => {
    e.stopPropagation()
    e.preventDefault()
  }
  window.addEventListener('click', swallow, { capture: true, once: true })
  setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
}

/** Sends a drop's move. */
function send(move: DropMove): Promise<void> {
  switch (move.channel) {
    case 'browser.moveTab':
      return window.bigBrowser.invoke('browser.moveTab', move.input)
    case 'browser.moveFolder':
      return window.bigBrowser.invoke('browser.moveFolder', move.input)
    case 'browser.splitTabs':
      return window.bigBrowser.invoke('browser.splitTabs', move.input)
  }
}

/**
 * Drag tabs, tiles and pinned folders in the sidebar to reorder them, pin, favourite or file them
 * into a folder: on drop it calls `browser.moveTab` or `browser.moveFolder`. Pointer events (not
 * HTML5 drag and drop). The row lifts (a clone with `cloneClass` follows the pointer) and the
 * others move aside where it will land (dragLift.ts); a tab dropped on the middle of the shown
 * tab's row (`activeId`) splits with it (`browser.splitTabs`); Esc cancels and the clone flies back. Rows
 * are found in `container` by their `data-drop` key.
 */
export function useTabDrag(
  sections: SidebarSections | undefined,
  activeId: string | null,
  container: RefObject<HTMLElement | null>,
  cloneClass: string | undefined,
): TabDrag {
  const [dragging, setDragging] = useState<ReadonlySet<DragKey>>(NONE)
  const [zone, setZone] = useState<DropKey | null>(null)
  const sectionsRef = useRef(sections)
  useEffect(() => {
    sectionsRef.current = sections
  }, [sections])
  const activeRef = useRef(activeId)
  useEffect(() => {
    activeRef.current = activeId
  }, [activeId])
  /** Ends the drag in progress at once (listeners removed, visuals reset). */
  const stop = useRef<(() => void) | null>(null)
  useEffect(() => () => stop.current?.(), [])
  /** After a drop: closes the gap once the new order is drawn (before it is painted). */
  const settle = useRef<(() => void) | null>(null)
  useLayoutEffect(() => {
    settle.current?.()
  }, [sections])

  const press = useCallback(
    (key: DragKey, event: ReactPointerEvent): void => {
      if (event.button !== 0 || !sectionsRef.current) return
      stop.current?.()
      const from = { x: event.clientX, y: event.clientY }
      const id = key.slice(key.indexOf(':') + 1)
      let started = false
      let cancelled = false
      let done = false
      let lifted: DragLift | null = null
      let hit: DropHit | null = null

      const find = (k: DropKey): HTMLElement | null =>
        container.current?.querySelector<HTMLElement>(`[data-drop="${CSS.escape(k)}"]`) ?? null
      const measure: Measure = (k) => {
        const box = container.current
        const el = find(k)
        // A row that is folded away or leaving (inert) is not drawn: no height, but still counts.
        if (!box || !el || el.closest('[inert]')) return null
        const at = layoutBox(el, box)
        if (!at) return null
        // Only tiles share rows: elsewhere a drop goes by y alone, wherever the pointer is across.
        const tile = k.startsWith('tab:') && el.closest('[data-drop="list:favorites"]') !== null
        return tile ? at : { top: at.top, height: at.height }
      }
      /** Lifts the row: false when it is not drawn. */
      const begin = (current: SidebarSections, box: HTMLElement): boolean => {
        const keys: DragKey[] = key.startsWith('tab:')
          ? [...todaySubtree(current.todayOrder, id).add(id)].map((t): DragKey => `tab:${t}`)
          : [key]
        const moving = keys.map(find).filter((el): el is HTMLElement => el !== null)
        // A folder lifts with its rows; its header carries its key.
        const root = key.startsWith('folder:') ? (moving[0]?.closest('li') ?? null) : find(key)
        if (!root) return false
        lifted = new DragLift(box, root, [root, ...moving], cloneClass)
        setDragging(new Set(keys))
        return true
      }
      const move = (e: PointerEvent): void => {
        const current = sectionsRef.current
        const box = container.current
        if (!current || !box) return
        if (!started) {
          if (Math.hypot(e.clientX - from.x, e.clientY - from.y) < DRAG_THRESHOLD) return
          started = true
          if (!begin(current, box)) return
        }
        if (!lifted) return
        e.preventDefault()
        lifted.follow(e.clientX - from.x, e.clientY - from.y)
        // The last hit is the drop: the release lands where the pointer last moved to.
        const next = dropHit(
          e.clientY,
          dropRows(current, key, measure, activeRef.current),
          e.clientX,
        )
        hit = next && moveOf(key, next.target) ? next : null
        setZone(hit?.zone ?? null)
        lifted.shift(hit)
      }
      const detach = (): void => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', abort)
        window.removeEventListener('keydown', escape)
        window.removeEventListener('blur', leave)
      }
      /** Resets the visuals and the state (once; a later drag's state is left alone). */
      const finish = (): void => {
        if (done) return
        done = true
        lifted?.clear()
        lifted = null
        if (settle.current === finish) settle.current = null
        if (stop.current === abort) {
          stop.current = null
          setDragging(NONE)
          setZone(null)
        }
      }
      const abort = (): void => {
        detach()
        finish()
      }
      /** No drop: the rows close the gap and the clone flies back to the row. */
      const flyBack = (): void => {
        cancelled = true
        hit = null
        setZone(null)
        const flying = lifted
        if (!flying) return finish()
        void flying.cancel().then(finish)
      }
      const up = (): void => {
        detach()
        if (!started) return finish()
        // Released over the pressed row (also after Esc): that click must not activate it.
        swallowNextClick()
        if (cancelled) return
        const call = hit ? moveOf(key, hit.target) : null
        if (!call || !lifted) return flyBack()
        // The gap stays until the new order is drawn, so nothing jumps.
        lifted.drop()
        settle.current = finish
        send(call).then(
          () => setTimeout(finish, SETTLE_FALLBACK_MS),
          () => finish(),
        )
      }
      /** Esc: no drop, but the release is still awaited so its click can be swallowed. */
      const escape = (e: KeyboardEvent): void => {
        if (e.key !== 'Escape' || !started || cancelled) return
        window.removeEventListener('pointermove', move)
        flyBack()
      }
      /**
       * The window lost focus (Alt-Tab mid-drag): no drop, and nothing waits for a release that
       * may come much later, elsewhere.
       */
      const leave = (): void => {
        detach()
        if (!started) finish()
        else if (!cancelled) flyBack()
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', abort)
      window.addEventListener('keydown', escape)
      window.addEventListener('blur', leave)
      stop.current = abort
    },
    [container, cloneClass],
  )

  return useMemo(() => ({ dragging, zone, press }), [dragging, zone, press])
}
