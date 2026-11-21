import { describe, expect, it } from 'vitest'
import { openDatabase } from '../store/database'
import { BrowserStore } from './browserStore'
import { HistoryStore } from './historyStore'

function setup() {
  const db = openDatabase(':memory:')
  const browser = new BrowserStore(db, { defaultSpace: { name: 'Personal', color: '#7C5CFF' } })
  const a = browser.snapshot().activeSpaceId
  const b = browser.createSpace('Work', '#00AA55').id
  return { db, history: new HistoryStore(db), a, b }
}

describe('HistoryStore', () => {
  it('counts repeat visits of one URL in one row', () => {
    const { history, a } = setup()
    history.record(a, 'https://example.com/', 'Example')
    history.record(a, 'https://example.com/', 'Example')
    const rows = history.frequent(a)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ spaceId: a, url: 'https://example.com/', visitCount: 2 })
  })

  it('ignores non-http(s) URLs', () => {
    const { history, a } = setup()
    history.record(a, 'file:///etc/passwd', 'x')
    history.record(a, 'about:blank', 'x')
    history.record(a, 'not a url', 'x')
    expect(history.frequent(a)).toEqual([])
  })

  it('updates the title of a recorded page only', () => {
    const { history, a } = setup()
    history.record(a, 'https://example.com/', 'https://example.com/')
    history.setTitle(a, 'https://example.com/', 'Example')
    history.setTitle(a, 'https://other.com/', 'Other')
    expect(history.frequent(a).map((e) => e.title)).toEqual(['Example'])
  })

  it('lists a space’s pages by count, then recency', () => {
    const { history, a, b } = setup()
    history.record(a, 'https://old.com/', 'Old')
    history.record(a, 'https://often.com/', 'Often')
    history.record(a, 'https://often.com/', 'Often')
    history.record(a, 'https://new.com/', 'New')
    history.record(b, 'https://elsewhere.com/', 'Elsewhere')
    expect(history.frequent(a).map((e) => e.title)).toEqual(['Often', 'New', 'Old'])
    expect(history.frequent(a, 1)).toHaveLength(1)
  })

  it('searches titles and URLs across spaces, ignoring case', () => {
    const { history, a, b } = setup()
    history.record(a, 'https://github.com/x', 'Repo')
    history.record(b, 'https://example.com/', 'My GitHub page')
    history.record(b, 'https://other.com/', 'Other')
    expect(
      history
        .search('git')
        .map((e) => e.title)
        .sort(),
    ).toEqual(['My GitHub page', 'Repo'])
    expect(history.search('GIT', 1)).toHaveLength(1)
  })

  it('treats LIKE wildcards in a query literally', () => {
    const { history, a } = setup()
    history.record(a, 'https://example.com/', 'Example')
    expect(history.search('%')).toEqual([])
  })

  it('forgets one row', () => {
    const { history, a } = setup()
    history.record(a, 'https://a.com/', 'A')
    history.record(a, 'https://b.com/', 'B')
    const first = history.frequent(a).find((e) => e.title === 'A')
    history.forget(first?.id ?? '')
    expect(history.frequent(a).map((e) => e.title)).toEqual(['B'])
  })

  it('wipes only one space', () => {
    const { history, a, b } = setup()
    history.record(a, 'https://a.com/', 'A')
    history.record(b, 'https://b.com/', 'B')
    history.wipeSpace(a)
    expect(history.frequent(a)).toEqual([])
    expect(history.frequent(b)).toHaveLength(1)
  })

  it('goes with its space when the space is deleted', () => {
    const { history, db, a, b } = setup()
    history.record(b, 'https://b.com/', 'B')
    db.prepare('DELETE FROM spaces WHERE id = ?').run(b)
    expect(history.search('b.com')).toEqual([])
    expect(a).toBeTruthy()
  })
})
