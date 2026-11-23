import { describe, expect, it } from 'vitest'
import { dockSections, QUICK_ACTIONS, type DockSection } from './dock'
import type { FinderTab } from './finder'

const tab = (id: string, title: string, extra: Partial<FinderTab> = {}): FinderTab => ({
  id,
  title,
  url: `https://${id}.test/`,
  spaceId: 's1',
  spaceName: 'Personal',
  current: true,
  lastActiveAt: null,
  folder: null,
  ...extra,
})

const TABS: FinderTab[] = [
  tab('never', 'Never active'),
  tab('old', 'Old one', { lastActiveAt: '2026-11-20T08:00:00.000Z' }),
  tab('filed', 'Filed tab', { lastActiveAt: '2026-11-20T09:00:00.000Z', folder: 'Reading' }),
  tab('new', 'New one', { lastActiveAt: '2026-11-20T10:00:00.000Z' }),
  tab('work', 'Team docs', {
    spaceId: 's2',
    spaceName: 'Work',
    current: false,
    lastActiveAt: '2026-11-20T11:00:00.000Z',
  }),
]

const titles = (sections: DockSection[]) => sections.map((s) => s.title)
const section = (sections: DockSection[], title: DockSection['title']) =>
  sections.find((s) => s.title === title)

describe('dockSections, empty query', () => {
  const sections = dockSections({
    query: '  ',
    spaceId: 's1',
    tabs: TABS,
  })

  it('lists only Recent Tabs (at most 3)', () => {
    expect(titles(sections)).toEqual(['Recent Tabs'])
    expect(section(sections, 'Recent Tabs')?.rows.map((r) => r.tabId)).toEqual([
      'new',
      'filed',
      'old',
    ])
  })

  it('hints the folder for a filed tab and the address for an unfiled tab', () => {
    const rows = section(sections, 'Recent Tabs')?.rows ?? []
    expect(rows.find((r) => r.tabId === 'filed')?.hint).toBe('In Reading')
    expect(rows.find((r) => r.tabId === 'new')?.hint).toBe('new.test')
  })

  it('lists at most three recent tabs', () => {
    const many = Array.from({ length: 8 }, (_, i) => tab(`t${i}`, `Tab ${i}`))
    const recent = section(dockSections({ query: '', spaceId: 's1', tabs: many }), 'Recent Tabs')
    expect(recent?.rows).toHaveLength(3)
  })

  it('exports the four quick actions for the footer bar', () => {
    expect(QUICK_ACTIONS.map((a) => a.label)).toEqual([
      'docs.new',
      'meet.new',
      'sheets.new',
      'github.com/new',
    ])
    expect(QUICK_ACTIONS.map((a) => a.shortLabel)).toEqual(['Docs', 'Meet', 'Sheets', 'GitHub'])
  })

  it('returns nothing when the space has no open tabs', () => {
    expect(dockSections({ query: '', spaceId: 's1', tabs: [] })).toEqual([])
  })
})

describe('dockSections, with a query', () => {
  const sections = dockSections({
    query: 'doc',
    spaceId: 's1',
    tabs: TABS,
  })

  it('puts the go-to or search row first, untitled', () => {
    expect(sections[0]).toEqual({
      title: null,
      rows: [{ key: 'open', kind: 'search', label: 'Search Google for "doc"' }],
    })
    expect(
      dockSections({
        query: 'example.com/a',
        spaceId: 's1',
        tabs: [],
      })[0]?.rows,
    ).toEqual([{ key: 'open', kind: 'go', label: 'Go to https://example.com/a' }])
  })

  it('matches open tabs of every space, naming another space', () => {
    expect(section(sections, 'Recent Tabs')?.rows).toEqual([
      { key: 'tab:work', kind: 'tab', label: 'Team docs', hint: 'Work', tabId: 'work' },
    ])
  })
})
