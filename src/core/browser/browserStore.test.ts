import { describe, expect, it } from 'vitest'
import { openDatabase } from '../store/database'
import { BrowserError, BrowserStore } from './browserStore'

const options = { defaultSpace: { name: 'Personal', color: '#7C5CFF' } }

function setup() {
  const db = openDatabase(':memory:')
  const store = new BrowserStore(db, options)
  const spaceId = store.snapshot().activeSpaceId
  return { db, store, spaceId }
}

const urls = (store: BrowserStore, spaceId: string) =>
  store
    .snapshot()
    .tabs.filter((t) => t.spaceId === spaceId)
    .map((t) => t.url)

describe('BrowserStore', () => {
  it('creates the default space once', () => {
    const { db } = setup()
    new BrowserStore(db, options)
    const snap = new BrowserStore(db, options).snapshot()
    expect(snap.spaces.map((s) => s.name)).toEqual(['Personal'])
    expect(snap.activeSpaceId).toBe(snap.spaces[0]?.id)
  })

  it('opens a tab after the active one', () => {
    const { store, spaceId } = setup()
    const a = store.openTab(spaceId, 'a')
    store.openTab(spaceId, 'b')
    store.activateTab(a.id)
    const c = store.openTab(spaceId, 'c')
    expect(urls(store, spaceId)).toEqual(['a', 'c', 'b'])
    expect(store.snapshot().tabs.map((t) => t.position)).toEqual([0, 1, 2])
    expect(store.snapshot().activeTabIds[spaceId]).toBe(c.id)
  })

  it('opens in the background', () => {
    const { store, spaceId } = setup()
    const a = store.openTab(spaceId, 'a')
    store.openTab(spaceId, 'b', { activate: false })
    expect(store.snapshot().activeTabIds[spaceId]).toBe(a.id)
  })

  it('closing the active tab activates the one below, else above', () => {
    const { store, spaceId } = setup()
    const a = store.openTab(spaceId, 'a')
    const b = store.openTab(spaceId, 'b', { activate: false })
    const c = store.openTab(spaceId, 'c', { activate: false })
    store.activateTab(b.id)
    store.closeTab(b.id)
    expect(store.snapshot().activeTabIds[spaceId]).toBe(c.id)
    store.closeTab(c.id)
    expect(store.snapshot().activeTabIds[spaceId]).toBe(a.id)
    store.closeTab(a.id)
    const snap = store.snapshot()
    expect(snap.activeTabIds[spaceId]).toBeNull()
    expect(snap.tabs).toEqual([])
  })

  it('activating a tab of another space switches space', () => {
    const { store, spaceId } = setup()
    const tab = store.openTab(spaceId, 'a')
    const other = store.createSpace('Work', '#fff')
    expect(store.snapshot().activeSpaceId).toBe(other.id)
    store.activateTab(tab.id)
    expect(store.snapshot().activeSpaceId).toBe(spaceId)
    store.activateSpace(other.id)
    expect(store.snapshot().activeSpaceId).toBe(other.id)
  })

  it('persists across instances', () => {
    const { db, store, spaceId } = setup()
    store.openTab(spaceId, 'a')
    store.createSpace('Work', '#fff')
    expect(new BrowserStore(db, options).snapshot()).toEqual(store.snapshot())
  })

  it('notifies subscribers on every change', () => {
    const { store, spaceId } = setup()
    let calls = 0
    store.subscribe(() => calls++)
    const tab = store.openTab(spaceId, 'a')
    expect(calls).toBe(1)
    store.updateTab(tab.id, { title: 'A', faviconUrl: 'f' })
    expect(calls).toBe(2)
    expect(store.snapshot().tabs[0]).toMatchObject({ url: 'a', title: 'A', faviconUrl: 'f' })
    store.closeTab(tab.id)
    expect(calls).toBe(3)
  })

  it('throws not_found for unknown ids', () => {
    const { store } = setup()
    expect(() => store.closeTab('x')).toThrow(BrowserError)
    expect(() => store.activateTab('x')).toThrow(BrowserError)
    expect(() => store.activateSpace('x')).toThrow(BrowserError)
    expect(() => store.openTab('x', 'a')).toThrow(BrowserError)
    expect(() => store.updateTab('x', {})).toThrow(expect.objectContaining({ code: 'not_found' }))
  })

  it('deleting a space row cascades its tabs', () => {
    const { db, store, spaceId } = setup()
    store.openTab(spaceId, 'a')
    db.prepare('DELETE FROM spaces WHERE id = ?').run(spaceId)
    expect((db.prepare('SELECT COUNT(*) AS n FROM tabs').get() as { n: number }).n).toBe(0)
  })
})
