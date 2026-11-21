import { describe, expect, it } from 'vitest'
import type { BrowserTab } from '@shared/model'
import { splitPartner } from './splitPartner'

const tab = (id: string, extra: Partial<BrowserTab> = {}): BrowserTab => ({
  id,
  spaceId: 's1',
  url: `https://${id}.test/`,
  title: id,
  faviconUrl: null,
  position: 0,
  section: 'today',
  folderId: null,
  parentId: null,
  lastActiveAt: null,
  splitOf: null,
  splitRatio: null,
  ...extra,
})

describe('splitPartner', () => {
  it('pairs a tab with the next row of its list, else the previous', () => {
    const tabs = [tab('a'), tab('b'), tab('c')]
    const order = ['a', 'b', 'c']
    expect(splitPartner(tabs, order, 'a')).toBe('b')
    expect(splitPartner(tabs, order, 'b')).toBe('c')
    expect(splitPartner(tabs, order, 'c')).toBe('b')
  })

  it('stays in the tab’s own list (section and folder)', () => {
    const tabs = [
      tab('f', { section: 'favorites' }),
      tab('p1', { section: 'pinned', folderId: 'fo' }),
      tab('p2', { section: 'pinned' }),
      tab('t'),
    ]
    const order = ['f', 'p1', 'p2', 't']
    expect(splitPartner(tabs, order, 'p1')).toBeNull()
    expect(splitPartner(tabs, order, 'p2')).toBeNull()
    expect(splitPartner(tabs, order, 'f')).toBeNull()
    expect(splitPartner([...tabs, tab('p3', { section: 'pinned' })], [...order, 'p3'], 'p2')).toBe(
      'p3',
    )
  })

  it('skips split rows and does nothing for a tab already split or alone', () => {
    const tabs = [tab('a'), tab('b'), tab('b2', { splitOf: 'b' }), tab('c')]
    // visibleOrder leaves the second half out.
    const order = ['a', 'b', 'c']
    expect(splitPartner(tabs, order, 'a')).toBe('c')
    expect(splitPartner(tabs, order, 'b')).toBeNull()
    expect(splitPartner(tabs, order, 'b2')).toBeNull()
    expect(splitPartner([tab('x')], ['x'], 'x')).toBeNull()
    expect(splitPartner([], [], 'gone')).toBeNull()
  })
})
