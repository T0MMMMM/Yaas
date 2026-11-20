// Workspace: everything the UI needs to know about spaces and tabs (and, hidden until AI tabs,
// environments and sessions), as ready-to-render views. Components never read the raw data or
// re-derive these rules themselves.
import type { BrowserState, TabRuntime } from '@shared/ipc/contract'
import type { BrowserFolder, BrowserSpace, BrowserTab, SessionStatus } from '@shared/model'
import { displayUrl, hostOf } from '@shared/url'
import type { DemoEnvironment, DemoSession, DemoSpace, DemoUsage } from './demoData'

// ---------- browser ----------

export interface SpaceSummary {
  id: string
  label: string
  color: string
}

export interface TabView {
  id: string
  title: string
  url: string
  faviconUrl: string | null
  /** From displayUrl: shown bright. */
  host: string
  /** From displayUrl: shown dimmed. */
  rest: string
  /** The page's hostname as the site settings key it (ad blocking), or null for non-web pages. */
  siteHost: string | null
  /** https or http; null for any other scheme (about:, chrome-extension:). */
  connection: 'secure' | 'not-secure' | null
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  themeColor: string | null
  /** Id of the tab's web contents in main (extension actions, developer tools), or null. */
  webContentsId: number | null
  /** Main has a view for it: shown since launch and not unloaded since. */
  loaded: boolean
}

/** A row of the sidebar's pinned or today list. */
export type SidebarNode =
  | {
      kind: 'tab'
      tab: TabView
      /** Indent under its parent tab: 0 at the top level, capped at MAX_DEPTH. */
      depth: number
    }
  | { kind: 'folder'; folder: BrowserFolder; children: SidebarNode[] }
  /** 3+ top-level today tabs of one host, drawn as a folder named after it. Never stored. */
  | { kind: 'auto-folder'; host: string; children: SidebarNode[] }

export interface SidebarSections {
  /** The favourite tiles, by position. */
  favorites: TabView[]
  /** Pinned tabs and folders, by their shared position. */
  pinned: SidebarNode[]
  /** The rest, depth-first by parent, with automatic folders when on. */
  today: SidebarNode[]
  /**
   * Today's tabs in the store's drawn order (depth-first, automatic folders ignored): the order
   * `browser.moveTab` counts a today index in. `parentId` is null for a top-level tab.
   */
  todayOrder: TodayEntry[]
}

export interface TodayEntry {
  id: string
  parentId: string | null
}

export interface SidebarOptions {
  autoFolders: boolean
}

export interface BrowserView {
  spaces: SpaceSummary[]
  space: SpaceSummary
  /** The active space's tabs in drawn order (favourites, pinned, today depth-first). */
  tabs: TabView[]
  activeTab: TabView | null
  /** The active space's sidebar. */
  sections: SidebarSections
}

/** A tab without a view (never shown since launch, or unloaded) has no live state. */
const IDLE: TabRuntime = {
  loading: false,
  canGoBack: false,
  canGoForward: false,
  themeColor: null,
  webContentsId: null,
  loaded: false,
}

const toSpace = (s: BrowserSpace): SpaceSummary => ({ id: s.id, label: s.name, color: s.color })

function connectionOf(url: string): TabView['connection'] {
  if (/^https:/i.test(url)) return 'secure'
  if (/^http:/i.test(url)) return 'not-secure'
  return null
}

function toTab(tab: BrowserTab, runtime: TabRuntime | undefined): TabView {
  const { host, rest } = displayUrl(tab.url)
  return {
    id: tab.id,
    title: tab.title || host || 'New tab',
    url: tab.url,
    faviconUrl: tab.faviconUrl,
    host,
    rest,
    siteHost: hostOf(tab.url),
    connection: connectionOf(tab.url),
    ...(runtime ?? IDLE),
  }
}

/** Deepest indent of a nested tab. */
export const MAX_DEPTH = 3

/** Top-level today tabs of one host from which they are drawn as an automatic folder. */
export const AUTO_FOLDER_MIN = 3

const byPosition = (a: { position: number }, b: { position: number }): number =>
  a.position - b.position

/** The host automatic folders group by: lower-cased, without `www.`; null for non-web pages. */
function groupHost(url: string): string | null {
  return hostOf(url)?.replace(/^www\./, '') ?? null
}

