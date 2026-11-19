import { Sidebar } from '../features/sidebar/Sidebar'
import styles from './Shell.module.css'

/** Main layout: sidebar + session pane (DESIGN.md §2). No session logic yet. */
export function Shell() {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.main}>
        <header className={`${styles.header} drag`} />
        <section className={styles.empty} data-testid="empty-state">
          <p className={styles.emptyTitle}>No session open</p>
          <p className={styles.emptyHint}>
            Press <kbd>⌘T</kbd> to start a session. <span>(not wired yet)</span>
          </p>
        </section>
      </main>
    </div>
  )
}
