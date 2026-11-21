import { describe, expect, it, vi } from 'vitest'
import { BrowserStore } from '@core/browser/browserStore'
import { openDatabase } from '@core/store/database'
import type { MenuItemDef } from '../menus/menuRegistry'
import { endOf, folderMenu, spaceMenu, tabMenu, type SidebarMenuHost } from './sidebarMenus'

vi.mock('electron', () => ({ clipboard: { writeText: vi.fn() } }))

function setup() {
  const store = new BrowserStore(openDatabase(':memory:'), {
    defaultSpace: { name: 'Personal', color: '#7C5CFF' },
  })
  const host: SidebarMenuHost = {
    store,
    closeTab: vi.fn(),
    emitShortcut: vi.fn(),
    openOverlay: vi.fn(),
  }
  return { store, host, spaceId: store.snapshot().activeSpaceId }
}

/** The item with `label` anywhere in `items` (submenus included). */
function find(items: MenuItemDef[], label: string): Extract<MenuItemDef, { kind: 'item' }> {
  for (const item of items) {
    if (item.kind !== 'item') continue
    if (item.label === label) return item
    if (item.submenu) {
      try {
        return find(item.submenu, label)
      } catch {
        // not in this submenu
      }
    }
  }
  throw new Error(`No item ${label}`)
}

const labels = (items: MenuItemDef[] | undefined): string[] =>
  (items ?? []).map((item) => (item.kind === 'item' ? item.label : item.kind))

