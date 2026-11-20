import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

// ---------- drop maths (pure) ----------

/** Where a drop on one side of a row goes in the store's order, and where its line is drawn. */
export interface DropEdge {
  index: number
  /** Client Y of the line. */
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
  /** The dragged tab, its subtree or its own list: a drop on it is no move. */
  self?: boolean
  snap?: { before: DropEdge; after: DropEdge }
}

/** Where a drop moves the tab: `browser.moveTab`'s section, folder and index. */
export interface DropTarget {
  section: TabSection
  folderId: string | null
  index: number
}

/** The `data-drop` key of a measured element: a tab, a folder, an automatic folder, a list. */
export type DropKey = `${'tab' | 'folder' | 'auto' | 'list'}:${string}`

/** A drop target and what shows it: the line's client Y, or the folder or list it goes into. */
export interface DropHit {
  target: DropTarget
  line: number | null
  zone: DropKey | null
}

const inside = (y: number, r: DropRow): boolean =>
  r.height > 0 && y >= r.top && y < r.top + r.height

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

/** Before or after a row (a folder's "after" is below its drawn tabs). */
function beside(rows: DropRow[], row: DropRow, after: boolean): DropHit {
  const at = { section: row.section, folderId: row.folderId }
  if (row.snap) {
    const edge = after ? row.snap.after : row.snap.before
    return { target: { ...at, index: edge.index }, line: edge.y, zone: null }
  }
  const index = listRows(rows, row.section, row.folderId).indexOf(row) + (after ? 1 : 0)
  let line = after ? bottom(row) : row.top
  if (after && row.kind === 'folder') {
    const last = listRows(rows, 'pinned', row.id)
      .filter((r) => r.height > 0)
      .at(-1)
    if (last) line = bottom(last)
  }
  return { target: { ...at, index }, line, zone: null }
}

/** The upper half of a row is before it, the lower half after; a folder's middle half is into. */
function onRow(y: number, rows: DropRow[], row: DropRow): DropHit {
  if (row.section === 'favorites') return into(rows, 'favorites', null, 'list:favorites')
  const rel = (y - row.top) / row.height
  if (row.kind === 'folder' && rel >= 0.25 && rel < 0.75) {
    return into(rows, 'pinned', row.id, `folder:${row.id}`)
  }
  return beside(rows, row, row.kind === 'folder' ? rel >= 0.75 : rel >= 0.5)
}

/** `dropTarget` with what the sidebar draws for it. */
export function dropHit(pointerY: number, rows: DropRow[]): DropHit | null {
  if (rows.some((r) => r.self && inside(pointerY, r))) return null
  const row = rows.find((r) => r.kind !== 'list' && !r.self && inside(pointerY, r))
  if (row) return onRow(pointerY, rows, row)
  const zone = rows.find((r) => r.kind === 'list' && inside(pointerY, r))
  if (!zone) return null
  if (zone.section === 'favorites') return into(rows, 'favorites', null, 'list:favorites')
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
 * the end of the favourites. Indices count the list's rows as given (today: its rows' `snap`).
 * null: no move (not over a list, or over the dragged tab itself).
 */
export function dropTarget(pointerY: number, rows: DropRow[]): DropTarget | null {
  return dropHit(pointerY, rows)?.target ?? null
}

type Measure = (key: DropKey) => { top: number; height: number } | null

/**
 * Today's rows in drawn order, each with the store's index for a drop before or after it.
 * `skip` (the dragged subtree) is out of the store's order; its drawn rows are `self`.
 * - A top-level row: before it, or after its subtree (where the store puts a drop on any of
 *   its tabs, children included — the line is drawn there).
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
  const addTabs = (nodes: SidebarNode[]): void => {
    for (const t of tabsOf(nodes)) {
      const row: DropRow = { ...base, id: t.id, ...box(`tab:${t.id}`) }
      if (skip.has(t.id)) row.self = true
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

/**
 * The drop rows of a space's sidebar while `draggedId` is dragged. The dragged tab, its today
 * subtree (they move together) and, for a favourite, the favourites are `self`: a drop on them
 * is no move. Today's rows map to the store's order (`todayOrder`) whatever automatic folders
 * regroup on screen, so indices are the store's (see todayRows).
 */
export function dropRows(
  sections: SidebarSections,
  draggedId: string,
  measure: Measure,
): DropRow[] {
  const skip = todaySubtree(sections.todayOrder, draggedId).add(draggedId)
  const dragged = [
    ...sections.favorites,
    ...tabsOf(sections.pinned),
    ...tabsOf(sections.today),
  ].find((t) => t.id === draggedId)
  const favourite = sections.favorites.some((t) => t.id === draggedId)
  const rows: DropRow[] = []
  const add = (key: DropKey, row: Pick<DropRow, 'id' | 'kind' | 'section' | 'folderId'>): void => {
    const box = measure(key)
    const self = row.kind === 'tab' && skip.has(row.id)
    rows.push({ ...row, top: box?.top ?? 0, height: box?.height ?? 0, ...(self && { self }) })
  }
  const tab = (id: string, section: TabSection, folderId: string | null = null): void =>
    add(`tab:${id}`, { id, kind: 'tab', section, folderId })
  const list = (section: TabSection, self = false): void => {
    const box = measure(`list:${section}`)
    if (box) {
      rows.push({
        id: section,
        kind: 'list',
        section,
        folderId: null,
        ...box,
        ...(self && { self }),
      })
    }
  }

  // Favourites can't be reordered by drag: for a favourite the whole grid is no move.
  list('favorites', favourite)
  for (const t of sections.favorites) tab(t.id, 'favorites')
  list('pinned')
  for (const node of sections.pinned) {
    if (node.kind === 'tab') tab(node.tab.id, 'pinned')
    else if (node.kind === 'folder') {
      add(`folder:${node.folder.id}`, {
        id: node.folder.id,
        kind: 'folder',
        section: 'pinned',
        folderId: null,
      })
      for (const child of node.children) {
        if (child.kind === 'tab') tab(child.tab.id, 'pinned', node.folder.id)
      }
    }
  }
  list('today')
  rows.push(...todayRows(sections, skip, dragged ? autoFolderHost(dragged.url) : null, measure))
  return rows
}

