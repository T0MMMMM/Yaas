// The menus of the sidebar's tabs, folders and spaces: main builds the items (and what each
// runs), the overlay draws them at the pointer or from a button (menus/menuRegistry).
import { clipboard } from 'electron'
import { BrowserError, type BrowserStore } from '@core/browser/browserStore'
import type { OverlayRequest, PageBounds, Shortcut } from '@shared/ipc/contract'
import type { BrowserSnapshot, TabSection } from '@shared/model'
import type { MenuItemDef } from '../menus/menuRegistry'

/** Name of a folder made from a tab's menu; the sidebar then edits it. */
export const NEW_FOLDER_NAME = 'New Folder'

export interface SidebarMenuHost {
  store: BrowserStore
  /** The user's close (unloads a favourite or pinned tab). */
  closeTab: (tabId: string) => void
  emitShortcut: (shortcut: Shortcut) => void
  /** Shows a card in the overlay (a space's icon or colour, a confirmation). */
  openOverlay: (request: OverlayRequest) => void
}

/** Index just past the last entry of a list (a pinned list counts its child folders). */
export function endOf(
  snapshot: BrowserSnapshot,
  spaceId: string,
  section: TabSection,
  folderId: string | null,
): number {
  const tabs = snapshot.tabs.filter(
    (t) => t.spaceId === spaceId && t.section === section && t.folderId === folderId,
  ).length
  const folders =
    section === 'pinned'
      ? snapshot.folders.filter((f) => f.spaceId === spaceId && f.parentId === folderId).length
      : 0
  return tabs + folders
}

/** The ids of `folderId` and of every folder under it. */
function subtreeOf(snapshot: BrowserSnapshot, folderId: string): Set<string> {
  const ids = new Set([folderId])
  let grew = true
  while (grew) {
    grew = false
    for (const folder of snapshot.folders) {
      if (folder.parentId !== null && ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id)
        grew = true
      }
    }
  }
  return ids
}

/** Pin, favourites, folder, copy, duplicate, then remove or close. */
export function tabMenu(host: SidebarMenuHost, tabId: string): MenuItemDef[] {
  const { store } = host
  const snapshot = store.snapshot()
  const tab = snapshot.tabs.find((t) => t.id === tabId)
  if (!tab) throw new BrowserError('not_found', `Unknown tab ${tabId}`)
  // Read the store when the action runs: the sidebar may change while the menu is open.
  const move = (section: TabSection, folderId: string | null) => (): void =>
    store.moveTab(tab.id, {
      section,
      folderId,
      index: section === 'today' ? 0 : endOf(store.snapshot(), tab.spaceId, section, folderId),
    })
  const folders = snapshot.folders.filter((f) => f.spaceId === tab.spaceId)
  const newFolder = (): void => {
    // Checked first so a vanished tab leaves no empty folder behind.
    if (!store.snapshot().tabs.some((t) => t.id === tab.id)) return
    const folder = store.createFolder(tab.spaceId, NEW_FOLDER_NAME)
    store.moveTab(tab.id, { section: 'pinned', folderId: folder.id, index: 0 })
    host.emitShortcut({ kind: 'rename-folder', folderId: folder.id })
  }
  const kept = tab.section !== 'today'
  return [
    tab.section === 'pinned'
      ? {
          kind: 'item',
          id: 'unpin',
          label: 'Unpin',
          icon: 'PushPinSlash',
          run: move('today', null),
        }
      : { kind: 'item', id: 'pin', label: 'Pin', icon: 'PushPin', run: move('pinned', null) },
    tab.section === 'favorites'
      ? {
          kind: 'item',
          id: 'unfavourite',
          label: 'Remove from Favourites',
          icon: 'Star',
          run: move('today', null),
        }
      : {
          kind: 'item',
          id: 'favourite',
          label: 'Add to Favourites',
          icon: 'Star',
          run: move('favorites', null),
        },
    {
      kind: 'item',
      id: 'move-to-folder',
      label: 'Move to Folder',
      icon: 'FolderSimple',
      submenu: [
        ...folders.map((folder): MenuItemDef => ({
          kind: 'item',
          id: `folder:${folder.id}`,
          label: folder.name,
          icon: 'FolderSimple',
          enabled: folder.id !== tab.folderId,
          checked: folder.id === tab.folderId,
          run: move('pinned', folder.id),
        })),
        ...(folders.length > 0 ? [{ kind: 'separator' } as const] : []),
        {
          kind: 'item',
          id: 'new-folder',
          label: 'New Folder…',
          icon: 'FolderSimplePlus',
          run: newFolder,
        },
      ],
    },
    {
      kind: 'item',
      id: 'copy-link',
      label: 'Copy Link',
      icon: 'LinkSimple',
      run: () => clipboard.writeText(tab.url),
    },
    {
      kind: 'item',
      id: 'duplicate',
      label: 'Duplicate',
      icon: 'CopySimple',
      run: () => {
        if (store.snapshot().tabs.some((t) => t.id === tab.id)) store.openTab(tab.spaceId, tab.url)
      },
    },
    { kind: 'separator' },
    kept
      ? {
          kind: 'item',
          id: 'remove',
          label: 'Remove',
          icon: 'Trash',
          run: () => store.removeTab(tab.id),
        }
      : { kind: 'item', id: 'close', label: 'Close', icon: 'X', run: () => host.closeTab(tab.id) },
  ]
}

