import { SettingsView } from '../features/settings/SettingsView'
import { Sidebar } from '../features/sidebar/Sidebar'
import { findSession } from '../features/sidebar/demoData'
import { useUi } from '../stores/ui'
import { ContextBar } from './ContextBar'
import styles from './Shell.module.css'

/** Main layout: sidebar + context bar (in a session) + content card (DESIGN.md §2). */
export function Shell() {
  const { activeSessionId, view } = useUi()
  const found = findSession(activeSessionId)

  return (
    <div className={styles.shell}>
      <Sidebar />

      <div className={styles.column} data-has-contextbar={found !== null}>
        <ContextBar />
        <main className={styles.card}>
          <section className={styles.empty} data-testid="empty-state">
            {found ? (
              <p className={styles.emptyHint}>The session view is not wired yet.</p>
            ) : (
              <>
                <p className={styles.emptyTitle}>No session open</p>
                <p className={styles.emptyHint}>
                  Press <kbd>⌘T</kbd> to start a session.
                </p>
              </>
            )}
          </section>
        </main>
      </div>

      {view === 'settings' && <SettingsView />}
    </div>
  )
}
