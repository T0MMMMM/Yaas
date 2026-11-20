// Right-click on a sidebar row: its native menu, popped at the pointer by main (a native menu
// floats over the page view).

/** Pin, favourites, folders, copy, close. */
export function showTabMenu(tabId: string): void {
  void window.acab.invoke('browser.showTabMenu', { tabId })
}

/** Rename, delete. */
export function showFolderMenu(folderId: string): void {
  void window.acab.invoke('browser.showFolderMenu', { folderId })
}
