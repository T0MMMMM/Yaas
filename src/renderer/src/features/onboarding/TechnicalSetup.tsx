import { useEffect, useState } from 'react'
import { ArrowLeft, Check, DownloadSimple, SignIn, TerminalWindow } from '@phosphor-icons/react'
import type { CliInfo } from '@shared/ipc/contract'
import type { Account } from '@shared/model'
import { useAccounts } from '../../stores/accounts'
import { useSettings } from '../../stores/settings'
import { Segmented } from '../../ui/Segmented'
import fields from '../settings/Fields.module.css'
import styles from './Onboarding.module.css'

type ImportState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'done'; account: Account }
  | { kind: 'error'; message: string }

/** Turns an IPC error ("accounts.importDefault failed (code): message") into a readable line. */
const importError = (error: unknown): string => {
  const text = error instanceof Error ? error.message : String(error)
  if (text.includes('(cli_not_found)')) return 'Claude Code is not installed on this computer.'
  if (text.includes('(not_signed_in)')) return 'No account is signed in to Claude Code yet.'
  return "Couldn't import the account. Try again."
}

/**
 * Onboarding screen 3 — accounts, default context, CLI detection (DESIGN.md §6).
 * Import and CLI detection are real; new sign-in and default context are not wired yet.
 */
export function TechnicalSetup({ onBack }: { onBack: () => void }) {
  const { update } = useSettings()
  const importDefault = useAccounts((s) => s.importDefault)
  const [context, setContext] = useState<'clean' | 'inherit'>('clean')
  const [cli, setCli] = useState<CliInfo | null>(null)
  const [imported, setImported] = useState<ImportState>({ kind: 'idle' })

  useEffect(() => {
    void window.yaas.invoke('claude.detect').then(setCli)
  }, [])

  const onImport = async () => {
    setImported({ kind: 'busy' })
    try {
      setImported({ kind: 'done', account: await importDefault() })
    } catch (error) {
      setImported({ kind: 'error', message: importError(error) })
    }
  }

  return (
    <section className={styles.setup} data-testid="technical-setup">
      <header className={styles.header}>
        <h1>Connect Claude</h1>
        <p>Each account becomes a space. You can add more later.</p>
      </header>

      <div className={fields.fields}>
        <div className={fields.field}>
          <span className={fields.label}>First account</span>
          <div className={styles.cards}>
            <button
              className={styles.card}
              onClick={() => void onImport()}
              disabled={imported.kind === 'busy' || imported.kind === 'done' || !cli?.path}
              data-testid="import-default"
            >
              {imported.kind === 'done' ? <Check size={22} /> : <DownloadSimple size={22} />}
              <div>
                <strong>
                  {imported.kind === 'done' ? 'Imported' : 'Import existing Claude Code'}
                </strong>
                <span>
                  {imported.kind === 'done'
                    ? [imported.account.email, imported.account.plan].filter(Boolean).join(' · ')
                    : 'Use the account already signed in on this computer (~/.claude).'}
                </span>
              </div>
            </button>
            <button className={styles.card} disabled>
              <SignIn size={22} />
              <div>
                <strong>Sign in a new account</strong>
                <span>Opens your browser to sign in.</span>
              </div>
            </button>
          </div>
          {imported.kind === 'error' && <p className={styles.error}>{imported.message}</p>}
          <p className={styles.soon}>Signing in a new account comes next.</p>
        </div>

        <div className={fields.field}>
          <span className={fields.label}>Default context for new sessions</span>
          <Segmented
            label="Default context"
            value={context}
            options={[
              { value: 'clean', label: 'Clean' },
              { value: 'inherit', label: 'Inherit ~/.claude' },
            ]}
            onChange={setContext}
          />
          <p className={fields.hint}>
            Clean loads only what you pick per session — fewer tokens. Inherit loads all your global
            skills, plugins and MCP servers.
          </p>
        </div>

        <div className={fields.field}>
          <span className={fields.label}>Claude Code CLI</span>
          <span className={styles.status} data-testid="cli-status">
            <TerminalWindow size={17} />
            {cli === null && 'Looking for Claude Code…'}
            {cli && cli.path && (
              <>
                Claude Code {cli.version ?? ''}
                <code className={styles.path}>{cli.path}</code>
              </>
            )}
            {cli && !cli.path && 'Not found — install Claude Code, then come back.'}
          </span>
        </div>
      </div>

      <footer className={styles.footer}>
        <button className={styles.secondary} onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <button className={styles.primary} onClick={() => void update({ onboardingDone: true })}>
          Open YAAS
        </button>
      </footer>
    </section>
  )
}
