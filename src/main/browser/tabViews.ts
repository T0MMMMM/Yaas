// One WebContentsView per tab, laid over the UI. The model lives in BrowserStore; this class only
// mirrors it: creates views lazily, shows the active one, and reports what the pages do.
import { clipboard, WebContentsView, type BrowserWindow, type WebContents } from 'electron'
import type { HistoryStore } from '@core/browser/historyStore'
import { FAVICON_MAX_BYTES, faviconDataUrl } from '@core/browser/favicon'
import { pageMenu, type PageMenuId } from '@core/browser/pageMenu'
import type { BrowserStore } from '@core/browser/browserStore'
import { activatesHalf, shownSplit, splitBounds, splitRatioAt } from '@core/browser/splitBounds'
import type { PageBounds, TabRuntime } from '@shared/ipc/contract'
import type { BrowserSnapshot } from '@shared/model'
import { DEFAULT_SEARCH, hostOf } from '@shared/url'
import { clickLikeElectron, toMenuItemDefs } from '../menus/fromElectron'
import type { MenuItemDef, MenuWhere } from '../menus/menuRegistry'
import type { SpaceSessions } from './spaceSessions'

/** Corner radius of the page. Must equal `--radius-lg` in tokens.css. */
export const PAGE_RADIUS = 9

/** Space between the two pages of a split, where the divider shows. Must equal `--split-gap`. */
export const SPLIT_GAP = 5

interface TabView {
  view: WebContentsView
  spaceId: string
}

type FixedPageMenuId = Exclude<PageMenuId, `suggestion:${number}`>

