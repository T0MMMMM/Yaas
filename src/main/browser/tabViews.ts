// One WebContentsView per tab, laid over the UI. The model lives in BrowserStore; this class only
// mirrors it: creates views lazily, shows the active one, and reports what the pages do.
import {
  clipboard,
  Menu,
  WebContentsView,
  type BrowserWindow,
  type MenuItem,
  type MenuItemConstructorOptions,
  type WebContents,
} from 'electron'
import { pageMenu, type PageMenuId } from '@core/browser/pageMenu'
import type { BrowserStore } from '@core/browser/browserStore'
import type { PageBounds, TabRuntime } from '@shared/ipc/contract'
import type { BrowserSnapshot } from '@shared/model'
import { DEFAULT_SEARCH } from '@shared/url'
import type { SpaceSessions } from './spaceSessions'

/** Corner radius of the page. Must equal `--radius-lg` in tokens.css. */
export const PAGE_RADIUS = 9

interface TabView {
  view: WebContentsView
  spaceId: string
}

const PAGE_MENU_LABELS: Record<PageMenuId, string> = {
  openLinkInNewTab: 'Open Link in New Tab',
  copyLink: 'Copy Link',
  openImageInNewTab: 'Open Image in New Tab',
  copyImage: 'Copy Image',
  copyImageAddress: 'Copy Image Address',
  cut: 'Cut',
  copy: 'Copy',
  paste: 'Paste',
  selectAll: 'Select All',
  searchSelection: 'Search Google',
  back: 'Back',
  forward: 'Forward',
  reload: 'Reload',
  inspect: 'Inspect',
}

