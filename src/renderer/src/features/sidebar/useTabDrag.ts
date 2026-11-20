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
import { todaySubtree, type SidebarSections } from '../workspace/workspace'

// ---------- drop maths (pure) ----------

/**
 * A drop row as measured in the sidebar (client coordinates). `kind: 'list'` is a section's whole
 * area: a drop on it that hits no row lands next to the nearest row of that list, or at its end.
 * Rows are given in each list's order — for today the store's order, not the drawn one — and a
 * row that is not drawn (a collapsed folder's tab) has no height but still counts.
 */
export interface DropRow {
  id: string
  kind: 'tab' | 'folder' | 'list'
  section: TabSection
  folderId: string | null
  top: number
  height: number
}

/** Where a drop moves the tab: `browser.moveTab`'s section, folder and index. */
export interface DropTarget {
  section: TabSection
  folderId: string | null
  index: number
}

type Place = 'before' | 'after' | 'into' | 'end'

/** A drop target and the row it is drawn against (the list's own row for an empty list). */
interface Hit {
  target: DropTarget
  row: DropRow
  place: Place
}

const inside = (y: number, r: DropRow): boolean =>
  r.height > 0 && y >= r.top && y < r.top + r.height

/** The tab and folder rows of a list, in the list's order. */
const listRows = (rows: DropRow[], section: TabSection, folderId: string | null): DropRow[] =>
  rows.filter((r) => r.kind !== 'list' && r.section === section && r.folderId === folderId)

/** At the end of a list: into a folder or the favourites (highlighted), else an empty list. */
const end = (rows: DropRow[], row: DropRow, section: TabSection, folderId: string | null): Hit => ({
  target: { section, folderId, index: listRows(rows, section, folderId).length },
  row,
  place: folderId !== null || section === 'favorites' ? 'into' : 'end',
})

/** Before or after a tab or folder row; the middle half of a folder row files into it. */
function onRow(y: number, rows: DropRow[], row: DropRow): Hit {
  if (row.section === 'favorites') return end(rows, row, 'favorites', null)
  const rel = (y - row.top) / row.height
  if (row.kind === 'folder' && rel >= 0.25 && rel < 0.75) return end(rows, row, 'pinned', row.id)
  const after = row.kind === 'folder' ? rel >= 0.75 : rel >= 0.5
  const index = listRows(rows, row.section, row.folderId).indexOf(row) + (after ? 1 : 0)
  return {
    target: { section: row.section, folderId: row.folderId, index },
    row,
    place: after ? 'after' : 'before',
  }
}

function hitTest(y: number, rows: DropRow[]): Hit | null {
  const row = rows.find((r) => r.kind !== 'list' && inside(y, r))
  if (row) return onRow(y, rows, row)
  const zone = rows.find((r) => r.kind === 'list' && inside(y, r))
  if (!zone) return null
  if (zone.section === 'favorites') return end(rows, zone, 'favorites', null)
  // Between rows or below the last one: next to the nearest drawn top-level row of the list.
  const drawn = listRows(rows, zone.section, null).filter((r) => r.height > 0)
  const distance = (r: DropRow): number => Math.max(r.top - y, y - (r.top + r.height), 0)
  const nearest = drawn.reduce<DropRow | null>(
    (best, r) => (best === null || distance(r) < distance(best) ? r : best),
    null,
  )
  if (!nearest) return end(rows, zone, zone.section, null)
  const index = listRows(rows, zone.section, null).indexOf(nearest) + (y < nearest.top ? 0 : 1)
  return {
    target: { section: zone.section, folderId: null, index },
    row: nearest,
    place: y < nearest.top ? 'before' : 'after',
  }
}

/**
 * Where a tab dropped at `pointerY` goes: the upper half of a row is before it, the lower half
 * after it; the middle 50 % of a folder row is into the folder (at its end); the tiles grid is
 * the end of the favourites. Indices count the list's rows as given. null: not over a list.
 */
export function dropTarget(pointerY: number, rows: DropRow[]): DropTarget | null {
  return hitTest(pointerY, rows)?.target ?? null
}

/** The `data-drop` key of a measured element: `tab:<id>`, `folder:<id>` or `list:<section>`. */
export type DropKey = `${'tab' | 'folder' | 'list'}:${string}`

type Measure = (key: DropKey) => { top: number; height: number } | null

/**
 * The drop rows of a space's sidebar while `draggedId` is dragged: the dragged tab and its today
 * subtree are left out (they move together, and a drop on them is no move). Today's rows are in
 * the store's order (`todayOrder`), whatever automatic folders regroup on screen, so indices are
 * the store's. Automatic folders themselves are no rows: their tabs are plain today tabs.
 */
export function dropRows(
  sections: SidebarSections,
  draggedId: string,
  measure: Measure,
): DropRow[] {
  const skip = todaySubtree(sections.todayOrder, draggedId).add(draggedId)
  const rows: DropRow[] = []
  const add = (key: DropKey, row: Pick<DropRow, 'id' | 'kind' | 'section' | 'folderId'>): void => {
    const box = measure(key)
    rows.push({ ...row, top: box?.top ?? 0, height: box?.height ?? 0 })
  }
  const tab = (id: string, section: TabSection, folderId: string | null = null): void => {
    if (!skip.has(id)) add(`tab:${id}`, { id, kind: 'tab', section, folderId })
  }
  const list = (section: TabSection): void => {
    const box = measure(`list:${section}`)
    if (box) rows.push({ id: section, kind: 'list', section, folderId: null, ...box })
  }

  list('favorites')
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
  for (const entry of sections.todayOrder) tab(entry.id, 'today')
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

/** The sidebar's line or zone for a hit, measured against the scroll container. */
function indicatorOf(hit: Hit, rows: DropRow[], container: HTMLElement): DropIndicator {
  const { row, place, target } = hit
  if (place === 'into') {
    const key: DropKey = row.kind === 'folder' ? `folder:${row.id}` : `list:${target.section}`
    return { kind: 'zone', key }
  }
  // An empty list: the list itself is highlighted.
  if (place === 'end') return { kind: 'zone', key: `list:${row.section}` }
  let y = place === 'before' ? row.top : row.top + row.height
  if (place === 'after' && row.kind === 'folder') {
    // After a folder: below its drawn tabs, not between the folder and its first tab.
    const last = listRows(rows, 'pinned', row.id)
      .filter((r) => r.height > 0)
      .at(-1)
    if (last) y = last.top + last.height
  }
  const box = container.getBoundingClientRect()
  return { kind: 'line', top: y - box.top + container.scrollTop }
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
      let hit: Hit | null = null

      const measure: Measure = (key) => {
        const el = container.current?.querySelector(`[data-drop="${CSS.escape(key)}"]`)
        if (!el) return null
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
        hit = hitTest(e.clientY, rows)
        setIndicator(hit ? indicatorOf(hit, rows, box) : null)
      }
      const up = (): void => {
        end()
        if (!started) return
        swallowNextClick()
        if (hit) {
          void window.acab.invoke('browser.moveTab', { tabId, ...hit.target })
        }
      }
      const key = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') end()
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
