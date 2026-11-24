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
  icon: string | null
  sectionCollapsed: boolean
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
  /** The pinned folder it is filed in, or null. */
  folderId: string | null
  /** When it was last activated (ISO), or null when it never was. */
  lastActiveAt: string | null
}

/** A row of the sidebar's pinned or today list. */
export type SidebarNode =
  | {
      kind: 'tab'
      tab: TabView
      /** Indent under its parent tab: 0 at the top level, capped at MAX_DEPTH. */
      depth: number
    }
  | {
      kind: 'folder'
      folder: BrowserFolder
      /** Nesting under other folders: 0 at the top of pinned, capped at MAX_FOLDER_INDENT. */
      depth: number
      /** Its tabs and child folders, by their shared position. */
      children: SidebarNode[]
    }
  /** Two tabs shown side by side, drawn as one row in the first's place. */
  | {
      kind: 'split'
      first: TabView
      second: TabView
      /** The first page's share of the width (0.25–0.75). */
      ratio: number
      depth: number
    }
  /** 3+ top-level today tabs of one host, drawn as a folder named after it. Never stored. */
  | { kind: 'auto-folder'; host: string; children: SidebarNode[] }

export interface SidebarSections {
  /** The favourite tiles, by position (a split's first tab stands for the pair). */
  favorites: TabView[]
  /** The second half of each favourite split, by its first tab's id: one tile draws both. */
  favoriteSeconds: ReadonlyMap<string, TabView>
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
  /** The split the active tab is a half of, or null. */
  activeSplit: ActiveSplit | null
  /** The active space's sidebar. */
  sections: SidebarSections
  /** Every stored folder, in any space (the folder icon card finds its folder here). */
  folders: BrowserFolder[]
  /** Every space's tabs, space by space, each space's in drawn order (the tab finder, ⌘K). */
  allTabs: SpaceTab[]
  /**
   * Ids of every open tab, in any space: a row whose tab is still here moved (or its space was
   * left) rather than closed, so it does not animate out.
   */
  openTabIds: ReadonlySet<string>
}

export interface ActiveSplit {
  first: TabView
  second: TabView
  ratio: number
  activeHalf: 'first' | 'second'
}

/** A tab with the space it belongs to. */
export type SpaceTab = TabView & { space: SpaceSummary }

/** A tab without a view (never shown since launch, or unloaded) has no live state. */
const IDLE: TabRuntime = {
  loading: false,
  canGoBack: false,
  canGoForward: false,
  themeColor: null,
  webContentsId: null,
  loaded: false,
}

const toSpace = (s: BrowserSpace): SpaceSummary => ({
  id: s.id,
  label: s.name,
  color: s.color,
  icon: s.icon,
  sectionCollapsed: s.sectionCollapsed,
})

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
    folderId: tab.folderId,
    lastActiveAt: tab.lastActiveAt,
  }
}

/**
 * Tabs most recently active first (the new-tab dock's Recent Tabs); tabs never active come last,
 * in the order given. Returns a new array.
 */
export function recentFirst<T extends { lastActiveAt: string | null }>(tabs: readonly T[]): T[] {
  const time = (t: T) => (t.lastActiveAt === null ? -Infinity : Date.parse(t.lastActiveAt))
  // Array.prototype.sort is stable: ties (never active) keep their order.
  return [...tabs].sort((a, b) => {
    const ta = time(a)
    const tb = time(b)
    return ta === tb ? 0 : tb > ta ? 1 : -1
  })
}

/** Deepest indent of a nested tab. */
export const MAX_DEPTH = 3

/** Deepest indent of a nested folder (the model has no limit). */
export const MAX_FOLDER_INDENT = 4

/** Top-level today tabs of one host from which they are drawn as an automatic folder. */
export const AUTO_FOLDER_MIN = 3

const byPosition = (a: { position: number }, b: { position: number }): number =>
  a.position - b.position

/** Ratio of a split whose first tab stores none. */
const DEFAULT_SPLIT_RATIO = 0.5

