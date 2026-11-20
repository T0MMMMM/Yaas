// Native context menus of the sidebar's tabs and folders, popped at the pointer by main (a native
// menu floats over the page view, which a renderer popover can't).
import { clipboard, Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { BrowserError, type BrowserStore } from '@core/browser/browserStore'
import type { Shortcut } from '@shared/ipc/contract'
import type { BrowserSnapshot, BrowserTab, TabSection } from '@shared/model'

/** Name of a folder made from a tab's menu; the sidebar then edits it. */
export const NEW_FOLDER_NAME = 'New Folder'

export interface SidebarMenuHost {
  store: BrowserStore
  window: () => BrowserWindow | null
  /** The user's close (unloads a favourite or pinned tab). */
  closeTab: (tabId: string) => void
  emitShortcut: (shortcut: Shortcut) => void
}

/** Index just past the last entry of a list (pinned's top level counts its folders). */
function endOf(
  snapshot: BrowserSnapshot,
  spaceId: string,
  section: TabSection,
  folderId: string | null,
): number {
  const tabs = snapshot.tabs.filter(
    (t) => t.spaceId === spaceId && t.section === section && t.folderId === folderId,
  ).length
  const folders =
    section === 'pinned' && folderId === null
      ? snapshot.folders.filter((f) => f.spaceId === spaceId).length
      : 0
  return tabs + folders
}

/**
 * The tab or folder can vanish while its menu is open (closed by a shortcut, a page, another
 * window): the click then does nothing instead of throwing in main.
 */
function ignoreVanished(items: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  return items.map((item) => {
    const { click, submenu } = item
    return {
      ...item,
      ...(click && {
        click: (...args: Parameters<typeof click>) => {
          try {
            click(...args)
          } catch (error) {
            if (!(error instanceof BrowserError)) throw error
          }
        },
      }),
      ...(Array.isArray(submenu) && { submenu: ignoreVanished(submenu) }),
    }
  })
}

function popup(host: SidebarMenuHost, template: MenuItemConstructorOptions[]): void {
  const win = host.window()
  if (win) Menu.buildFromTemplate(ignoreVanished(template)).popup({ window: win })
}

function tabMenu(host: SidebarMenuHost, tab: BrowserTab): MenuItemConstructorOptions[] {
  const { store } = host
  const snapshot = store.snapshot()
  const move = (section: TabSection, folderId: string | null, index: number) => (): void =>
    store.moveTab(tab.id, { section, folderId, index })
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
      ? { label: 'Unpin', click: move('today', null, 0) }
      : {
          label: 'Pin',
          click: move('pinned', null, endOf(snapshot, tab.spaceId, 'pinned', null)),
        },
    tab.section === 'favorites'
      ? { label: 'Remove from Favourites', click: move('today', null, 0) }
      : {
          label: 'Add to Favourites',
          click: move('favorites', null, endOf(snapshot, tab.spaceId, 'favorites', null)),
        },
    {
      label: 'Move to Folder',
      submenu: [
        ...folders.map((folder): MenuItemConstructorOptions => ({
          label: folder.name,
          enabled: folder.id !== tab.folderId,
          click: move('pinned', folder.id, endOf(snapshot, tab.spaceId, 'pinned', folder.id)),
        })),
        ...(folders.length > 0 ? [{ type: 'separator' } as const] : []),
        { label: 'New Folder…', click: newFolder },
      ],
    },
    { label: 'Copy Link', click: () => clipboard.writeText(tab.url) },
    { label: 'Duplicate', click: () => store.openTab(tab.spaceId, tab.url) },
    { type: 'separator' },
    kept
      ? { label: 'Remove', click: () => store.removeTab(tab.id) }
      : { label: 'Close', click: () => host.closeTab(tab.id) },
  ]
}

/** Pops the tab's menu: pin, favourites, folder, copy, duplicate, then remove or close. */
export function showTabMenu(host: SidebarMenuHost, tabId: string): void {
  const tab = host.store.snapshot().tabs.find((t) => t.id === tabId)
  if (!tab) throw new Error(`Unknown tab ${tabId}`)
  popup(host, tabMenu(host, tab))
}

/** Pops the folder's menu: rename (edited in the sidebar) or delete with its tabs. */
export function showFolderMenu(host: SidebarMenuHost, folderId: string): void {
  const exists = (): boolean => host.store.snapshot().folders.some((f) => f.id === folderId)
  if (!exists()) throw new Error(`Unknown folder ${folderId}`)
  popup(host, [
    {
      label: 'Rename',
      click: () => {
        if (exists()) host.emitShortcut({ kind: 'rename-folder', folderId })
      },
    },
    { label: 'Delete Folder', click: () => host.store.deleteFolder(folderId) },
  ])
}
