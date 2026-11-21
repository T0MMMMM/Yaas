/* global chrome */
// A context-menu item with one child; a click on the child is recorded in storage, where the e2e
// reads it through the extension page. `create` ignores an id it already has (a restarted worker).
chrome.contextMenus.create({ id: 'parent', title: 'Fixture Menu', contexts: ['all'] })
chrome.contextMenus.create({
  id: 'child',
  parentId: 'parent',
  title: 'Fixture Child',
  contexts: ['all'],
})
chrome.contextMenus.onClicked.addListener((info, tab) => {
  void chrome.storage.local.set({
    clicked: { menuItemId: info.menuItemId, pageUrl: info.pageUrl, tabUrl: tab?.url ?? null },
  })
})
