import { describe, expect, it } from 'vitest'
import { COMMAND_CHANNELS, EVENT_CHANNELS } from './channels'
import { commands, events, TOOLTIP_TEXT_MAX } from './contract'

describe('IPC contract', () => {
  it('declares exactly the channels listed for the preload', () => {
    expect(Object.keys(commands).sort()).toEqual([...COMMAND_CHANNELS].sort())
    expect(Object.keys(events).sort()).toEqual([...EVENT_CHANNELS].sort())
  })

  it('rejects unknown keys and invalid values in settings.update', () => {
    const input = commands['settings.update'].input
    expect(input.safeParse({ transparency: 1 }).success).toBe(true)
    expect(input.safeParse({ accent: 'violet' }).success).toBe(false)
    expect(input.safeParse({ grain: 1.5 }).success).toBe(false)
    expect(input.safeParse({ spaceSwitcherStyle: 'dots' }).success).toBe(true)
    expect(input.safeParse({ spaceSwitcherStyle: 'bars' }).success).toBe(false)
    expect(input.safeParse({ autoArchive: { enabled: true, afterDays: 7 } }).success).toBe(true)
    expect(input.safeParse({ autoArchive: { enabled: true, afterDays: 0 } }).success).toBe(false)
    expect(input.safeParse({ sidebarWidth: 40 }).success).toBe(false)
    expect(input.safeParse({ sidebarWidth: 56 }).success).toBe(true)
    expect(input.safeParse({ sidebarWidth: 200 }).success).toBe(true)
    expect(input.safeParse({ askewCards: false }).success).toBe(true)
    expect(input.safeParse({ contextBarStyle: 'attached' }).success).toBe(true)
    expect(input.safeParse({ contextBarStyle: 'floating' }).success).toBe(false)
    expect(input.safeParse({ nodeIntegration: true }).success).toBe(false)
  })

  it('accepts the ad blocker settings only with their allowed hosts', () => {
    const input = commands['settings.update'].input
    expect(input.safeParse({ adBlock: { enabled: false, allowedHosts: ['a.com'] } }).success).toBe(
      true,
    )
    expect(input.safeParse({ adBlock: { enabled: true } }).success).toBe(false)
  })

  it('accepts only lower-cased hostnames as allowed hosts', () => {
    const input = commands['settings.update'].input
    const allowed = (host: string) =>
      input.safeParse({ adBlock: { enabled: true, allowedHosts: [host] } }).success
    expect(allowed('example.com')).toBe(true)
    expect(allowed('127.0.0.1')).toBe(true)
    for (const bad of ['', 'Example.com', 'a.com$x', 'a.com,b.com', 'a b.com', 'a.com|b.com'])
      expect(allowed(bad)).toBe(false)
  })

  it('rejects a negative page bound', () => {
    const input = commands['browser.setPageBounds'].input
    expect(input.safeParse({ x: 0, y: 0, width: 800, height: 600 }).success).toBe(true)
    expect(input.safeParse({ x: -1, y: 0, width: 800, height: 600 }).success).toBe(false)
  })

  it('rejects an unknown field on browser.openTab', () => {
    const input = commands['browser.openTab'].input
    expect(input.safeParse({ input: 'example.com' }).success).toBe(true)
    expect(input.safeParse({ input: 'example.com', partition: 'x' }).success).toBe(false)
  })

  it('accepts only a known overlay kind with an anchor on overlay.open', () => {
    const input = commands['overlay.open'].input
    const anchor = { x: 0, y: 0, width: 10, height: 10 }
    expect(input.safeParse({ kind: 'site-menu', anchor }).success).toBe(true)
    expect(input.safeParse({ kind: 'new-menu', anchor }).success).toBe(true)
    expect(input.safeParse({ kind: 'popup', anchor }).success).toBe(false)
    expect(input.safeParse({ kind: 'site-menu', anchor, url: 'x' }).success).toBe(false)
    expect(input.safeParse({ kind: 'site-menu' }).success).toBe(false)
  })

  it('opens the tab finder and the command field centred, without an anchor', () => {
    const input = commands['overlay.open'].input
    expect(input.safeParse({ kind: 'tab-finder' }).success).toBe(true)
    expect(input.safeParse({ kind: 'command' }).success).toBe(true)
    const anchor = { x: 0, y: 0, width: 10, height: 10 }
    expect(input.safeParse({ kind: 'command', anchor }).success).toBe(false)
  })

  it('takes a tooltip with an anchor, or null, on overlay.tooltip', () => {
    const input = commands['overlay.tooltip'].input
    const anchor = { x: 0, y: 0, width: 10, height: 10 }
    expect(input.safeParse({ anchor, title: 'A', detail: 'a.com' }).success).toBe(true)
    expect(input.safeParse(null).success).toBe(true)
    expect(input.safeParse({ title: 'A', detail: 'a.com' }).success).toBe(false)
    expect(input.safeParse({ anchor, title: 'A', detail: 'a.com', html: '<b>' }).success).toBe(
      false,
    )
    const long = 'x'.repeat(TOOLTIP_TEXT_MAX + 1)
    expect(input.safeParse({ anchor, title: long, detail: 'a.com' }).success).toBe(false)
    expect(input.safeParse({ anchor, title: 'A', detail: long }).success).toBe(false)
  })

  it.each(['browser.share', 'browser.toggleDevTools'] as const)(
    'accepts only a tab id on %s',
    (channel) => {
      const input = commands[channel].input
      expect(input.safeParse({ tabId: 'x' }).success).toBe(true)
      expect(input.safeParse({ tabId: 'x', url: 'https://a.com' }).success).toBe(false)
      expect(input.safeParse({}).success).toBe(false)
    },
  )

  it('takes no input on browser.openWebStore', () => {
    const input = commands['browser.openWebStore'].input
    expect(input.safeParse(undefined).success).toBe(true)
    expect(input.safeParse({ url: 'https://a.com' }).success).toBe(false)
  })

  it('rejects a bad space color', () => {
    const input = commands['browser.createSpace'].input
    expect(input.safeParse({ name: 'Work', color: '#2BB673' }).success).toBe(true)
    expect(input.safeParse({ name: 'Work', color: 'green' }).success).toBe(false)
  })
  it('accepts only a tab id on browser.removeTab', () => {
    const input = commands['browser.removeTab'].input
    expect(input.safeParse({ tabId: 'x' }).success).toBe(true)
    expect(input.safeParse({ tabId: '' }).success).toBe(false)
    expect(input.safeParse({ tabId: 'x', section: 'pinned' }).success).toBe(false)
  })

  it('takes a tab or folder id and the pointer on the sidebar menus', () => {
    const tab = commands['browser.showTabMenu'].input
    expect(tab.safeParse({ tabId: 'x', at: { x: 10.5, y: 20 } }).success).toBe(true)
    expect(tab.safeParse({ tabId: 'x' }).success).toBe(false)
    expect(tab.safeParse({ tabId: '', at: { x: 0, y: 0 } }).success).toBe(false)
    const folder = commands['browser.showFolderMenu'].input
    expect(folder.safeParse({ folderId: 'f', at: { x: 0, y: 0 } }).success).toBe(true)
    expect(folder.safeParse({ folderId: 'f', at: { x: 'a', y: 0 } }).success).toBe(false)
  })

  it("draws main's menus at a point or from a button", () => {
    const input = commands['overlay.open'].input
    const menu = {
      id: 'm',
      items: [
        { kind: 'filter' },
        {
          kind: 'item',
          id: 'a',
          label: 'A',
          enabled: true,
          icon: 'PushPin',
          submenu: [{ kind: 'item', id: 'b', label: 'B', enabled: false, checked: true }],
        },
        { kind: 'separator' },
        { kind: 'item', id: 'c', label: 'C', enabled: true, icon: 'data:image/png;base64,AA==' },
      ],
    }
    const anchor = { x: 0, y: 0, width: 10, height: 10 }
    expect(input.safeParse({ kind: 'context-menu', at: { x: 1, y: 2 }, menu }).success).toBe(true)
    expect(
      input.safeParse({ kind: 'anchored-menu', anchor, placement: 'below', menu }).success,
    ).toBe(true)
    expect(input.safeParse({ kind: 'context-menu', menu }).success).toBe(false)
    expect(input.safeParse({ kind: 'anchored-menu', anchor, menu }).success).toBe(false)
    const withIcon = (icon: string) => ({
      kind: 'context-menu',
      at: { x: 0, y: 0 },
      menu: { id: 'm', items: [{ kind: 'item', id: 'a', label: 'A', enabled: true, icon }] },
    })
    // An icon is a Phosphor name or an image data URL, nothing a page could load.
    expect(input.safeParse(withIcon('https://evil.test/x.png')).success).toBe(false)
    expect(input.safeParse(withIcon('javascript:alert(1)')).success).toBe(false)
  })

  it('takes a menu id and an item id on overlay.choose', () => {
    const input = commands['overlay.choose'].input
    expect(input.safeParse({ menuId: 'm', itemId: 'pin' }).success).toBe(true)
    expect(input.safeParse({ menuId: 'm' }).success).toBe(false)
    expect(input.safeParse({ menuId: '', itemId: 'pin' }).success).toBe(false)
  })

  it('accepts a known section and a non-negative index on browser.moveTab', () => {
    const input = commands['browser.moveTab'].input
    expect(
      input.safeParse({ tabId: 'x', section: 'pinned', folderId: 'f', index: 0 }).success,
    ).toBe(true)
    expect(
      input.safeParse({ tabId: 'x', section: 'today', folderId: null, index: 3 }).success,
    ).toBe(true)
    expect(input.safeParse({ tabId: 'x', section: 'favorites', index: 1 }).success).toBe(true)
    expect(input.safeParse({ tabId: 'x', section: 'archive', index: 0 }).success).toBe(false)
    expect(input.safeParse({ tabId: 'x', section: 'today', index: -1 }).success).toBe(false)
    expect(input.safeParse({ tabId: 'x', section: 'today', index: 1.5 }).success).toBe(false)
  })

  it('accepts a folder name of 1 to 80 characters on browser.createFolder', () => {
    const input = commands['browser.createFolder'].input
    expect(input.safeParse({ name: 'Work' }).success).toBe(true)
    expect(input.safeParse({ spaceId: 's', name: 'Work' }).success).toBe(true)
    expect(input.safeParse({ name: '' }).success).toBe(false)
    expect(input.safeParse({ name: 'Work', collapsed: true }).success).toBe(false)
  })

  it('accepts a folder name of 1 to 80 characters on browser.renameFolder', () => {
    const input = commands['browser.renameFolder'].input
    expect(input.safeParse({ folderId: 'f', name: 'a'.repeat(80) }).success).toBe(true)
    expect(input.safeParse({ folderId: 'f', name: 'a'.repeat(81) }).success).toBe(false)
    expect(input.safeParse({ folderId: 'f', name: '' }).success).toBe(false)
  })

  it('accepts only a boolean on browser.setFolderCollapsed', () => {
    const input = commands['browser.setFolderCollapsed'].input
    expect(input.safeParse({ folderId: 'f', collapsed: true }).success).toBe(true)
    expect(input.safeParse({ folderId: 'f', collapsed: 'yes' }).success).toBe(false)
  })

  it('accepts only a folder id on browser.deleteFolder', () => {
    const input = commands['browser.deleteFolder'].input
    expect(input.safeParse({ folderId: 'f' }).success).toBe(true)
    expect(input.safeParse({ folderId: 'f', tabId: 'x' }).success).toBe(false)
    expect(input.safeParse({}).success).toBe(false)
  })

  it('takes no input on browser.reopenClosed', () => {
    const input = commands['browser.reopenClosed'].input
    expect(input.safeParse(undefined).success).toBe(true)
    expect(input.safeParse({ tabId: 'x' }).success).toBe(false)
  })

  it('sends shortcuts as kinds, a folder rename with its folder id', () => {
    const shortcut = events['browser.shortcut']
    expect(shortcut.safeParse({ kind: 'focus-address' }).success).toBe(true)
    expect(shortcut.safeParse({ kind: 'rename-folder', folderId: 'f' }).success).toBe(true)
    expect(shortcut.safeParse({ kind: 'rename-folder' }).success).toBe(false)
    expect(shortcut.safeParse('settings').success).toBe(false)
  })

  it('reports whether each tab has a loaded view', () => {
    const runtime = events['browser.changed'].shape.runtime
    const idle = { loading: false, canGoBack: false, canGoForward: false, themeColor: null }
    expect(runtime.safeParse({ a: { ...idle, webContentsId: null, loaded: false } }).success).toBe(
      true,
    )
    expect(runtime.safeParse({ a: { ...idle, webContentsId: 3 } }).success).toBe(false)
  })
})
