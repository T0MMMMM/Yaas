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
  const muted = new Set<string>()
  const host: SidebarMenuHost = {
    store,
    closeTab: vi.fn(),
    reloadTab: vi.fn(),
    isMuted: vi.fn((id: string) => muted.has(id)),
    setMuted: vi.fn((id: string, value: boolean) => {
      if (value) muted.add(id)
      else muted.delete(id)
    }),
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

/** Every leaf and parent item in a menu tree, submenus included. */
function allItems(items: MenuItemDef[]): Extract<MenuItemDef, { kind: 'item' }>[] {
  return items.flatMap((item) =>
    item.kind === 'item' ? [item, ...(item.submenu ? allItems(item.submenu) : [])] : [],
  )
}

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

  it("leaves a split's second half out (the pair is one row)", () => {
    const { store, spaceId } = setup()
    const a = store.openTab(spaceId, 'a')
    const b = store.openTab(spaceId, 'b')
    store.moveTab(a.id, { section: 'pinned', index: 0 })
    store.moveTab(b.id, { section: 'pinned', index: 1 })
    store.splitTabs(a.id, b.id)
    expect(endOf(store.snapshot(), spaceId, 'pinned', null)).toBe(1)
  })
})

describe('tabMenu', () => {
  it('lists rows in order with an icon on every row', () => {
    const { store, host, spaceId } = setup()
    store.createFolder(spaceId, 'Reading')
    const tab = store.openTab(spaceId, 'https://a.test/')
    const items = tabMenu(host, tab.id)
    expect(labels(items)).toEqual([
      'Reload',
      'Duplicate',
      'Mute',
      'Copy Link',
      'separator',
      'Pin',
      'Add to Favourites',
      'Move to Folder',
      'separator',
      'Close Tabs Below',
      'Close',
    ])
    expect(labels(find(items, 'Move to Folder').submenu)).toEqual([
      'Reading',
      'separator',
      'New Folder…',
    ])
    expect(find(items, 'Close Tabs Below').enabled).toBe(false)
    for (const item of allItems(items)) {
      expect(item.icon).toMatch(/^[A-Z][A-Za-z0-9]*$/)
    }
    find(items, 'Reload').run?.()
    expect(host.reloadTab).toHaveBeenCalledWith(tab.id)
    find(items, 'Pin').run?.()
    expect(store.snapshot().tabs.find((t) => t.id === tab.id)?.section).toBe('pinned')
  })

  it('toggles Mute / Unmute through the host and disables Reload and Mute when unloaded', () => {
    const { store, host, spaceId } = setup()
    const tab = store.openTab(spaceId, 'https://a.test/')
    find(tabMenu(host, tab.id), 'Mute').run?.()
    expect(host.setMuted).toHaveBeenCalledWith(tab.id, true)
    const after = tabMenu(host, tab.id)
    expect(labels(after)).toContain('Unmute')
    find(after, 'Unmute').run?.()
    expect(host.setMuted).toHaveBeenCalledWith(tab.id, false)

    // Unloaded tab (no view): host.isMuted returns null, disabling Reload and Mute.
    vi.mocked(host.isMuted).mockReturnValueOnce(null)
    const unloaded = tabMenu(host, tab.id)
    expect(find(unloaded, 'Reload').enabled).toBe(false)
    expect(find(unloaded, 'Mute').enabled).toBe(false)
  })

  it('Close Tabs Below closes today tabs drawn after it (subtree first) and disables when none', () => {
    const { store, host, spaceId } = setup()
    const a = store.openTab(spaceId, 'https://a.test/')
    store.openTab(spaceId, 'https://a1.test/', { parentId: a.id })
    const b = store.openTab(spaceId, 'https://b.test/')

    expect(find(tabMenu(host, b.id), 'Close Tabs Below').enabled).toBe(false)
    const items = tabMenu(host, a.id)
    expect(find(items, 'Close Tabs Below').enabled).toBe(true)
    find(items, 'Close Tabs Below').run?.()
    expect(store.snapshot().tabs.map((t) => t.id)).toEqual([a.id])
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

describe('tabMenu and splits', () => {
  it('Open in Split View sits between Mute and Copy Link and splits with the active tab', () => {
    const { store, host, spaceId } = setup()
    const active = store.openTab(spaceId, 'https://a.test/')
    const other = store.openTab(spaceId, 'https://b.test/', { activate: false })
    store.activateTab(active.id)
    const items = tabMenu(host, other.id)
    expect(labels(items).slice(0, 6)).toEqual([
      'Reload',
      'Duplicate',
      'Mute',
      'Open in Split View',
      'Copy Link',
      'separator',
    ])
    expect(labels(items)).not.toContain('Separate')
    find(items, 'Open in Split View').run?.()
    expect(store.snapshot().tabs.find((t) => t.id === other.id)?.splitOf).toBe(active.id)
  })

  it('hides Open in Split View on the active tab and on a split; a split has Separate', () => {
    const { store, host, spaceId } = setup()
    const a = store.openTab(spaceId, 'https://a.test/')
    const b = store.openTab(spaceId, 'https://b.test/')
    const c = store.openTab(spaceId, 'https://c.test/')
    store.activateTab(a.id)
    expect(labels(tabMenu(host, a.id))).not.toContain('Open in Split View')
    store.splitTabs(a.id, b.id)
    for (const id of [a.id, b.id]) {
      expect(labels(tabMenu(host, id))).not.toContain('Open in Split View')
      expect(labels(tabMenu(host, id))).toContain('Separate')
    }
    // The active tab is split: nothing to split another tab with.
    expect(labels(tabMenu(host, c.id))).not.toContain('Open in Split View')
    find(tabMenu(host, b.id), 'Separate').run?.()
    expect(store.snapshot().tabs.every((t) => t.splitOf === null)).toBe(true)
  })
})

describe('folderMenu', () => {
  const anchor = { x: 10, y: 20, width: 200, height: 28 }

  it('lists Rename, Change Icon…, Move to Folder, Open All, separator, Delete Folder with icons', () => {
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
      'Open All',
      'separator',
      'Delete Folder',
    ])
    for (const item of allItems(items)) {
      expect(item.icon).toMatch(/^[A-Z][A-Za-z0-9]*$/)
    }
    // Empty folder: Open All is disabled.
    expect(find(items, 'Open All').enabled).toBe(false)

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

  it('Open All opens the tabs inside the folder into today', () => {
    const { store, host, spaceId } = setup()
    const folder = store.createFolder(spaceId, 'Reading')
    const t = store.openTab(spaceId, 'https://a.test/')
    store.moveTab(t.id, { section: 'pinned', folderId: folder.id, index: 0 })

    const items = folderMenu(host, folder.id, anchor)
    expect(find(items, 'Open All').enabled).toBe(true)
    find(items, 'Open All').run?.()
    expect(
      store
        .snapshot()
        .tabs.filter((x) => x.section === 'today')
        .map((x) => x.url),
    ).toEqual(['https://a.test/'])
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

  it('lists the filter, the space actions with icons, and Delete Space… disabled for the last space', () => {
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
    for (const item of allItems(items)) {
      expect(item.icon).toMatch(/^[A-Z][A-Za-z0-9]*$/)
    }
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
