import { describe, expect, it } from 'vitest'
import type { BrowserState } from '@shared/ipc/contract'
import type { BrowserFolder, BrowserTab } from '@shared/model'
import { sidebarSections } from '../workspace/workspace'
import { dropHit, dropRows, dropTarget, type DropRow } from './useTabDrag'

/** A row of the given list, `height` 10 at `top`. */
const row = (id: string, top: number, extra: Partial<DropRow> = {}, height = 10): DropRow => ({
  id,
  kind: 'tab',
  section: 'today',
  folderId: null,
  top,
  height,
  ...extra,
})

describe('dropTarget', () => {
  const today = [row('a', 0), row('b', 10), row('c', 20)]

  it('drops before a row in its upper half, after it in its lower half', () => {
    expect(dropTarget(12, today)).toEqual({ section: 'today', folderId: null, index: 1 })
    expect(dropTarget(18, today)).toEqual({ section: 'today', folderId: null, index: 2 })
    expect(dropTarget(1, today)).toEqual({ section: 'today', folderId: null, index: 0 })
    expect(dropTarget(29, today)).toEqual({ section: 'today', folderId: null, index: 3 })
  })

  it('counts only the rows of the target list, in the order given', () => {
    const rows = [
      row('p1', 0, { section: 'pinned' }),
      row('fo', 10, { kind: 'folder', section: 'pinned' }),
      row('in1', 20, { section: 'pinned', folderId: 'fo' }),
      row('in2', 30, { section: 'pinned', folderId: 'fo' }),
      row('p2', 40, { section: 'pinned' }),
      row('t1', 60),
    ]
    expect(dropTarget(41, rows)).toEqual({ section: 'pinned', folderId: null, index: 2 })
    expect(dropTarget(38, rows)).toEqual({ section: 'pinned', folderId: 'fo', index: 2 })
    expect(dropTarget(61, rows)).toEqual({ section: 'today', folderId: null, index: 0 })
  })

  it('files into a folder in the middle half of its row (at the end), else before or after it', () => {
    const rows = [
      row('p1', 0, { section: 'pinned' }),
      row('fo', 10, { kind: 'folder', section: 'pinned' }, 20),
      // A collapsed folder's tabs are not drawn: no height, still counted.
      row('in1', 0, { section: 'pinned', folderId: 'fo' }, 0),
    ]
    expect(dropTarget(20, rows)).toEqual({ section: 'pinned', folderId: 'fo', index: 1 })
    expect(dropTarget(16, rows)).toEqual({ section: 'pinned', folderId: 'fo', index: 1 })
    expect(dropTarget(12, rows)).toEqual({ section: 'pinned', folderId: null, index: 1 })
    expect(dropTarget(26, rows)).toEqual({ section: 'pinned', folderId: null, index: 2 })
  })

  it('drops at the end of a list on its empty area, nowhere outside the lists', () => {
    const rows = [
      row('pinned', 0, { kind: 'list', section: 'pinned' }, 30),
      row('today', 40, { kind: 'list' }, 40),
      row('t1', 40),
    ]
    expect(dropTarget(5, rows)).toEqual({ section: 'pinned', folderId: null, index: 0 })
    expect(dropTarget(70, rows)).toEqual({ section: 'today', folderId: null, index: 1 })
    expect(dropTarget(35, rows)).toBeNull()
    expect(dropTarget(5, [])).toBeNull()
  })

  it('favourites at the end on any tile of the grid or the grid itself', () => {
    const rows = [
      row('favorites', 0, { kind: 'list', section: 'favorites' }, 50),
      row('f1', 0, { section: 'favorites' }, 20),
      row('f2', 0, { section: 'favorites' }, 20),
      row('f3', 24, { section: 'favorites' }, 20),
    ]
    expect(dropTarget(2, rows)).toEqual({ section: 'favorites', folderId: null, index: 3 })
    expect(dropTarget(46, rows)).toEqual({ section: 'favorites', folderId: null, index: 3 })
  })
})

// ---------- rows from the sidebar sections ----------

const tab = (id: string, position: number, extra: Partial<BrowserTab> = {}): BrowserTab => ({
  id,
  spaceId: 's1',
  url: `https://${id}.test/`,
  title: id,
  faviconUrl: null,
  position,
  section: 'today',
  folderId: null,
  parentId: null,
  lastActiveAt: null,
  ...extra,
})

const stateOf = (tabs: BrowserTab[], folders: BrowserFolder[] = []): BrowserState => ({
  spaces: [
    {
      id: 's1',
      name: 'Personal',
      color: '#7C5CFF',
      position: 0,
      icon: null,
      sectionCollapsed: false,
    },
  ],
  activeSpaceId: 's1',
  tabs,
  folders,
  activeTabIds: { s1: null },
  runtime: {},
})

