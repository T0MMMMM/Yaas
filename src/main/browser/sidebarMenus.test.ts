import { describe, expect, it, vi } from 'vitest'
import { BrowserStore } from '@core/browser/browserStore'
import { openDatabase } from '@core/store/database'
import { endOf } from './sidebarMenus'

vi.mock('electron', () => ({ clipboard: {}, Menu: {} }))

describe('endOf', () => {
  it("counts a folder's tabs and child folders, and the top level's own folders only", () => {
    const store = new BrowserStore(openDatabase(':memory:'), {
      defaultSpace: { name: 'Personal', color: '#7C5CFF' },
    })
    const spaceId = store.snapshot().activeSpaceId
    const outer = store.createFolder(spaceId, 'Outer')
    store.createFolder(spaceId, 'Inner', outer.id)
    const tab = store.openTab(spaceId, 'a')
    store.moveTab(tab.id, { section: 'pinned', folderId: outer.id, index: 0 })
    const snapshot = store.snapshot()
    expect(endOf(snapshot, spaceId, 'pinned', outer.id)).toBe(2)
    expect(endOf(snapshot, spaceId, 'pinned', null)).toBe(1)
    expect(endOf(snapshot, spaceId, 'today', null)).toBe(0)
  })
})
