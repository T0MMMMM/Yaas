import { describe, expect, it } from 'vitest'
import type { BrowserState } from '@shared/ipc/contract'
import type { BrowserFolder, BrowserTab } from '@shared/model'
import { sidebarSections } from '../workspace/workspace'
import { dropRows, dropTarget, type DropRow } from './useTabDrag'

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
  ...extra,
})

const stateOf = (tabs: BrowserTab[], folders: BrowserFolder[] = []): BrowserState => ({
  spaces: [{ id: 's1', name: 'Personal', color: '#7C5CFF', position: 0 }],
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

describe('dropRows', () => {
  it("counts today in the store's order when an automatic folder regroups it", () => {
    // Store order: x1, a1, y1, a2, a3 — drawn: x1, [a.com: a1, a2, a3], y1.
    const sections = sidebarSections(
      stateOf([
        tab('x1', 0, { url: 'https://x.com/' }),
        tab('a1', 1, { url: 'https://a.com/1' }),
        tab('y1', 2, { url: 'https://y.com/' }),
        tab('a2', 3, { url: 'https://a.com/2' }),
        tab('a3', 4, { url: 'https://a.com/3' }),
        tab('drag', 5, { section: 'pinned' }),
      ]),
      's1',
      { autoFolders: true },
    )
    const drawn = ['tab:drag', 'tab:x1', 'tab:a1', 'tab:a2', 'tab:a3', 'tab:y1']
    const rows = dropRows(sections, 'drag', stacked(drawn))

    // Before a3 (drawn 5th): a3 is 5th in the store's order too → index 4, not the visual 3.
    expect(dropTarget(41, rows)).toEqual({ section: 'today', folderId: null, index: 4 })
    // After y1, the last drawn row: y1 is third in the store's order → index 3.
    expect(dropTarget(59, rows)).toEqual({ section: 'today', folderId: null, index: 3 })
  })

  it('leaves out the dragged tab and its subtree, so a drop on them is no move', () => {
    const sections = sidebarSections(
      stateOf([tab('a', 0), tab('kid', 1, { parentId: 'a' }), tab('b', 2), tab('c', 3)]),
      's1',
      { autoFolders: true },
    )
    const rows = dropRows(sections, 'a', stacked(['tab:a', 'tab:kid', 'tab:b', 'tab:c']))
    expect(rows.map((r) => r.id)).not.toContain('kid')
    expect(
      dropTarget(
        5,
        rows.filter((r) => r.kind !== 'list'),
      ),
    ).toBeNull()
    // After b: index 1 among today without a and its child.
    expect(dropTarget(28, rows)).toEqual({ section: 'today', folderId: null, index: 1 })
  })

  it("keeps a collapsed folder's tabs (undrawn) so filing into it appends", () => {
    const sections = sidebarSections(
      stateOf(
        [
          tab('in1', 0, { section: 'pinned', folderId: 'fo' }),
          tab('in2', 1, { section: 'pinned', folderId: 'fo' }),
          tab('t1', 0),
        ],
        [{ id: 'fo', spaceId: 's1', name: 'Reading', position: 0, collapsed: true }],
      ),
      's1',
      { autoFolders: true },
    )
    const rows = dropRows(sections, 't1', stacked(['folder:fo', 'tab:t1']))
    expect(dropTarget(5, rows)).toEqual({ section: 'pinned', folderId: 'fo', index: 2 })
  })
})
