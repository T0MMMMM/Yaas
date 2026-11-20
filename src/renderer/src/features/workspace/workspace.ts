// Workspace: everything the UI needs to know about spaces and tabs (and, hidden until AI tabs,
// environments and sessions), as ready-to-render views. Components never read the raw data or
// re-derive these rules themselves.
import type { BrowserState, TabRuntime } from '@shared/ipc/contract'
import type { BrowserSpace, BrowserTab, SessionStatus } from '@shared/model'
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

export interface BrowserView {
  spaces: SpaceSummary[]
  space: SpaceSummary
  /** The active space's tabs, by position. */
  tabs: TabView[]
  activeTab: TabView | null
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

/** The browser as the chrome shows it: the active space, its tabs in order and the active tab. */
export function browserView(state: BrowserState): BrowserView {
  const spaces = state.spaces.map(toSpace)
  const space = spaces.find((s) => s.id === state.activeSpaceId) ?? spaces[0]
  // Main always keeps at least one space.
  if (!space) throw new Error('Browser state has no space')

  const tabs = state.tabs
    .filter((t) => t.spaceId === space.id)
    .sort((a, b) => a.position - b.position)
    .map((t) => toTab(t, state.runtime[t.id]))
  const activeId = state.activeTabIds[space.id] ?? null
  return { spaces, space, tabs, activeTab: tabs.find((t) => t.id === activeId) ?? null }
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