/**
 * A space's splits: each second half by its first tab's id. A second half whose first is missing,
 * itself a second half or already paired is not in a split (drawn as a normal tab).
 */
function splitPairs(tabs: BrowserTab[]): Map<string, BrowserTab> {
  const byId = new Map(tabs.map((t) => [t.id, t]))
  const pairs = new Map<string, BrowserTab>()
  for (const tab of [...tabs].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const first = tab.splitOf === null ? undefined : byId.get(tab.splitOf)
    if (first && first.splitOf === null && !pairs.has(first.id)) pairs.set(first.id, tab)
  }
  return pairs
}

/** The row of a list's tab: a split when it is a split's first tab. */
function rowOf(
  tab: BrowserTab,
  depth: number,
  pairs: Map<string, BrowserTab>,
  view: (t: BrowserTab) => TabView,
): SidebarNode {
  const second = pairs.get(tab.id)
  return second
    ? {
        kind: 'split',
        first: view(tab),
        second: view(second),
        ratio: tab.splitRatio ?? DEFAULT_SPLIT_RATIO,
        depth,
      }
    : { kind: 'tab', tab: view(tab), depth }
}

/** The tab standing for a tab or split row in its list (a split's first tab). */
function listTabOf(node: SidebarNode): TabView | null {
  if (node.kind === 'tab') return node.tab
  if (node.kind === 'split') return node.first
  return null
}

/** The host automatic folders group by: lower-cased, without `www.`; null for non-web pages. */
export function autoFolderHost(url: string): string | null {
  return hostOf(url)?.replace(/^www\./, '') ?? null
}

/** Today's tabs as root subtrees (by position), each flattened depth-first like the store. */
function todayTrees(
  tabs: BrowserTab[],
  node: (t: BrowserTab, depth: number) => SidebarNode,
): SidebarNode[][] {
  const ids = new Set(tabs.map((t) => t.id))
  const children = new Map<string | null, BrowserTab[]>()
  for (const tab of [...tabs].sort(byPosition)) {
    const parent = tab.parentId !== null && ids.has(tab.parentId) ? tab.parentId : null
    children.set(parent, [...(children.get(parent) ?? []), tab])
  }
  const flatten = (tab: BrowserTab, level: number): SidebarNode[] => [
    node(tab, Math.min(level, MAX_DEPTH)),
    ...(children.get(tab.id) ?? []).flatMap((child) => flatten(child, level + 1)),
  ]
  return (children.get(null) ?? []).map((root) => flatten(root, 0))
}

