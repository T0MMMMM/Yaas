// Right-click on a sidebar row: main builds the row's menu and the overlay draws it at the pointer
// (window coordinates: the overlay covers the whole window, like the UI page).
import type { MouseEvent } from 'react'

const pointer = (e: MouseEvent): { x: number; y: number } => ({ x: e.clientX, y: e.clientY })

/** Pin, favourites, folders, copy, close. A tab gone in the meantime opens nothing. */
export function showTabMenu(tabId: string, e: MouseEvent): void {
  window.bigBrowser.invoke('browser.showTabMenu', { tabId, at: pointer(e) }).catch(() => undefined)
}

/** Rename, move to folder, delete. */
export function showFolderMenu(folderId: string, e: MouseEvent): void {
  window.bigBrowser
    .invoke('browser.showFolderMenu', { folderId, at: pointer(e) })
    .catch(() => undefined)
}