/**
 * Rename (edited in the sidebar), move to the top level or into another folder (never into its own
 * subtree), delete with its contents. Change Icon… comes with the folder icons.
 */
export function folderMenu(host: SidebarMenuHost, folderId: string): MenuItemDef[] {
  const { store } = host
  const snapshot = store.snapshot()
  const folder = snapshot.folders.find((f) => f.id === folderId)
  if (!folder) throw new BrowserError('not_found', `Unknown folder ${folderId}`)
  const exists = (): boolean => store.snapshot().folders.some((f) => f.id === folderId)
  const subtree = subtreeOf(snapshot, folderId)
  const targets = snapshot.folders.filter((f) => f.spaceId === folder.spaceId && !subtree.has(f.id))
  const moveTo = (parentId: string | null) => (): void =>
    store.moveFolder(folderId, {
      parentId,
      index: endOf(store.snapshot(), folder.spaceId, 'pinned', parentId),
    })
  return [
    {
      kind: 'item',
      id: 'rename',
      label: 'Rename',
      icon: 'PencilSimple',
      run: () => {
        if (exists()) host.emitShortcut({ kind: 'rename-folder', folderId })
      },
    },
    {
      kind: 'item',
      id: 'move-to-folder',
      label: 'Move to Folder',
      icon: 'FolderSimple',
      submenu: [
        {
          kind: 'item',
          id: 'top-level',
          label: 'Top level',
          icon: 'ArrowLineUp',
          enabled: folder.parentId !== null,
          checked: folder.parentId === null,
          run: moveTo(null),
        },
        ...(targets.length > 0 ? [{ kind: 'separator' } as const] : []),
        ...targets.map((target): MenuItemDef => ({
          kind: 'item',
          id: `folder:${target.id}`,
          label: target.name,
          icon: 'FolderSimple',
          enabled: target.id !== folder.parentId,
          checked: target.id === folder.parentId,
          run: moveTo(target.id),
        })),
      ],
    },
    { kind: 'separator' },
    {
      kind: 'item',
      id: 'delete',
      label: 'Delete Folder',
      icon: 'Trash',
      run: () => store.deleteFolder(folderId),
    },
  ]
}

/** What a space's Delete Space… asks before anything is deleted. */
export function deleteSpaceMessage(name: string): string {
  return `Delete “${name}”? Its tabs, sign-ins, cookies and extensions will be deleted.`
}

/**
 * The space header's menu (from its "…" button, `anchor`): a filter field, Rename Space… (edited
 * in the header), Change Space Icon… and Edit Look… (cards opened from the same button), New Folder
 * (named in the sidebar), Space Settings…, then Delete Space… behind a confirmation; the last
 * space can't be deleted. ⌘⌫ is only a label: no accelerator.
 */
export function spaceMenu(
  host: SidebarMenuHost,
  spaceId: string,
  anchor: PageBounds,
): MenuItemDef[] {
  const { store } = host
  const snapshot = store.snapshot()
  const space = snapshot.spaces.find((s) => s.id === spaceId)
  if (!space) throw new BrowserError('not_found', `Unknown space ${spaceId}`)
  const exists = (): boolean => store.snapshot().spaces.some((s) => s.id === spaceId)
  /** Runs `run` only if the space is still there when the item is chosen. */
  const live = (run: () => void) => (): void => {
    if (exists()) run()
  }
  return [
    { kind: 'filter' },
    {
      kind: 'item',
      id: 'rename',
      label: 'Rename Space…',
      icon: 'PencilSimple',
      run: live(() => host.emitShortcut({ kind: 'rename-space', spaceId })),
    },
    {
      kind: 'item',
      id: 'icon',
      label: 'Change Space Icon…',
      icon: 'Smiley',
      run: live(() => host.openOverlay({ kind: 'space-icon', anchor, spaceId })),
    },
    {
      kind: 'item',
      id: 'look',
      label: 'Edit Look…',
      icon: 'Palette',
      run: live(() => host.openOverlay({ kind: 'space-color', anchor, spaceId })),
    },
    {
      kind: 'item',
      id: 'new-folder',
      label: 'New Folder',
      icon: 'FolderSimplePlus',
      run: () => {
        const folder = store.createFolder(spaceId, NEW_FOLDER_NAME)
        host.emitShortcut({ kind: 'rename-folder', folderId: folder.id })
      },
    },
    {
      kind: 'item',
      id: 'settings',
      label: 'Space Settings…',
      icon: 'GearSix',
      run: () => host.emitShortcut({ kind: 'settings' }),
    },
    { kind: 'separator' },
    {
      kind: 'item',
      id: 'delete',
      label: 'Delete Space…',
      icon: 'Trash',
      shortcut: '⌘⌫',
      enabled: snapshot.spaces.length > 1,
      run: () => {
        const current = store.snapshot().spaces.find((s) => s.id === spaceId)
        if (!current) return
        host.openOverlay({
          kind: 'confirm',
          anchor,
          message: deleteSpaceMessage(current.name),
          confirmLabel: 'Delete',
          action: { kind: 'delete-space', spaceId },
        })
      },
    },
  ]
}
