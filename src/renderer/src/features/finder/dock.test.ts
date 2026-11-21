import { describe, expect, it } from 'vitest'
import type { HistoryEntry } from '@shared/model'
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

const entry = (id: string, title: string, url: string, spaceId = 's1'): HistoryEntry => ({
  id,
  spaceId,
  url,
  title,
  visitCount: 3,
  lastVisit: '2026-11-20T10:00:00.000Z',
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

const FREQUENT = [entry('h1', 'Hacker News', 'https://news.ycombinator.com/')]

const titles = (sections: DockSection[]) => sections.map((s) => s.title)
const section = (sections: DockSection[], title: DockSection['title']) =>
  sections.find((s) => s.title === title)

describe('dockSections, empty query', () => {
  const sections = dockSections({
    query: '  ',
    spaceId: 's1',
    tabs: TABS,
    frequent: FREQUENT,
    matches: [],
  })

  it('lists Recent Tabs, Frequent and Quick Actions, in that order', () => {
    expect(titles(sections)).toEqual(['Recent Tabs', 'Frequent', 'Quick Actions'])
  })

  it("lists this space's tabs, most recently active first, never-active last", () => {
    expect(section(sections, 'Recent Tabs')?.rows.map((r) => r.tabId)).toEqual([
      'new',
      'filed',
      'old',
      'never',
    ])
  })

  it('hints the folder a filed tab is in', () => {
    const rows = section(sections, 'Recent Tabs')?.rows ?? []
    expect(rows.find((r) => r.tabId === 'filed')?.hint).toBe('In Reading')
    expect(rows.find((r) => r.tabId === 'new')?.hint).toBeUndefined()
  })

  it('lists at most six recent tabs', () => {
    const many = Array.from({ length: 8 }, (_, i) => tab(`t${i}`, `Tab ${i}`))
    const recent = section(
      dockSections({ query: '', spaceId: 's1', tabs: many, frequent: [], matches: [] }),
      'Recent Tabs',
    )
    expect(recent?.rows).toHaveLength(6)
  })

  it('lists the frequent pages as history rows, and the four quick actions', () => {
    expect(section(sections, 'Frequent')?.rows).toEqual([
      {
        key: 'history:h1',
        kind: 'history',
        label: 'Hacker News',
        hint: 'news.ycombinator.com',
        url: 'https://news.ycombinator.com/',
        historyId: 'h1',
      },
    ])
    expect(section(sections, 'Quick Actions')?.rows.map((r) => r.url)).toEqual(
      QUICK_ACTIONS.map((a) => a.url),
    )
    expect(QUICK_ACTIONS.map((a) => a.label)).toEqual([
      'docs.new',
      'meet.new',
      'sheets.new',
      'github.com/new',
    ])
  })

  it('leaves out an empty section', () => {
    expect(
      titles(dockSections({ query: '', spaceId: 's1', tabs: TABS, frequent: [], matches: [] })),
    ).toEqual(['Recent Tabs', 'Quick Actions'])
  })
})

describe('dockSections, with a query', () => {
  const sections = dockSections({
    query: 'doc',
    spaceId: 's1',
    tabs: TABS,
    frequent: FREQUENT,
    matches: [
      entry('h2', 'Electron docs', 'https://www.electronjs.org/docs', 's2'),
      // A stale match that no longer fits the query.
      entry('h3', 'Unrelated', 'https://unrelated.test/'),
    ],
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
        frequent: [],
        matches: [],
      })[0]?.rows,
    ).toEqual([{ key: 'open', kind: 'go', label: 'Go to https://example.com/a' }])
  })

  it('matches the open tabs of every space, naming another space', () => {
    expect(section(sections, 'Recent Tabs')?.rows).toEqual([
      { key: 'tab:work', kind: 'tab', label: 'Team docs', hint: 'Work', tabId: 'work' },
    ])
  })

  it('matches history of every space, filtered by the query', () => {
    expect(section(sections, 'Frequent')?.rows.map((r) => r.historyId)).toEqual(['h2'])
  })

  it('keeps the quick actions that match', () => {
    expect(section(sections, 'Quick Actions')?.rows.map((r) => r.label)).toEqual(['docs.new'])
  })

  it('leaves out a page already listed as an open tab', () => {
    const open = dockSections({
      query: 'team',
      spaceId: 's1',
      tabs: TABS,
      frequent: [],
      matches: [entry('h4', 'Team docs', 'https://work.test/', 's2')],
    })
    expect(section(open, 'Recent Tabs')?.rows.map((r) => r.tabId)).toEqual(['work'])
    expect(section(open, 'Frequent')).toBeUndefined()
  })
})
