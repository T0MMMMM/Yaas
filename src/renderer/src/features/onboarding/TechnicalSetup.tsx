import { useState } from 'react'
import { ArrowLeft, Download, LogIn, TerminalSquare } from 'lucide-react'
import { useSettings } from '../../stores/settings'
import { Segmented } from '../../ui/Segmented'
import fields from '../settings/Fields.module.css'
import styles from './Onboarding.module.css'

/**
 * Onboarding screen 3 — accounts, default context, CLI detection (DESIGN.md §6).
 * Placeholder: nothing here is wired yet except "Open YAAS".
 */
export function TechnicalSetup({ onBack }: { onBack: () => void }) {
  const { update } = useSettings()
  const [context, setContext] = useState<'clean' | 'inherit'>('clean')

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
            <button className={styles.card} disabled>
              <Download size={20} />
              <div>
                <strong>Import existing Claude Code</strong>
                <span>Use the account already signed in on this computer (~/.claude).</span>
              </div>
            </button>
            <button className={styles.card} disabled>
              <LogIn size={20} />
              <div>
                <strong>Sign in a new account</strong>
                <span>Opens your browser to sign in.</span>
              </div>
            </button>
          </div>
          <p className={styles.soon}>Not wired yet — you can continue without an account.</p>
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
          <span className={styles.status}>
            <TerminalSquare size={16} /> Not checked yet
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
