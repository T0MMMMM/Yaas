import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { migrate, openDatabase } from '../store/database'
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
    const b = store.openTab(spaceId, 'b')
    const c = store.openTab(spaceId, 'c')
    expect(urls(store, spaceId)).toEqual(['a', 'b', 'c'])
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

const positions = (
  store: BrowserStore,
  spaceId: string,
  section: string,
  folderId: string | null,
): number[] => {
  const snap = store.snapshot()
  const tabs = snap.tabs
    .filter((t) => t.spaceId === spaceId && t.section === section && t.folderId === folderId)
    .map((t) => t.position)
  const folders =
    section === 'pinned' && folderId === null
      ? snap.folders.filter((f) => f.spaceId === spaceId).map((f) => f.position)
      : []
  return [...tabs, ...folders].sort((a, b) => a - b)
}

/** Today's tab ids by stored position (snapshot order). */
const todayByPosition = (store: BrowserStore, spaceId: string): string[] =>
  store
    .snapshot()
    .tabs.filter((t) => t.spaceId === spaceId && t.section === 'today')
    .map((t) => t.id)

describe('BrowserStore organisation', () => {
  it('migrates a plan-1 database with its tabs in today', () => {
    const db = new DatabaseSync(':memory:')
    db.exec('PRAGMA foreign_keys = ON')
    migrate(db, 3)
    db.prepare(
      `INSERT INTO spaces (id, name, color, position, active_tab_id, created_at)
       VALUES ('s', 'Personal', '#7C5CFF', 0, 't', 'now')`,
    ).run()
    db.prepare(
      `INSERT INTO tabs (id, space_id, url, title, favicon_url, position, created_at)
       VALUES ('t', 's', 'a', 'A', NULL, 0, 'now')`,
    ).run()
    migrate(db)
    const snap = new BrowserStore(db, options).snapshot()
    expect(snap.tabs).toEqual([
      {
        id: 't',
        spaceId: 's',
        url: 'a',
        title: 'A',
        faviconUrl: null,
        position: 0,
        section: 'today',
        folderId: null,
        parentId: null,
      },
    ])
    expect(snap.folders).toEqual([])
  })

  it("opens a child tab after its parent's last descendant", () => {
    const { store, spaceId } = setup()
    const a = store.openTab(spaceId, 'a')
    store.openTab(spaceId, 'z')
    const b = store.openTab(spaceId, 'b', { parentId: a.id })
    const c = store.openTab(spaceId, 'c', { parentId: b.id })
    const d = store.openTab(spaceId, 'd', { parentId: a.id })
    expect(urls(store, spaceId)).toEqual(['a', 'b', 'c', 'd', 'z'])
    expect(d).toMatchObject({ section: 'today', parentId: a.id, position: 3 })
    expect(c.parentId).toBe(b.id)
    expect(store.visibleOrder(spaceId)).toEqual(
      store
        .snapshot()
        .tabs.filter((t) => t.spaceId === spaceId)
        .map((t) => t.id),
    )
  })

  it('closing a pinned tab unloads it and keeps it', () => {
    const { store, spaceId } = setup()
    const a = store.openTab(spaceId, 'a')
    store.moveTab(a.id, { section: 'pinned', index: 0 })
    expect(store.closeTab(a.id)).toBe('unloaded')
    expect(store.snapshot().tabs).toMatchObject([{ id: a.id, section: 'pinned' }])
  })

  it('closing a today tab re-parents its children', () => {
    const { store, spaceId } = setup()
    const a = store.openTab(spaceId, 'a')
    const b = store.openTab(spaceId, 'b', { parentId: a.id })
    const c = store.openTab(spaceId, 'c', { parentId: b.id })
    expect(store.closeTab(b.id)).toBe('deleted')
    const tabs = store.snapshot().tabs
    expect(tabs.map((t) => t.id)).toEqual([a.id, c.id])
    expect(tabs.find((t) => t.id === c.id)?.parentId).toBe(a.id)
  })

  it('next active follows the visible order inside a folder', () => {
    const { store, spaceId } = setup()
    const folder = store.createFolder(spaceId, 'F')
    const b = store.openTab(spaceId, 'b')
    const c = store.openTab(spaceId, 'c')
    const d = store.openTab(spaceId, 'd')
    store.openTab(spaceId, 'e')
    store.moveTab(b.id, { section: 'pinned', folderId: folder.id, index: 0 })
    store.moveTab(c.id, { section: 'pinned', folderId: folder.id, index: 1 })
    store.moveTab(d.id, { section: 'pinned', index: 1 })
    store.activateTab(b.id)
    store.closeTab(b.id)
    expect(store.snapshot().activeTabIds[spaceId]).toBe(c.id)
    store.activateTab(c.id)
    store.closeTab(c.id)
    expect(store.snapshot().activeTabIds[spaceId]).toBe(d.id)
  })

  it('moving a tab into a folder keeps positions contiguous in both lists', () => {
    const { store, spaceId } = setup()
    const a = store.openTab(spaceId, 'a')
    const b = store.openTab(spaceId, 'b')
    const c = store.openTab(spaceId, 'c')
    store.moveTab(a.id, { section: 'pinned', index: 0 })
    const folder = store.createFolder(spaceId, 'F')
    store.moveTab(b.id, { section: 'pinned', index: 2 })
    store.moveTab(c.id, { section: 'pinned', folderId: folder.id, index: 0 })
    store.moveTab(a.id, { section: 'pinned', folderId: folder.id, index: 0 })
    expect(positions(store, spaceId, 'pinned', null)).toEqual([0, 1])
    expect(positions(store, spaceId, 'pinned', folder.id)).toEqual([0, 1])
    expect(store.visibleOrder(spaceId)).toEqual([a.id, c.id, b.id])
  })

  it('keeps a folder emptied by a move', () => {
    const { store, spaceId } = setup()
    const folder = store.createFolder(spaceId, 'F')
    const a = store.openTab(spaceId, 'a')
    store.moveTab(a.id, { section: 'pinned', folderId: folder.id, index: 0 })
    store.moveTab(a.id, { section: 'today', index: 0 })
    expect(store.snapshot().folders).toMatchObject([{ id: folder.id, name: 'F' }])
    expect(store.snapshot().tabs).toMatchObject([{ id: a.id, section: 'today', folderId: null }])
  })

  it('reopens the tabs of a deleted folder', () => {
    const { store, spaceId } = setup()
    const folder = store.createFolder(spaceId, 'F')
    const a = store.openTab(spaceId, 'a')
    const b = store.openTab(spaceId, 'b')
    store.moveTab(a.id, { section: 'pinned', folderId: folder.id, index: 0 })
    store.moveTab(b.id, { section: 'pinned', folderId: folder.id, index: 1 })
    store.deleteFolder(folder.id)
    expect(store.snapshot().tabs).toEqual([])
    expect(store.snapshot().folders).toEqual([])
    store.reopenClosed()
    expect(urls(store, spaceId)).toEqual(['a', 'b'])
    expect(store.snapshot().tabs.every((t) => t.section === 'today')).toBe(true)
  })

  it("reopens into the active space's today when the tab's folder is gone", () => {
    const { store, spaceId } = setup()
    const folder = store.createFolder(spaceId, 'F')
    const a = store.openTab(spaceId, 'a')
    store.moveTab(a.id, { section: 'pinned', folderId: folder.id, index: 0 })
    store.removeTab(a.id)
    store.deleteFolder(folder.id)
    const other = store.createSpace('Work', '#fff')
    store.openTab(other.id, 'x')
    const reopened = store.reopenClosed()
    expect(reopened).toMatchObject({
      spaceId: other.id,
      url: 'a',
      section: 'today',
      folderId: null,
      position: 1,
    })
    expect(store.snapshot().activeTabIds[other.id]).toBe(reopened?.id)
  })

  it('a plain new tab opened from a child goes after the whole top-level subtree', () => {
    const { store, spaceId } = setup()
    const x = store.openTab(spaceId, 'x')
    const z = store.openTab(spaceId, 'z')
    const a = store.openTab(spaceId, 'a', { parentId: x.id })
    const b = store.openTab(spaceId, 'b', { parentId: x.id })
    store.activateTab(a.id)
    const n = store.openTab(spaceId, 'n')
    expect(n.parentId).toBeNull()
    expect(store.visibleOrder(spaceId)).toEqual(todayByPosition(store, spaceId))
    expect(store.visibleOrder(spaceId)).toEqual([x.id, a.id, b.id, n.id, z.id])
  })

  it('moving a parent within today moves its whole subtree', () => {
    const { store, spaceId } = setup()
    const x = store.openTab(spaceId, 'x')
    const z = store.openTab(spaceId, 'z')
    const w = store.openTab(spaceId, 'w')
    const a = store.openTab(spaceId, 'a', { parentId: x.id })
    store.moveTab(x.id, { section: 'today', index: 1 })
    expect(store.visibleOrder(spaceId)).toEqual(todayByPosition(store, spaceId))
    expect(store.visibleOrder(spaceId)).toEqual([z.id, x.id, a.id, w.id])
    expect(store.snapshot().tabs.find((t) => t.id === a.id)?.parentId).toBe(x.id)
  })

  it('moving a child within today un-nests it', () => {
    const { store, spaceId } = setup()
    const x = store.openTab(spaceId, 'x')
    const z = store.openTab(spaceId, 'z')
    const a = store.openTab(spaceId, 'a', { parentId: x.id })
    const b = store.openTab(spaceId, 'b', { parentId: x.id })
    store.moveTab(b.id, { section: 'today', index: 0 })
    expect(store.visibleOrder(spaceId)).toEqual(todayByPosition(store, spaceId))
    expect(store.visibleOrder(spaceId)).toEqual([b.id, x.id, a.id, z.id])
    expect(store.snapshot().tabs.find((t) => t.id === b.id)?.parentId).toBeNull()
  })

  it('a tab dropped inside a subtree in today goes after that subtree', () => {
    const { store, spaceId } = setup()
    const x = store.openTab(spaceId, 'x')
    const z = store.openTab(spaceId, 'z')
    const a = store.openTab(spaceId, 'a', { parentId: x.id })
    const b = store.openTab(spaceId, 'b', { parentId: x.id })
    const p = store.openTab(spaceId, 'p')
    store.moveTab(p.id, { section: 'pinned', index: 0 })
    store.moveTab(z.id, { section: 'today', index: 1 })
    store.moveTab(p.id, { section: 'today', index: 2 })
    expect(store.visibleOrder(spaceId)).toEqual(todayByPosition(store, spaceId))
    expect(store.visibleOrder(spaceId)).toEqual([x.id, a.id, b.id, p.id, z.id])
  })

  it('reopenClosed on an empty stack returns null', () => {
    const { store } = setup()
    expect(store.reopenClosed()).toBeNull()
  })
})
