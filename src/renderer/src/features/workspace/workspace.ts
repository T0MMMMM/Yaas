// Workspace: everything the UI needs to know about spaces, environments and sessions, as ready-to-
// render views. Components never read the raw data or re-derive pinning rules themselves.
import type { SessionStatus } from '@shared/model'
import type { DemoEnvironment, DemoSession, DemoSpace, DemoUsage } from './demoData'

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
