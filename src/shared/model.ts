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

export type SessionStatus = 'idle' | 'running' | 'needs-approval' | 'done' | 'error' | 'limited'
export type SessionOrigin = 'created' | 'imported' | 'handoff' | 'crew'

export interface Session {
  /** Stable YAAS id — survives forks and handoffs. */
  id: string
  accountId: string
  /** Provider's own session id; changes on fork / handoff. */
  providerSessionId: string | null
  title: string
  cwd: string
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