// ---------- the drag (pointer events) ----------

/** Pointer travel before a press on a tab becomes a drag (a shorter one stays a click). */
const DRAG_THRESHOLD = 4

/** What the sidebar draws while a tab is dragged. */
export type DropIndicator =
  /** The 2 px insertion line, `top` in the scroll container's content. */
  | { kind: 'line'; top: number }
  /** A folder or a list highlighted: the drop goes into it. */
  | { kind: 'zone'; key: DropKey }

export interface TabDrag {
  /** The dragged tab and its today subtree (drawn dimmed); empty when nothing is dragged. */
  dragging: ReadonlySet<string>
  /** The highlighted folder or list, if the drop goes into one. */
  zone: DropKey | null
  /** Starts tracking a press on a tab: it becomes a drag once the pointer has moved. */
  press: (tabId: string, event: ReactPointerEvent) => void
}

const NONE: ReadonlySet<string> = new Set()

export const TabDragContext = createContext<TabDrag>({
  dragging: NONE,
  zone: null,
  press: () => undefined,
})

/** A tab's side of the drag: whether it is dragged and the handler that starts a drag. */
export function useTabDragHandle(tabId: string): {
  dragged: boolean
  onPointerDown: (event: ReactPointerEvent) => void
} {
  const { dragging, press } = useContext(TabDragContext)
  return { dragged: dragging.has(tabId), onPointerDown: (event) => press(tabId, event) }
}

/** The sidebar's line or zone for a hit, the line measured against the scroll container. */
function indicatorOf(hit: DropHit, container: HTMLElement): DropIndicator | null {
  if (hit.zone !== null) return { kind: 'zone', key: hit.zone }
  if (hit.line === null) return null
  const box = container.getBoundingClientRect()
  return { kind: 'line', top: hit.line - box.top + container.scrollTop }
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

/**
 * Drag tabs in the sidebar to reorder them, pin, favourite or file them into a folder: on drop
 * it calls `browser.moveTab`. Pointer events (not HTML5 drag and drop); Esc cancels. Rows are
 * found in `container` by their `data-drop` key.
 */
export function useTabDrag(
  sections: SidebarSections | undefined,
  container: RefObject<HTMLElement | null>,
): { drag: TabDrag; indicator: DropIndicator | null } {
  const [dragging, setDragging] = useState<ReadonlySet<string>>(NONE)
  const [indicator, setIndicator] = useState<DropIndicator | null>(null)
  const sectionsRef = useRef(sections)
  useEffect(() => {
    sectionsRef.current = sections
  }, [sections])
  /** Ends the drag in progress (listeners removed, indicator cleared). */
  const stop = useRef<(() => void) | null>(null)
  useEffect(() => () => stop.current?.(), [])

  const press = useCallback(
    (tabId: string, event: ReactPointerEvent): void => {
      if (event.button !== 0 || !sectionsRef.current) return
      stop.current?.()
      const from = { x: event.clientX, y: event.clientY }
      let started = false
      let hit: DropHit | null = null

      const measure: Measure = (key) => {
        const el = container.current?.querySelector(`[data-drop="${CSS.escape(key)}"]`)
        // A row that is folded away or leaving (inert) is not drawn: no height, but still counts.
        if (!el || el.closest('[inert]')) return null
        const { top, height } = el.getBoundingClientRect()
        return { top, height }
      }
      const move = (e: PointerEvent): void => {
        const current = sectionsRef.current
        const box = container.current
        if (!current || !box) return
        if (!started) {
          if (Math.hypot(e.clientX - from.x, e.clientY - from.y) < DRAG_THRESHOLD) return
          started = true
          setDragging(todaySubtree(current.todayOrder, tabId).add(tabId))
        }
        e.preventDefault()
        const rows = dropRows(current, tabId, measure)
        // The last hit is the drop: the release lands where the pointer last moved to.
        hit = dropHit(e.clientY, rows)
        setIndicator(hit ? indicatorOf(hit, box) : null)
      }
      const up = (): void => {
        end()
        if (!started) return
        // Released over the pressed row (also after Esc): that click must not activate it.
        swallowNextClick()
        if (hit) {
          void window.acab.invoke('browser.moveTab', { tabId, ...hit.target })
        }
      }
      /** Esc: no drop, but the release is still awaited so its click can be swallowed. */
      const key = (e: KeyboardEvent): void => {
        if (e.key !== 'Escape') return
        window.removeEventListener('pointermove', move)
        window.removeEventListener('keydown', key)
        hit = null
        setDragging(NONE)
        setIndicator(null)
      }
      const end = (): void => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', end)
        window.removeEventListener('keydown', key)
        stop.current = null
        setDragging(NONE)
        setIndicator(null)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', end)
      window.addEventListener('keydown', key)
      stop.current = end
    },
    [container],
  )

  const zone = indicator?.kind === 'zone' ? indicator.key : null
  const drag = useMemo(() => ({ dragging, zone, press }), [dragging, zone, press])
  return { drag, indicator }
}