/** Every drawn element is a 10 px row, stacked in the order the sidebar draws them. */
function stacked(drawn: string[]): (key: string) => { top: number; height: number } | null {
  return (key) => {
    const at = drawn.indexOf(key)
    return at < 0 ? null : { top: at * 10, height: 10 }
  }
}

/** The 10 px rows of `stacked`, plus elements spanning several of them (an automatic folder). */
function withSpans(
  drawn: string[],
  spans: Record<string, [first: string, last: string]>,
): (key: string) => { top: number; height: number } | null {
  const row = stacked(drawn)
  return (key) => {
    const span = spans[key]
    if (!span) return row(key)
    const first = row(span[0])
    const last = row(span[1])
    return first && last ? { top: first.top, height: last.top + last.height - first.top } : null
  }
}

const today = (index: number) => ({ section: 'today', folderId: null, index })

/** The drop line's client Y for a hit, or null (no line). */
const lineAt = (y: number, rows: DropRow[]) => {
  const hit = dropHit(y, rows)
  return hit?.line ?? null
}

describe('dropRows', () => {
  // Store order: x1, a1, y1, y2, a2, a3 — drawn: x1, [a.com: a1, a2, a3], y1, y2.
  const regrouped = (dragged: BrowserTab) =>
    sidebarSections(
      stateOf([
        tab('x1', 0, { url: 'https://x.com/' }),
        tab('a1', 1, { url: 'https://a.com/1' }),
        tab('y1', 2, { url: 'https://y.com/1' }),
        tab('y2', 3, { url: 'https://y.com/2' }),
        tab('a2', 4, { url: 'https://a.com/2' }),
        tab('a3', 5, { url: 'https://a.com/3' }),
        dragged,
      ]),
      's1',
      { autoFolders: true },
    )
  const drawn = [
    'tab:drag',
    'tab:x1',
    'auto-header',
    'tab:a1',
    'tab:a2',
    'tab:a3',
    'tab:y1',
    'tab:y2',
  ]
  const measure = withSpans(drawn, { 'auto:a.com': ['auto-header', 'tab:a3'] })

  it("counts today in the store's order for a tab of the automatic folder's site", () => {
    const sections = regrouped(tab('drag', 0, { section: 'pinned', url: 'https://a.com/4' }))
    const rows = dropRows(sections, 'drag', measure)
    // Before a3 (drawn 6th): a3 is 6th in the store's order → index 5, not the visual 3.
    expect(dropTarget(51, rows)).toEqual(today(5))
    expect(lineAt(51, rows)).toBe(50)
    // After y2, the last drawn row: y2 is 4th in the store's order → index 4.
    expect(dropTarget(79, rows)).toEqual(today(4))
  })

  it('treats an automatic folder as one block for a tab of another site', () => {
    const sections = regrouped(tab('drag', 0, { section: 'pinned', url: 'https://y.com/3' }))
    const rows = dropRows(sections, 'drag', measure)
    // The block spans 20..60. Its lower half (on a3): before y1, where the tab is drawn too.
    expect(dropTarget(55, rows)).toEqual(today(2))
    expect(lineAt(55, rows)).toBe(60)
    // Its upper half (on the header or a1): before a1.
    expect(dropTarget(22, rows)).toEqual(today(1))
    expect(lineAt(22, rows)).toBe(20)
  })

  it("maps a nested child to its root's subtree, where the store puts the tab", () => {
    const sections = sidebarSections(
      stateOf([tab('a', 0), tab('kid', 1, { parentId: 'a' }), tab('b', 2), tab('drag', 3)]),
      's1',
      { autoFolders: true },
    )
    const rows = dropRows(sections, 'drag', stacked(['tab:a', 'tab:kid', 'tab:b', 'tab:drag']))
    // Upper half of a: before it. Lower half of a, or anywhere on kid: after a's subtree.
    expect(dropTarget(2, rows)).toEqual(today(0))
    expect(lineAt(2, rows)).toBe(0)
    for (const y of [8, 11, 18]) {
      expect(dropTarget(y, rows)).toEqual(today(2))
      expect(lineAt(y, rows)).toBe(20)
    }
  })

  it('makes a drop on the dragged tab or its subtree no move', () => {
    const sections = sidebarSections(
      stateOf([tab('a', 0), tab('kid', 1, { parentId: 'a' }), tab('b', 2), tab('c', 3)]),
      's1',
      { autoFolders: true },
    )
    const rows = dropRows(sections, 'a', stacked(['tab:a', 'tab:kid', 'tab:b', 'tab:c']))
    expect(dropTarget(5, rows)).toBeNull()
    expect(dropTarget(15, rows)).toBeNull()
    // After b: index 1 among today without a and its child.
    expect(dropTarget(28, rows)).toEqual(today(1))
  })

  it('makes a nested child dropped on itself no move (it stays nested)', () => {
    const sections = sidebarSections(
      stateOf([tab('a', 0), tab('kid', 1, { parentId: 'a' }), tab('b', 2)]),
      's1',
      { autoFolders: true },
    )
    const rows = dropRows(sections, 'kid', stacked(['tab:a', 'tab:kid', 'tab:b']))
    expect(dropTarget(15, rows)).toBeNull()
    expect(lineAt(15, rows)).toBeNull()
  })

  it("makes a folder's tab dropped on itself no move (it stays in the folder)", () => {
    const sections = sidebarSections(
      stateOf(
        [
          tab('in1', 0, { section: 'pinned', folderId: 'fo' }),
          tab('in2', 1, { section: 'pinned', folderId: 'fo' }),
          tab('p1', 1, { section: 'pinned' }),
        ],
        [
          {
            id: 'fo',
            spaceId: 's1',
            name: 'Reading',
            position: 0,
            collapsed: false,
            parentId: null,
            icon: null,
          },
        ],
      ),
      's1',
      { autoFolders: true },
    )
    const drawnPinned = ['folder:fo', 'tab:in1', 'tab:in2', 'tab:p1']
    const rows = dropRows(
      sections,
      'in1',
      withSpans(drawnPinned, { 'list:pinned': ['folder:fo', 'tab:p1'] }),
    )
    expect(dropTarget(15, rows)).toBeNull()
    // The lower half of in2: after it, still inside the folder.
    expect(dropTarget(28, rows)).toEqual({ section: 'pinned', folderId: 'fo', index: 1 })
  })

  it('makes a favourite dropped on the favourites no move', () => {
    const sections = sidebarSections(
      stateOf([
        tab('f1', 0, { section: 'favorites' }),
        tab('f2', 1, { section: 'favorites' }),
        tab('t1', 0),
      ]),
      's1',
      { autoFolders: true },
    )
    const measureTiles = (key: string) =>
      key === 'list:favorites' || key.startsWith('tab:f')
        ? { top: 0, height: 20 }
        : key === 'tab:t1'
          ? { top: 30, height: 10 }
          : null
    const rows = dropRows(sections, 'f1', measureTiles)
    expect(dropTarget(5, rows)).toBeNull()
    expect(dropTarget(39, rows)).toEqual(today(1))
  })

  it("keeps a collapsed folder's tabs (undrawn) so filing into it appends", () => {
    const sections = sidebarSections(
      stateOf(
        [
          tab('in1', 0, { section: 'pinned', folderId: 'fo' }),
          tab('in2', 1, { section: 'pinned', folderId: 'fo' }),
          tab('t1', 0),
        ],
        [
          {
            id: 'fo',
            spaceId: 's1',
            name: 'Reading',
            position: 0,
            collapsed: true,
            parentId: null,
            icon: null,
          },
        ],
      ),
      's1',
      { autoFolders: true },
    )
    const rows = dropRows(sections, 't1', stacked(['folder:fo', 'tab:t1']))
    expect(dropTarget(5, rows)).toEqual({ section: 'pinned', folderId: 'fo', index: 2 })
  })

  it('files a tab into a nested folder, and counts a child folder in its parent', () => {
    const folder = (id: string, position: number, parentId: string | null) => ({
      id,
      spaceId: 's1',
      name: id,
      position,
      collapsed: false,
      parentId,
      icon: null,
    })
    const sections = sidebarSections(
      stateOf(
        [
          tab('in1', 0, { section: 'pinned', folderId: 'outer' }),
          tab('deep', 0, { section: 'pinned', folderId: 'inner' }),
          tab('t1', 0),
        ],
        [folder('outer', 0, null), folder('inner', 1, 'outer')],
      ),
      's1',
      { autoFolders: true },
    )
    const drawn = ['folder:outer', 'tab:in1', 'folder:inner', 'tab:deep', 'tab:t1']
    const rows = dropRows(sections, 't1', stacked(drawn))
    // The middle of the inner folder's row: at its end.
    expect(dropTarget(25, rows)).toEqual({ section: 'pinned', folderId: 'inner', index: 1 })
    // The middle of the outer folder's row: after its tab and its child folder.
    expect(dropTarget(5, rows)).toEqual({ section: 'pinned', folderId: 'outer', index: 2 })
    // The upper quarter of the inner folder: before it, in the outer folder.
    expect(dropTarget(21, rows)).toEqual({ section: 'pinned', folderId: 'outer', index: 1 })
    // Below the inner folder's row: after it, the line under its last drawn tab.
    expect(dropHit(28, rows)).toMatchObject({
      target: { section: 'pinned', folderId: 'outer', index: 2 },
      line: 40,
    })
  })
})
