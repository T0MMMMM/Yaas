// Provider abstraction — see docs/ARCHITECTURE.md §4.
// Types only for now; `claude-code/` (Agent SDK adapter) and `fake/` (tests) implement it later.
import type { Account, ProviderId, UsageWindow } from '@shared/model'

export interface AuthStatus {
  loggedIn: boolean
  email: string | null
  orgName: string | null
  plan: string | null
}

export interface ProviderSessionRef {
  providerSessionId: string
  cwd: string
}

export interface DiscoveredSession extends ProviderSessionRef {
  title: string | null
  lastActivityAt: string
}

export interface TranscriptEntry {
  uuid: string
  role: 'user' | 'assistant' | 'system'
  timestamp: string
  /** Provider-native payload, rendered by the chat view. */
  content: unknown
}

export interface OpenSessionOptions {
  account: Account
  cwd: string
  model: string | null
  /** Resume this provider session instead of starting a new one. */
  resume?: ProviderSessionRef
  /** With `resume`: continue under a new session id (handoff). */
  fork?: boolean
  /** Resolved context profile: what the session is allowed to load (ADR-0002). */
  context: {
    settingSources: Array<'user' | 'project' | 'local'>
    mcpServers: string[]
    skills: string[]
    plugins: string[]
    loadClaudeMd: boolean
  }
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export type ProviderEvent =
  | { kind: 'init'; providerSessionId: string; model: string; tools: string[] }
  | { kind: 'text-delta' | 'thinking-delta'; messageId: string; text: string }
  | { kind: 'message'; entry: TranscriptEntry }
  | { kind: 'tool-use'; id: string; name: string; input: unknown }
  | { kind: 'tool-result'; toolUseId: string; output: unknown; isError: boolean }
  | { kind: 'permission-request'; requestId: string; tool: string; input: unknown }
  | {
      kind: 'rate-limit'
      status: 'allowed' | 'warning' | 'rejected'
      windows: UsageWindow[]
      resetsAt: string | null
    }
  | { kind: 'turn-end'; usage: TokenUsage; costUsd: number; stopReason: string }
  | {
      kind: 'error'
      code: 'rate_limited' | 'auth' | 'prompt_too_long' | 'invalid_thinking_signature' | 'other'
      message: string
    }

export interface LiveSession {
  send(text: string): void
  interrupt(): Promise<void>
  close(): Promise<void>
  readonly events: AsyncIterable<ProviderEvent>
}

export interface Provider {
  readonly id: ProviderId
  auth: {
    login(account: Account): Promise<void>
    status(account: Account): Promise<AuthStatus>
  }
  discoverSessions(account: Account): AsyncIterable<DiscoveredSession>
  readTranscript(account: Account, ref: ProviderSessionRef): AsyncIterable<TranscriptEntry>
  open(options: OpenSessionOptions): LiveSession
  copyTranscript(
    from: Account,
    to: Account,
    ref: ProviderSessionRef,
    options: { sanitize: boolean },
  ): Promise<ProviderSessionRef>
}