const isWebUrl = (url: string): boolean => {
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

export class TabViews {
  private readonly views = new Map<string, TabView>()
  private readonly state = new Map<string, TabRuntime>()
  private bounds: PageBounds = { x: 0, y: 0, width: 0, height: 0 }
  private visible = true
  private shownTabId: string | null = null

  constructor(
    private readonly win: BrowserWindow,
    private readonly store: BrowserStore,
    private readonly sessions: SpaceSessions,
    private readonly onRuntime: () => void,
    /** Called after a view joins the window, so the overlay can go back on top. */
    private readonly onViewAdded: () => void = () => undefined,
  ) {
    // A view's web contents outlive its window unless closed: their renderers would hold up quit.
    win.on('closed', () => {
      for (const { view } of this.views.values()) view.webContents.close()
      this.views.clear()
      this.state.clear()
    })
  }

  /** Mirrors the model: drops views of closed tabs, creates and shows the active tab's view. */
  sync(snapshot: BrowserSnapshot): void {
    const tabs = new Map(snapshot.tabs.map((t) => [t.id, t]))
    for (const [tabId, entry] of this.views) {
      const tab = tabs.get(tabId)
      if (tab) entry.spaceId = tab.spaceId
      else this.destroy(tabId)
    }

    const activeId = snapshot.activeTabIds[snapshot.activeSpaceId] ?? null
    const active = activeId ? tabs.get(activeId) : undefined
    if (active && !this.views.has(active.id)) this.create(active.id, active.spaceId, active.url)
    const shown = active?.id ?? null
    if (shown !== this.shownTabId && shown) this.selectForExtensions(shown)
    this.shownTabId = shown
    this.layout()
  }

  webContentsOf(tabId: string): WebContents | null {
    return this.views.get(tabId)?.view.webContents ?? null
  }

  /** The tab shown by these web contents, or null when they are not a tab. */
  tabIdOf(contents: WebContents): string | null {
    for (const [tabId, { view }] of this.views) if (view.webContents === contents) return tabId
    return null
  }

  setBounds(bounds: PageBounds): void {
    this.bounds = bounds
    this.layout()
  }

  setVisible(visible: boolean): void {
    this.visible = visible
    this.layout()
  }

  navigate(tabId: string, url: string): void {
    const entry = this.views.get(tabId)
    // A tab without a view yet loads its stored URL when it is first shown.
    if (!entry) this.store.updateTab(tabId, { url })
    else void entry.view.webContents.loadURL(url).catch(() => undefined)
  }

  goBack(tabId: string): void {
    const history = this.views.get(tabId)?.view.webContents.navigationHistory
    if (history?.canGoBack()) history.goBack()
  }

  goForward(tabId: string): void {
    const history = this.views.get(tabId)?.view.webContents.navigationHistory
    if (history?.canGoForward()) history.goForward()
  }

  reload(tabId: string): void {
    this.views.get(tabId)?.view.webContents.reload()
  }

  /** Runtime state of every tab that has a view, keyed by tab id (plain, serializable). */
  runtime(): Record<string, TabRuntime> {
    return Object.fromEntries([...this.state].map(([id, r]) => [id, { ...r }]))
  }

  private layout(): void {
    for (const [tabId, { view }] of this.views) {
      const shown = this.visible && tabId === this.shownTabId
      if (shown) view.setBounds(this.bounds)
      view.setVisible(shown)
    }
  }

  /** Tells the space's extensions which tab is active (`chrome.tabs`, actions). */
  private selectForExtensions(tabId: string): void {
    const entry = this.views.get(tabId)
    if (entry) this.sessions.extensionsFor(entry.spaceId)?.selectTab(entry.view.webContents)
  }

  private create(tabId: string, spaceId: string, url: string): void {
    const view = new WebContentsView({
      webPreferences: {
        session: this.sessions.get(spaceId),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    })
    view.setBorderRadius(PAGE_RADIUS)
    view.setVisible(false)
    this.views.set(tabId, { view, spaceId })
    this.state.set(tabId, {
      loading: false,
      canGoBack: false,
      canGoForward: false,
      themeColor: null,
      webContentsId: view.webContents.id,
    })
    this.win.contentView.addChildView(view)
    this.onViewAdded()
    this.sessions.extensionsFor(spaceId)?.addTab(view.webContents, this.win)
    this.wire(tabId, view)
    void view.webContents.loadURL(url).catch(() => undefined)
  }

  private destroy(tabId: string): void {
    const entry = this.views.get(tabId)
    if (!entry) return
    this.views.delete(tabId)
    this.state.delete(tabId)
    this.win.contentView.removeChildView(entry.view)
    entry.view.webContents.close()
  }

  private wire(tabId: string, view: WebContentsView): void {
    const contents = view.webContents
    // Events can still arrive while a closed tab's view is torn down.
    const update = (patch: Parameters<BrowserStore['updateTab']>[1]): void => {
      if (this.views.has(tabId)) this.store.updateTab(tabId, patch)
    }
    const setRuntime = (patch: Partial<TabRuntime>): void => {
      const current = this.state.get(tabId)
      if (!current) return
      this.state.set(tabId, { ...current, ...patch })
      this.onRuntime()
    }
    const updateHistory = (): void =>
      setRuntime({
        canGoBack: contents.navigationHistory.canGoBack(),
        canGoForward: contents.navigationHistory.canGoForward(),
      })

    contents.on('did-navigate', (_event, url) => {
      update({ url })
      updateHistory()
    })
    contents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
      if (!isMainFrame) return
      update({ url })
      updateHistory()
    })
    contents.on('page-title-updated', (_event, title) => update({ title }))
    contents.on('page-favicon-updated', (_event, favicons) =>
      update({ faviconUrl: favicons[0] ?? null }),
    )
    contents.on('did-start-loading', () => setRuntime({ loading: true }))
    contents.on('did-stop-loading', () => setRuntime({ loading: false }))
    contents.on('did-change-theme-color', (_event, color) => setRuntime({ themeColor: color }))

    // Popups and target=_blank become tabs in the same space, never windows.
    contents.setWindowOpenHandler(({ url }) => {
      const entry = this.views.get(tabId)
      if (entry && isWebUrl(url)) this.store.openTab(entry.spaceId, url)
      return { action: 'deny' }
    })
    contents.on('will-navigate', (event, url) => {
      if (!isWebUrl(url)) event.preventDefault()
    })
    contents.on('context-menu', (_event, params) => this.showPageMenu(tabId, contents, params))
  }

  /** Right-click on a page: Electron shows nothing by default. */
  private showPageMenu(
    tabId: string,
    contents: WebContents,
    params: Electron.ContextMenuParams,
  ): void {
    const openInTab = (url: string): void => {
      const entry = this.views.get(tabId)
      if (entry && isWebUrl(url)) this.store.openTab(entry.spaceId, url)
    }
    const run: Record<PageMenuId, () => void> = {
      openLinkInNewTab: () => openInTab(params.linkURL),
      copyLink: () => clipboard.writeText(params.linkURL),
      openImageInNewTab: () => openInTab(params.srcURL),
      copyImage: () => contents.copyImageAt(params.x, params.y),
      copyImageAddress: () => clipboard.writeText(params.srcURL),
      cut: () => contents.cut(),
      copy: () => contents.copy(),
      paste: () => contents.paste(),
      selectAll: () => contents.selectAll(),
      searchSelection: () =>
        openInTab(DEFAULT_SEARCH.replace('%s', encodeURIComponent(params.selectionText.trim()))),
      back: () => this.goBack(tabId),
      forward: () => this.goForward(tabId),
      reload: () => this.reload(tabId),
      inspect: () => contents.inspectElement(params.x, params.y),
    }
    const entries = pageMenu({
      linkURL: params.linkURL,
      srcURL: params.srcURL,
      mediaType: params.mediaType,
      selectionText: params.selectionText,
      isEditable: params.isEditable,
      canCut: params.editFlags.canCut,
      canCopy: params.editFlags.canCopy,
      canPaste: params.editFlags.canPaste,
      canGoBack: contents.navigationHistory.canGoBack(),
      canGoForward: contents.navigationHistory.canGoForward(),
    })
    const template: (MenuItemConstructorOptions | MenuItem)[] = entries.map(
      (entry): MenuItemConstructorOptions =>
        entry === 'separator'
          ? { type: 'separator' }
          : { label: PAGE_MENU_LABELS[entry.id], enabled: entry.enabled, click: run[entry.id] },
    )
    // `chrome.contextMenus` items of the space's extensions, in their own group before Inspect
    // (always the last entry, after a separator).
    const spaceId = this.views.get(tabId)?.spaceId
    const extensionItems = spaceId
      ? (this.sessions.extensionsFor(spaceId)?.getContextMenuItems(contents, params) ?? [])
      : []
    if (extensionItems.length > 0) {
      template.splice(template.length - 1, 0, ...extensionItems, { type: 'separator' })
    }
    Menu.buildFromTemplate(template).popup({ window: this.win })
  }
}