describe('endOf', () => {
  it("counts a folder's tabs and child folders, and the top level's own folders only", () => {
    const { store, spaceId } = setup()
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

describe('tabMenu', () => {
  it('lists pin, favourites, folders, copy, duplicate and close', () => {
    const { store, host, spaceId } = setup()
    store.createFolder(spaceId, 'Reading')
    const tab = store.openTab(spaceId, 'https://a.test/')
    const items = tabMenu(host, tab.id)
    expect(labels(items)).toEqual([
      'Pin',
      'Add to Favourites',
      'Move to Folder',
      'Copy Link',
      'Duplicate',
      'separator',
      'Close',
    ])
    expect(labels(find(items, 'Move to Folder').submenu)).toEqual([
      'Reading',
      'separator',
      'New Folder…',
    ])
    find(items, 'Pin').run?.()
    expect(store.snapshot().tabs.find((t) => t.id === tab.id)?.section).toBe('pinned')
  })

  it('New Folder… files the tab into a new folder and asks the sidebar to name it', () => {
    const { store, host, spaceId } = setup()
    const tab = store.openTab(spaceId, 'https://a.test/')
    find(tabMenu(host, tab.id), 'New Folder…').run?.()
    const [folder] = store.snapshot().folders
    expect(store.snapshot().tabs.find((t) => t.id === tab.id)?.folderId).toBe(folder?.id)
    expect(host.emitShortcut).toHaveBeenCalledWith({ kind: 'rename-folder', folderId: folder?.id })
  })
})

describe('folderMenu', () => {
  const anchor = { x: 10, y: 20, width: 200, height: 28 }

  it('moves a folder to the top level or any folder outside its own subtree', () => {
    const { store, host, spaceId } = setup()
    const outer = store.createFolder(spaceId, 'Outer')
    const inner = store.createFolder(spaceId, 'Inner', outer.id)
    store.createFolder(spaceId, 'Deep', inner.id)
    const other = store.createFolder(spaceId, 'Other')

    const items = folderMenu(host, outer.id, anchor)
    expect(labels(items)).toEqual([
      'Rename',
      'Change Icon…',
      'Move to Folder',
      'separator',
      'Delete Folder',
    ])
    const move = find(items, 'Move to Folder').submenu
    // Not into itself, Inner or Deep (its subtree).
    expect(labels(move)).toEqual(['Top level', 'separator', 'Other'])
    // Already at the top level.
    expect(find(items, 'Top level')).toMatchObject({ enabled: false, checked: true })

    find(items, 'Other').run?.()
    expect(store.snapshot().folders.find((f) => f.id === outer.id)?.parentId).toBe(other.id)

    find(folderMenu(host, inner.id, anchor), 'Top level').run?.()
    expect(store.snapshot().folders.find((f) => f.id === inner.id)?.parentId).toBeNull()
  })

  it('opens the icon card from the folder row', () => {
    const { store, host, spaceId } = setup()
    const folder = store.createFolder(spaceId, 'Reading')
    find(folderMenu(host, folder.id, anchor), 'Change Icon…').run?.()
    expect(host.openOverlay).toHaveBeenCalledWith({
      kind: 'folder-icon',
      anchor,
      folderId: folder.id,
    })
  })

  it('asks the sidebar to rename the folder', () => {
    const { store, host, spaceId } = setup()
    const folder = store.createFolder(spaceId, 'Reading')
    find(folderMenu(host, folder.id, anchor), 'Rename').run?.()
    expect(host.emitShortcut).toHaveBeenCalledWith({ kind: 'rename-folder', folderId: folder.id })
  })
})

describe('spaceMenu', () => {
  const anchor = { x: 10, y: 20, width: 24, height: 24 }

  it('lists the filter, the space actions and Delete Space…, disabled for the last space', () => {
    const { host, spaceId } = setup()
    const items = spaceMenu(host, spaceId, anchor)
    expect(labels(items)).toEqual([
      'filter',
      'Rename Space…',
      'Change Space Icon…',
      'Edit Look…',
      'New Folder',
      'Space Settings…',
      'separator',
      'Delete Space…',
    ])
    expect(find(items, 'Delete Space…')).toMatchObject({ shortcut: '⌘⌫', enabled: false })
  })

  it('renames in the sidebar, opens the icon and colour cards and Settings', () => {
    const { host, spaceId } = setup()
    const items = spaceMenu(host, spaceId, anchor)
    find(items, 'Rename Space…').run?.()
    expect(host.emitShortcut).toHaveBeenCalledWith({ kind: 'rename-space', spaceId })
    find(items, 'Change Space Icon…').run?.()
    expect(host.openOverlay).toHaveBeenCalledWith({ kind: 'space-icon', anchor, spaceId })
    find(items, 'Edit Look…').run?.()
    expect(host.openOverlay).toHaveBeenCalledWith({ kind: 'space-color', anchor, spaceId })
    find(items, 'Space Settings…').run?.()
    expect(host.emitShortcut).toHaveBeenCalledWith({ kind: 'settings' })
  })

  it('New Folder creates a folder in that space and asks the sidebar to name it', () => {
    const { store, host, spaceId } = setup()
    find(spaceMenu(host, spaceId, anchor), 'New Folder').run?.()
    const [folder] = store.snapshot().folders
    expect(folder?.spaceId).toBe(spaceId)
    expect(host.emitShortcut).toHaveBeenCalledWith({ kind: 'rename-folder', folderId: folder?.id })
  })

  it('Delete Space… asks for a confirmation naming the space', () => {
    const { store, host } = setup()
    const work = store.createSpace('Work', '#2D9CDB')
    const items = spaceMenu(host, work.id, anchor)
    expect(find(items, 'Delete Space…').enabled).toBe(true)
    find(items, 'Delete Space…').run?.()
    expect(host.openOverlay).toHaveBeenCalledWith({
      kind: 'confirm',
      anchor,
      message: 'Delete “Work”? Its tabs, sign-ins, cookies and extensions will be deleted.',
      confirmLabel: 'Delete',
      action: { kind: 'delete-space', spaceId: work.id },
    })
    // Nothing is deleted until the card's Delete.
    expect(store.snapshot().spaces).toHaveLength(2)
  })

  it('a vanished space opens no menu', () => {
    const { host } = setup()
    expect(() => spaceMenu(host, 'gone', anchor)).toThrow()
  })
})