/** Today's tabs as root subtrees (by position), each flattened depth-first like the store. */
function todayTrees(tabs: BrowserTab[], view: (t: BrowserTab) => TabView): SidebarNode[][] {
  const ids = new Set(tabs.map((t) => t.id))
  const children = new Map<string | null, BrowserTab[]>()
  for (const tab of [...tabs].sort(byPosition)) {
    const parent = tab.parentId !== null && ids.has(tab.parentId) ? tab.parentId : null
    children.set(parent, [...(children.get(parent) ?? []), tab])
  }
  const flatten = (tab: BrowserTab, level: number): SidebarNode[] => [
    { kind: 'tab', tab: view(tab), depth: Math.min(level, MAX_DEPTH) },
    ...(children.get(tab.id) ?? []).flatMap((child) => flatten(child, level + 1)),
  ]
  return (children.get(null) ?? []).map((root) => flatten(root, 0))
}

/** Root subtrees of a host with AUTO_FOLDER_MIN+ roots become one folder at the first one. */
function withAutoFolders(trees: SidebarNode[][]): SidebarNode[] {
  const hostOfTree = (tree: SidebarNode[]): string | null => {
    const root = tree[0]
    return root?.kind === 'tab' ? groupHost(root.tab.url) : null
  }
  const counts = new Map<string, number>()
  for (const tree of trees) {
    const host = hostOfTree(tree)
    if (host !== null) counts.set(host, (counts.get(host) ?? 0) + 1)
  }
  const folders = new Map<string, SidebarNode & { kind: 'auto-folder' }>()
  const nodes: SidebarNode[] = []
  for (const tree of trees) {
    const host = hostOfTree(tree)
    if (host === null || (counts.get(host) ?? 0) < AUTO_FOLDER_MIN) {
      nodes.push(...tree)
      continue
    }
    let folder = folders.get(host)
    if (!folder) {
      folder = { kind: 'auto-folder', host, children: [] }
      folders.set(host, folder)
      nodes.push(folder)
    }
    folder.children.push(...tree)
  }
  return nodes
}

function sectionsOf(
  tabs: BrowserTab[],
  folders: BrowserFolder[],
  view: (t: BrowserTab) => TabView,
  opts: SidebarOptions,
): SidebarSections {
  const favorites = tabs
    .filter((t) => t.section === 'favorites')
    .sort(byPosition)
    .map(view)

  const pinned = tabs.filter((t) => t.section === 'pinned').sort(byPosition)
  const folderIds = new Set(folders.map((f) => f.id))
  const pinnedItems: { position: number; node: SidebarNode }[] = [
    ...folders.map((folder) => ({
      position: folder.position,
      node: {
        kind: 'folder' as const,
        folder,
        children: pinned
          .filter((t) => t.folderId === folder.id)
          .map((t): SidebarNode => ({ kind: 'tab', tab: view(t), depth: 0 })),
      },
    })),
    ...pinned
      .filter((t) => t.folderId === null || !folderIds.has(t.folderId))
      .map((t) => ({
        position: t.position,
        node: { kind: 'tab' as const, tab: view(t), depth: 0 },
      })),
  ]

  const todayTabs = tabs.filter((t) => t.section === 'today')
  const trees = todayTrees(todayTabs, view)
  const todayIds = new Set(todayTabs.map((t) => t.id))
  const parentOf = new Map(
    todayTabs.map((t) => [
      t.id,
      t.parentId !== null && todayIds.has(t.parentId) ? t.parentId : null,
    ]),
  )
  return {
    favorites,
    pinned: pinnedItems.sort(byPosition).map((item) => item.node),
    today: opts.autoFolders ? withAutoFolders(trees) : trees.flat(),
    todayOrder: tabsOf(trees.flat()).map((t) => ({
      id: t.id,
      parentId: parentOf.get(t.id) ?? null,
    })),
  }
}

/**
 * A space's sidebar: favourite tiles, the pinned list and today. Same order as the store's
 * `visibleOrder`, except that automatic folders regroup today's tabs of a busy host.
 */
export function sidebarSections(
  state: BrowserState,
  spaceId: string,
  opts: SidebarOptions,
): SidebarSections {
  return sectionsOf(
    state.tabs.filter((t) => t.spaceId === spaceId),
    [...state.folders.filter((f) => f.spaceId === spaceId)].sort(byPosition),
    (t) => toTab(t, state.runtime[t.id]),
    opts,
  )
}

/** The tabs of a pinned or today list, in drawn order (folders' tabs included). */
export function tabsOf(nodes: SidebarNode[]): TabView[] {
  return nodes.flatMap((n) => (n.kind === 'tab' ? [n.tab] : tabsOf(n.children)))
}

/** A today tab and its descendants: what moves with it (empty when it is not in today). */
export function todaySubtree(order: TodayEntry[], tabId: string): Set<string> {
  const ids = new Set<string>()
  if (!order.some((t) => t.id === tabId)) return ids
  ids.add(tabId)
  // Depth-first order: a descendant always comes after its parent.
  for (const entry of order) {
    if (entry.parentId !== null && ids.has(entry.parentId)) ids.add(entry.id)
  }
  return ids
}

