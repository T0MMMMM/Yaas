import { Sidebar } from '../features/sidebar/Sidebar'
import { DEMO_SPACES } from '../features/sidebar/demoData'
import { useUi } from '../stores/ui'
import styles from './Shell.module.css'

/** Main layout: sidebar + session pane (DESIGN.md §2). No session logic yet. */
export function Shell() {
  const activeSessionId = useUi((s) => s.activeSessionId)
  const environment = DEMO_SPACES.flatMap((s) => s.environments).find((e) =>
    e.sessions.some((s) => s.id === activeSessionId),
  )
  const session = environment?.sessions.find((s) => s.id === activeSessionId)

  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.main}>
        <header className={`${styles.header} drag`}>
          {session && environment && (
            <>
              <span className={styles.title}>{session.title}</span>
              <span className={styles.meta}>{environment.path}</span>
            </>
          )}
        </header>
        <section className={styles.empty} data-testid="empty-state">
          {session ? (
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
  )
}
