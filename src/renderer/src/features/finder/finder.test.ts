import { describe, expect, it } from 'vitest'
import { rankTabs, type FinderTab } from './finder'

const tab = (id: string, title: string, url: string, current = true): FinderTab => ({
  id,
  title,
  url,
  spaceId: current ? 's1' : 's2',
  spaceName: current ? 'Personal' : 'Work',
  current,
  lastActiveAt: null,
  folder: null,
})

const TABS: FinderTab[] = [
  tab('docs', 'Electron docs', 'https://www.electronjs.org/docs/latest/api/menu'),
  tab('mail', 'Inbox – Mail', 'https://mail.example.com/inbox'),
  tab('news', 'Hacker News', 'https://news.ycombinator.com/'),
  tab('work', 'Docs of the team', 'https://wiki.example.com/team', false),
]

const ids = (ranked: Array<{ id: string }>) => ranked.map((r) => r.id)

describe('rankTabs', () => {
  it('needs every word of the query to match the title or the URL, ignoring case', () => {
    expect(ids(rankTabs('electron MENU', TABS))).toEqual(['docs'])
    expect(ids(rankTabs('electron inbox', TABS))).toEqual([])
  })

  it('ranks a title that starts with the query first, then title matches, then URL matches', () => {
    // "docs": the title of "work" starts with it, "docs" has it in its title; "team" only in a URL.
    expect(ids(rankTabs('docs', TABS))).toEqual(['work', 'docs'])
    expect(ids(rankTabs('team', TABS))).toEqual(['work'])
    const ranked = rankTabs('example', [
      tab('url', 'Unrelated', 'https://example.com/'),
      tab('title', 'An example page', 'https://a.test/'),
      tab('start', 'Example domain', 'https://b.test/'),
    ])
    expect(ids(ranked)).toEqual(['start', 'title', 'url'])
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? Infinity)
    expect(ranked[1]?.score).toBeGreaterThan(ranked[2]?.score ?? Infinity)
  })

  it('matches the host and path, without www. or the scheme', () => {
    expect(ids(rankTabs('ycombinator', TABS))).toEqual(['news'])
    expect(ids(rankTabs('electronjs.org/docs', TABS))).toEqual(['docs'])
    expect(ids(rankTabs('https', TABS))).toEqual([])
    expect(ids(rankTabs('www', TABS))).toEqual([])
  })

  it('lists the current space’s tabs in their order for an empty query', () => {
    expect(ids(rankTabs('', TABS))).toEqual(['docs', 'mail', 'news'])
    expect(ids(rankTabs('   ', TABS))).toEqual(['docs', 'mail', 'news'])
  })
})