/**
 * The order "Clear" closes today's tabs in: bottom-up (children before their parents, so ⌘⇧T
 * puts each back under its parent), the active tab last. Closing a tab that is not active never
 * changes the active tab, so no today tab gets activated — and loaded — only to be closed.
 */
export function todayCloseOrder(today: SidebarNode[], activeId: string | null): string[] {
  const ids = tabsOf(today)
    .map((t) => t.id)
    .reverse()
  if (activeId === null || !ids.includes(activeId)) return ids
  return [...ids.filter((id) => id !== activeId), activeId]
}

/** Tabs of the sections in drawn order (automatic folders keep their tabs together). */
function drawnTabs(sections: SidebarSections): TabView[] {
  return [...sections.favorites, ...tabsOf(sections.pinned), ...tabsOf(sections.today)]
}

/** The browser as the chrome shows it: the active space, its sidebar and the active tab. */
export function browserView(
  state: BrowserState,
  opts: SidebarOptions = { autoFolders: true },
): BrowserView {
  const spaces = state.spaces.map(toSpace)
  const space = spaces.find((s) => s.id === state.activeSpaceId) ?? spaces[0]
  // Main always keeps at least one space.
  if (!space) throw new Error('Browser state has no space')

  const sections = sidebarSections(state, space.id, opts)
  const tabs = drawnTabs(sections)
  const activeId = state.activeTabIds[space.id] ?? null
  return {
    spaces,
    space,
    tabs,
    activeTab: tabs.find((t) => t.id === activeId) ?? null,
    sections,
  }
}

// ---------- sessions (hidden until AI tabs) ----------

/** Context window of the models in use (tokens). */
export const CONTEXT_LIMIT = 200_000

export interface SessionView {
  id: string
  title: string
  status: SessionStatus
  contextTokens: number
  contextLimit: number
}

export interface EnvironmentView {
  id: string
  name: string
  path: string
  /** Sessions listed under the folder (pinned sessions of an unpinned folder are moved out). */
  sessions: SessionView[]
}

export type PinnedItem =
  { kind: 'environment'; environment: EnvironmentView } | { kind: 'session'; session: SessionView }

/** The sidebar tree of one space: the pinned section (above the separator) and the rest. */
export interface SidebarTree {
  pinned: PinnedItem[]
  environments: EnvironmentView[]
}

export interface UsageWindowView {
  utilization: number
  resetsAt: Date
}

export interface UsageView {
  session: UsageWindowView
  week: UsageWindowView
}

export interface OpenSessionView {
  session: SessionView
  environment: EnvironmentView
}

const toSession = (s: DemoSession): SessionView => ({
  id: s.id,
  title: s.title,
  status: s.status,
  contextTokens: s.contextTokens,
  contextLimit: CONTEXT_LIMIT,
})

const toEnvironment = (env: DemoEnvironment, keepPinnedSessions: boolean): EnvironmentView => ({
  id: env.id,
  name: env.name,
  path: env.path,
  sessions: env.sessions.filter((s) => keepPinnedSessions || !s.pinned).map(toSession),
})

/**
 * Pinning rules (DESIGN.md §2): a pinned environment goes above the separator with all its
 * sessions; a pinned session of an unpinned environment goes above the separator on its own and
 * leaves its folder.
 */
export function sidebarTree(space: DemoSpace): SidebarTree {
  const pinned: PinnedItem[] = []
  const environments: EnvironmentView[] = []

  for (const env of space.environments) {
    if (env.pinned) {
      pinned.push({ kind: 'environment', environment: toEnvironment(env, true) })
    } else {
      environments.push(toEnvironment(env, false))
    }
  }
  for (const env of space.environments) {
    if (env.pinned) continue
    for (const s of env.sessions)
      if (s.pinned) pinned.push({ kind: 'session', session: toSession(s) })
  }
  return { pinned, environments }
}

/** The open session, if it belongs to this space. */
export function openSession(space: DemoSpace, sessionId: string | null): OpenSessionView | null {
  for (const env of space.environments) {
    const session = env.sessions.find((s) => s.id === sessionId)
    if (session) return { session: toSession(session), environment: toEnvironment(env, true) }
  }
  return null
}

/** Usage windows with absolute reset times, relative to `since`. */
export function usageView(space: DemoSpace, since: number): UsageView {
  const at = (u: DemoUsage): UsageWindowView => ({
    utilization: u.utilization,
    resetsAt: new Date(since + u.minutesLeft * 60_000),
  })
  return { session: at(space.usage.session), week: at(space.usage.week) }
}
