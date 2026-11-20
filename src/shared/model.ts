// Domain types shared by main, core and renderer. See docs/ARCHITECTURE.md §5.
// Only types here — no runtime code, no Electron, no React.

export type ProviderId = 'claude-code'

export type ColorScheme = 'light' | 'dark' | 'system'

export interface Account {
  id: string
  provider: ProviderId
  label: string
  emoji: string
  color: string
  /** Absolute CLAUDE_CONFIG_DIR, or null for the imported default `~/.claude`. Never moved (ADR-0002). */
  configDir: string | null
  authMethod: 'claude.ai' | 'console' | 'oauth-token' | 'none'
  email: string | null
  orgName: string | null
  plan: string | null
  defaultProfileId: string | null
  position: number
  archivedAt: string | null
}

/** A project folder sessions run in. Global; pin/order/collapse are per space. */
export interface Environment {
  id: string
  path: string
  name: string
  /** Optional custom emoji / icon name (v1). */
  icon: string | null
}

export interface SpaceEnvironment {
  accountId: string
  environmentId: string
  pinned: boolean
  position: number
  collapsed: boolean
}

export type SessionStatus = 'idle' | 'running' | 'needs-approval' | 'done' | 'error' | 'limited'
export type SessionOrigin = 'created' | 'imported' | 'handoff' | 'crew'

export interface Session {
  /** Stable Big Browser id — survives forks and handoffs. */
  id: string
  accountId: string
  /** Provider's own session id; changes on fork / handoff. */
  providerSessionId: string | null
  title: string
  /** Optional custom emoji / icon name (v1). */
  icon: string | null
  cwd: string
  environmentId: string
  profileId: string | null
  model: string | null
  status: SessionStatus
  origin: SessionOrigin
  parentSessionId: string | null
  worktreePath: string | null
  pinned: boolean
  archivedAt: string | null
  lastActivityAt: string
}

export type UsageWindowKind = 'five_hour' | 'seven_day' | 'seven_day_opus' | 'seven_day_sonnet'

export interface UsageWindow {
  kind: UsageWindowKind
  /** 0..1 */
  utilization: number
  resetsAt: string
}

export interface BrowserSpace {
  id: string
  name: string
  color: string
  position: number
}

/** Where a tab sits in its space: favourite tiles, pinned tabs and folders, or the rest. */
export type TabSection = 'favorites' | 'pinned' | 'today'

export interface BrowserTab {
  id: string
  spaceId: string
  url: string
  title: string
  faviconUrl: string | null
  /** Within its list: the section's top level (shared with folders in pinned), or its folder. */
  position: number
  section: TabSection
  /** The pinned folder it is in, or null. */
  folderId: string | null
  /** The today tab it was opened from (drawn indented under it), or null. */
  parentId: string | null
}

/** A folder of pinned tabs. Folders and top-level pinned tabs share one ordering. */
export interface BrowserFolder {
  id: string
  spaceId: string
  name: string
  position: number
  collapsed: boolean
}

/** What reopening a closed tab needs to put it back where it was. */
export interface ClosedTab {
  spaceId: string
  url: string
  title: string
  section: TabSection
  folderId: string | null
  parentId: string | null
  position: number
}

export interface BrowserSnapshot {
  /** By position. */
  spaces: BrowserSpace[]
  activeSpaceId: string
  /** All spaces, by spaceId, then section (favorites, pinned, today), folder and position. */
  tabs: BrowserTab[]
  /** All spaces, by spaceId then position. */
  folders: BrowserFolder[]
  /** Active tab per space. */
  activeTabIds: Record<string, string | null>
}