const PAGE_MENU_LABELS: Record<FixedPageMenuId, string> = {
  noSuggestions: 'No Suggestions',
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

/** Live state of a tab without a view. */
const UNLOADED: TabRuntime = {
  loading: false,
  canGoBack: false,
  canGoForward: false,
  themeColor: null,
  webContentsId: null,
  loaded: false,
}

/** How long a favicon request may take before the tab keeps no icon. */
const FAVICON_TIMEOUT_MS = 10_000

/** The body of `response`, or null when it is bigger than `max` bytes (reading stops there). */
async function readCapped(response: Response, max: number): Promise<Uint8Array | null> {
  if (Number(response.headers.get('content-length') ?? 0) > max) {
    await response.body?.cancel()
    return null
  }
  const reader = response.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return Buffer.concat(chunks)
    total += value.length
    if (total > max) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
}

/** Fetches a favicon through the tab's session (its cookies) as a data URL, or null. */
async function fetchFavicon(
  contents: WebContents,
  url: string | undefined,
): Promise<string | null> {
  if (!url || !/^(https?|data):/i.test(url)) return null
  try {
    const response = await contents.session.fetch(url, {
      signal: AbortSignal.timeout(FAVICON_TIMEOUT_MS),
    })
    if (!response.ok) {
      await response.body?.cancel()
      return null
    }
    // One byte over the cap is enough to know the icon is too big.
    const bytes = await readCapped(response, FAVICON_MAX_BYTES)
    return bytes ? faviconDataUrl(response.headers.get('content-type') ?? '', bytes) : null
  } catch {
    return null
  }
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
  /** The active split's halves and ratio, or null when the active tab is shown alone. */
  private split: { firstId: string; secondId: string; ratio: number } | null = null
  /** The ratio a divider drag shows before it is stored, or null. */
  private previewRatio: number | null = null

  constructor(
    private readonly win: BrowserWindow,
    private readonly store: BrowserStore,
    private readonly sessions: SpaceSessions,
    private readonly onRuntime: () => void,
    /** Draws a menu in the overlay (the page's right-click menu); the page gets focus back. */
    private readonly showMenu: (
      where: MenuWhere,
      items: MenuItemDef[],
      returnFocusTo: WebContents,
    ) => void,
    /** Called after a view joins the window, so the overlay can go back on top. */
    private readonly onViewAdded: () => void = () => undefined,
    private readonly history?: HistoryStore,
  ) {
    // A view's web contents outlive its window unless closed: their renderers would hold up quit.
    win.on('closed', () => {
      for (const { view } of this.views.values()) view.webContents.close()
      this.views.clear()
      this.state.clear()
    })
  }

  /**
   * Mirrors the model: drops views of deleted tabs, creates and shows the active tab's view. An
   * unloaded tab is still in the model, so its view goes through `unload` instead.
   */
  sync(snapshot: BrowserSnapshot): void {
    const tabs = new Map(snapshot.tabs.map((t) => [t.id, t]))
    for (const [tabId, entry] of this.views) {
      const tab = tabs.get(tabId)
      if (tab) entry.spaceId = tab.spaceId
      else this.destroy(tabId)
    }

    const activeId = snapshot.activeTabIds[snapshot.activeSpaceId] ?? null
    const active = activeId ? tabs.get(activeId) : undefined
    this.split = active ? shownSplit(snapshot.tabs, active.id) : null
    if (!this.split) this.previewRatio = null
    // Both halves of a split are on screen, so both need a view.
    const onScreen = this.split ? [this.split.firstId, this.split.secondId] : [active?.id]
    for (const id of onScreen) {
      const tab = id ? tabs.get(id) : undefined
      if (tab && !this.views.has(tab.id)) this.create(tab.id, tab.spaceId, tab.url)
    }
    const shown = active?.id ?? null
    if (shown !== this.shownTabId && shown) this.selectForExtensions(shown)
    this.shownTabId = shown
    this.layout()
  }

  /** Destroys a tab's view while its entry stays (a closed favourite or pinned tab). */
  unload(tabId: string): void {
    if (!this.views.has(tabId)) return
    this.destroy(tabId)
    this.onRuntime()
  }

  webContentsOf(tabId: string): WebContents | null {
    return this.views.get(tabId)?.view.webContents ?? null
  }

  /** The tab shown by these web contents, or null when they are not a tab. */
  tabIdOf(contents: WebContents): string | null {
    for (const [tabId, { view }] of this.views) if (view.webContents === contents) return tabId
    return null
  }

  /** Tabs whose view shows a page of one of `hosts`. */
  tabIdsOnHosts(hosts: string[]): string[] {
    return [...this.views]
      .filter(([, { view }]) => {
        const host = hostOf(view.webContents.getURL())
        return host !== null && hosts.includes(host)
      })
      .map(([tabId]) => tabId)
  }

  setBounds(bounds: PageBounds): void {
    this.bounds = bounds
    this.layout()
  }

  /** Lays the active split out at `ratio` without storing it (a divider drag); null ends that. */
  previewSplitRatio(ratio: number | null): void {
    this.previewRatio = this.split ? ratio : null
    this.layout()
  }

  /** The split ratio that puts the divider under window x `x`. */
  splitRatioAt(x: number): number {
    return splitRatioAt(this.bounds, x, SPLIT_GAP)
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

  /** Opens the page's developer tools in their own window, or closes them. */
  toggleDevTools(tabId: string): void {
    const contents = this.views.get(tabId)?.view.webContents
    if (!contents) return
    // Docked tools need a BrowserWindow's own page; a tab is a view, so they open detached.
    if (contents.isDevToolsOpened()) contents.closeDevTools()
    else contents.openDevTools({ mode: 'detach' })
  }

  /** Runtime state of each of `tabIds`, keyed by tab id (plain, serializable). */
  runtime(tabIds: readonly string[]): Record<string, TabRuntime> {
    return Object.fromEntries(tabIds.map((id) => [id, { ...(this.state.get(id) ?? UNLOADED) }]))
  }

  private layout(): void {
    for (const [tabId, { view }] of this.views) {
      const bounds = this.boundsOf(tabId)
      const shown = this.visible && bounds !== null
      if (bounds) view.setBounds(bounds)
      view.setVisible(shown)
    }
  }

  /** Where a tab's page sits: its half of the active split, the whole page box, or null (hidden). */
  private boundsOf(tabId: string): PageBounds | null {
    if (!this.split) return tabId === this.shownTabId ? this.bounds : null
    const halves = splitBounds(this.bounds, this.previewRatio ?? this.split.ratio, SPLIT_GAP)
    if (tabId === this.split.firstId) return halves.first
    if (tabId === this.split.secondId) return halves.second
    return null
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
      loaded: true,
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
    // Events (and favicon requests) can still arrive while a closed or unloaded tab's view is torn
    // down, or after the tab got a new view: only this view's own tab is updated.
    const isCurrent = (): boolean => this.views.get(tabId)?.view === view
    const update = (patch: Parameters<BrowserStore['updateTab']>[1]): void => {
      if (isCurrent()) this.store.updateTab(tabId, patch)
    }
    const setRuntime = (patch: Partial<TabRuntime>): void => {
      const current = this.state.get(tabId)
      if (!current || !isCurrent()) return
      this.state.set(tabId, { ...current, ...patch })
      this.onRuntime()
    }
    const updateHistory = (): void =>
      setRuntime({
        canGoBack: contents.navigationHistory.canGoBack(),
        canGoForward: contents.navigationHistory.canGoForward(),
      })

    // Visits go to the tab's space history: top-level navigations only (not in-page, not frames).
    const spaceId = (): string | undefined => this.views.get(tabId)?.spaceId
    // History must never break navigation (e.g. the space was deleted a moment ago).
    const safeHistory = (write: () => void): void => {
      try {
        write()
      } catch (error) {
        console.warn('Could not record browsing history:', error)
      }
    }
    contents.on('did-navigate', (_event, url) => {
      update({ url })
      updateHistory()
      const space = spaceId()
      if (space && isCurrent()) {
        // An empty title keeps the stored one (the real title arrives with page-title-updated).
        safeHistory(() => this.history?.record(space, url, contents.getTitle()))
      }
    })
    contents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
      if (!isMainFrame) return
      update({ url })
      updateHistory()
    })
    contents.on('page-title-updated', (_event, title) => {
      update({ title })
      const space = spaceId()
      if (space && title && isCurrent()) {
        safeHistory(() => this.history?.setTitle(space, contents.getURL(), title))
      }
    })
    // Only the latest page's icon is kept: an older, slower request is dropped.
    let faviconRequest = 0
    contents.on('page-favicon-updated', (_event, favicons) => {
      const request = ++faviconRequest
      void fetchFavicon(contents, favicons[0]).then((faviconUrl) => {
        if (request === faviconRequest) update({ faviconUrl })
      })
    })
    contents.on('did-start-loading', () => setRuntime({ loading: true }))
    contents.on('did-stop-loading', () => setRuntime({ loading: false }))
    contents.on('did-change-theme-color', (_event, color) => setRuntime({ themeColor: color }))
    // A press or a key in the other half of the split on screen makes it the active tab (the pair
    // stays on screen). Only user input counts: a hidden view's focus (left there before a switch,
    // handed back by the overlay, a page script, a new view) never changes the active tab.
    const activateHalf = (): void => {
      if (isCurrent() && activatesHalf(this.split, this.shownTabId, tabId)) {
        this.store.activateTab(tabId)
      }
    }
    contents.on('before-mouse-event', (_event, mouse) => {
      if (mouse.type === 'mouseDown') activateHalf()
    })
    contents.on('before-input-event', (_event, input) => {
      if (input.type === 'keyDown') activateHalf()
    })

    // Popups and target=_blank become tabs in the same space, nested under this one, never windows.
    contents.setWindowOpenHandler(({ url }) => {
      const entry = this.views.get(tabId)
      if (entry && isWebUrl(url)) this.store.openTab(entry.spaceId, url, { parentId: tabId })
      return { action: 'deny' }
    })
    contents.on('will-navigate', (event, url) => {
      if (!isWebUrl(url)) event.preventDefault()
    })
    contents.on('context-menu', (_event, params) => this.showPageMenu(tabId, contents, params))
  }

  /**
   * Right-click on a page (Electron shows nothing by default): the menu is drawn in the overlay at
   * the pointer. No macOS Look Up / Services.
   */
  private showPageMenu(
    tabId: string,
    contents: WebContents,
    params: Electron.ContextMenuParams,
  ): void {
    const openInTab = (url: string): void => {
      const entry = this.views.get(tabId)
      if (entry && isWebUrl(url)) this.store.openTab(entry.spaceId, url, { parentId: tabId })
    }
    // The page may be gone by the time an item is chosen.
    const live = (run: () => void) => (): void => {
      if (!contents.isDestroyed()) run()
    }
    const run: Record<FixedPageMenuId, () => void> = {
      noSuggestions: () => undefined,
      openLinkInNewTab: () => openInTab(params.linkURL),
      copyLink: () => clipboard.writeText(params.linkURL),
      openImageInNewTab: () => openInTab(params.srcURL),
      copyImage: live(() => contents.copyImageAt(params.x, params.y)),
      copyImageAddress: () => clipboard.writeText(params.srcURL),
      cut: live(() => contents.cut()),
      copy: live(() => contents.copy()),
      paste: live(() => contents.paste()),
      selectAll: live(() => contents.selectAll()),
      searchSelection: () =>
        openInTab(DEFAULT_SEARCH.replace('%s', encodeURIComponent(params.selectionText.trim()))),
      back: () => this.goBack(tabId),
      forward: () => this.goForward(tabId),
      reload: () => this.reload(tabId),
      inspect: live(() => contents.inspectElement(params.x, params.y)),
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
      misspelledWord: params.misspelledWord,
      suggestions: params.dictionarySuggestions,
    })
    const items = entries.map((entry): MenuItemDef => {
      if (entry === 'separator') return { kind: 'separator' }
      const { id, enabled } = entry
      if (id.startsWith('suggestion:')) {
        const word = params.dictionarySuggestions[Number(id.slice('suggestion:'.length))] ?? ''
        return {
          kind: 'item',
          id,
          label: word,
          enabled,
          run: live(() => contents.replaceMisspelling(word)),
        }
      }
      const fixed = id as FixedPageMenuId
      return { kind: 'item', id, label: PAGE_MENU_LABELS[fixed], enabled, run: run[fixed] }
    })
    // `chrome.contextMenus` items of the space's extensions, in their own group before Inspect
    // (always the last entry, after a separator).
    const spaceId = this.views.get(tabId)?.spaceId
    const extensionItems = spaceId
      ? (this.sessions.extensionsFor(spaceId)?.getContextMenuItems(contents, params) ?? [])
      : []
    const defs = toMenuItemDefs(extensionItems, clickLikeElectron(this.win, contents), 'extension')
    // Only when one of them is visible: else two separators would meet before Inspect.
    if (defs.length > 0) items.splice(items.length - 1, 0, ...defs, { kind: 'separator' })
    // `params` are relative to the page; the overlay draws in window coordinates.
    const origin = this.boundsOf(tabId) ?? this.bounds
    this.showMenu({ at: { x: params.x + origin.x, y: params.y + origin.y } }, items, contents)
  }
}
