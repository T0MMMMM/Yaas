// Accounts: the spaces of YAAS. Stored in SQLite; profiles come from the provider's auth status.
import { randomUUID } from 'node:crypto'
import type { Account } from '@shared/model'
import type { AuthStatus } from '../providers/claude-code/cli'
import type { Database } from '../store/database'

interface AccountRow {
  id: string
  provider: 'claude-code'
  label: string
  emoji: string
  color: string
  config_dir: string | null
  auth_method: Account['authMethod']
  email: string | null
  org_name: string | null
  plan: string | null
  position: number
  archived_at: string | null
}

const toAccount = (r: AccountRow): Account => ({
  id: r.id,
  provider: r.provider,
  label: r.label,
  emoji: r.emoji,
  color: r.color,
  configDir: r.config_dir,
  authMethod: r.auth_method,
  email: r.email,
  orgName: r.org_name,
  plan: r.plan,
  defaultProfileId: null,
  position: r.position,
  archivedAt: r.archived_at,
})

export class AccountError extends Error {
  constructor(
    readonly code: 'cli_not_found' | 'not_signed_in',
    message: string,
  ) {
    super(message)
  }
}

export interface AccountsDeps {
  db: Database
  /** Auth status of a config dir (null = the default ~/.claude). Null if the CLI is missing. */
  authStatus: (configDir: string | null) => Promise<AuthStatus | null>
  /** Color for a new space (the app accent). */
  defaultColor: () => string
}

type Listener = (accounts: Account[]) => void

export class Accounts {
  private readonly listeners = new Set<Listener>()

  constructor(private readonly deps: AccountsDeps) {}

  list(): Account[] {
    const rows = this.deps.db
      .prepare('SELECT * FROM accounts WHERE archived_at IS NULL ORDER BY position')
      .all() as unknown as AccountRow[]
    return rows.map(toAccount)
  }

  /**
   * Imports the account already signed in to ~/.claude as a space, without moving anything
   * (ADR-0002). Calling it again refreshes the profile instead of creating a duplicate.
   */
  async importDefault(): Promise<Account> {
    const status = await this.deps.authStatus(null)
    if (!status) throw new AccountError('cli_not_found', 'Claude Code CLI not found.')
    if (!status.loggedIn) {
      throw new AccountError('not_signed_in', 'No account is signed in to Claude Code yet.')
    }

    const db = this.deps.db
    const existing = db.prepare('SELECT id FROM accounts WHERE config_dir IS NULL').get() as
      { id: string } | undefined

    if (existing) {
      db.prepare(
        'UPDATE accounts SET auth_method = ?, email = ?, org_name = ?, plan = ?, archived_at = NULL WHERE id = ?',
      ).run(status.authMethod, status.email, status.orgName, status.plan, existing.id)
    } else {
      const position = (
        db.prepare('SELECT COALESCE(MAX(position) + 1, 0) AS next FROM accounts').get() as {
          next: number
        }
      ).next
      db.prepare(
        `INSERT INTO accounts (id, provider, label, emoji, color, config_dir, auth_method, email,
           org_name, plan, position, created_at)
         VALUES (?, 'claude-code', ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
      ).run(
        randomUUID(),
        'Default',
        '🟠',
        this.deps.defaultColor(),
        status.authMethod,
        status.email,
        status.orgName,
        status.plan,
        position,
        new Date().toISOString(),
      )
    }

    const accounts = this.list()
    for (const listener of this.listeners) listener(accounts)
    const imported = accounts.find((a) => a.configDir === null)
    if (!imported) throw new Error('import failed')
    return imported
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}