/** Root subtrees of a host with AUTO_FOLDER_MIN+ roots become one folder at the first one. */
function withAutoFolders(trees: SidebarNode[][]): SidebarNode[] {
  const hostOfTree = (tree: SidebarNode[]): string | null => {
    const root = tree[0]
    const tab = root ? listTabOf(root) : null
    return tab ? autoFolderHost(tab.url) : null
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
  allTabs: BrowserTab[],
  folders: BrowserFolder[],
  view: (t: BrowserTab) => TabView,
  opts: SidebarOptions,
): SidebarSections {
  const pairs = splitPairs(allTabs)
  const seconds = new Set([...pairs.values()].map((t) => t.id))
  const tabs = allTabs.filter((t) => !seconds.has(t.id))
  const node = (t: BrowserTab, depth: number): SidebarNode => rowOf(t, depth, pairs, view)
  const favoriteTabs = tabs.filter((t) => t.section === 'favorites').sort(byPosition)
  const favorites = favoriteTabs.map(view)
  const favoriteSeconds = new Map(
    favoriteTabs.flatMap((t) => {
      const second = pairs.get(t.id)
      return second ? [[t.id, view(second)] as const] : []
    }),
  )

  const pinned = tabs.filter((t) => t.section === 'pinned')
  const folderIds = new Set(folders.map((f) => f.id))
  // A tab or folder whose folder is unknown is drawn at the top level. Every folder has one
  // parent, so the walk from the top never loops.
  const folderOf = (id: string | null): string | null =>
    id !== null && folderIds.has(id) ? id : null
  /** A pinned list: its folders (each with its own list) and tabs by their shared position. */
  const pinnedList = (parentId: string | null, level: number): SidebarNode[] =>
    [
      ...folders
        .filter((f) => folderOf(f.parentId) === parentId)
        .map((folder) => ({
          position: folder.position,
          node: (): SidebarNode => ({
            kind: 'folder',
            folder,
            depth: Math.min(level, MAX_FOLDER_INDENT),
            children: pinnedList(folder.id, level + 1),
          }),
        })),
      ...pinned
        .filter((t) => folderOf(t.folderId) === parentId)
        .map((t) => ({
          position: t.position,
          node: (): SidebarNode => node(t, 0),
        })),
    ]
      .sort(byPosition)
      .map((item) => item.node())

  const todayTabs = tabs.filter((t) => t.section === 'today')
  const trees = todayTrees(todayTabs, node)
  const todayIds = new Set(todayTabs.map((t) => t.id))
  const parentOf = new Map(
    todayTabs.map((t) => [
      t.id,
      t.parentId !== null && todayIds.has(t.parentId) ? t.parentId : null,
    ]),
  )
  return {
    favorites,
    favoriteSeconds,
    pinned: pinnedList(null, 0),
    today: opts.autoFolders ? withAutoFolders(trees) : trees.flat(),
    todayOrder: trees
      .flat()
      .flatMap((n) => listTabOf(n) ?? [])
      .map((t) => ({
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

/** The tabs of a pinned or today list, in drawn order (folders' tabs and both halves of a split). */
export function tabsOf(nodes: SidebarNode[]): TabView[] {
  return nodes.flatMap((n) => {
    if (n.kind === 'tab') return [n.tab]
    if (n.kind === 'split') return [n.first, n.second]
    return tabsOf(n.children)
  })
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

/**
 * Tabs of a space's sections in drawn order (automatic folders keep their tabs together, a split's
 * second half follows its first).
 */
function drawnTabs(sections: SidebarSections): TabView[] {
  const favorites = sections.favorites.flatMap((f) => {
    const second = sections.favoriteSeconds.get(f.id)
    return second ? [f, second] : [f]
  })
  return [...favorites, ...tabsOf(sections.pinned), ...tabsOf(sections.today)]
}

/** The split the tab `activeId` is a half of, among a space's drawn tabs. */
function activeSplitOf(
  state: BrowserState,
  spaceId: string,
  tabs: TabView[],
  activeId: string | null,
): ActiveSplit | null {
  if (activeId === null) return null
  for (const [firstId, second] of splitPairs(state.tabs.filter((t) => t.spaceId === spaceId))) {
    if (activeId !== firstId && activeId !== second.id) continue
    const first = tabs.find((t) => t.id === firstId)
    const secondView = tabs.find((t) => t.id === second.id)
    const stored = state.tabs.find((t) => t.id === firstId)
    if (!first || !secondView) return null
    return {
      first,
      second: secondView,
      ratio: stored?.splitRatio ?? DEFAULT_SPLIT_RATIO,
      activeHalf: activeId === firstId ? 'first' : 'second',
    }
  }
  return null
}

/**
 * The view with its active split at a divider drag's `preview` ratio (main lays the pages out at it
 * before storing it); unchanged without a preview or a split.
 */
export function withSplitPreview(view: BrowserView, preview: number | null): BrowserView {
  if (preview === null || !view.activeSplit) return view
  return { ...view, activeSplit: { ...view.activeSplit, ratio: preview } }
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
  const allTabs = spaces.flatMap((s) =>
    (s.id === space.id ? tabs : drawnTabs(sidebarSections(state, s.id, opts))).map((t) => ({
      ...t,
      space: s,
    })),
  )
  return {
    spaces,
    space,
    tabs,
    activeTab: tabs.find((t) => t.id === activeId) ?? null,
    activeSplit: activeSplitOf(state, space.id, tabs, activeId),
    sections,
    folders: state.folders,
    allTabs,
    openTabIds: new Set(allTabs.map((t) => t.id)),
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
