import { useEffect, useState } from 'react'
import { SettingsView } from '../features/settings/SettingsView'
import { Sidebar } from '../features/sidebar/Sidebar'
import { findSession } from '../features/sidebar/demoData'
import { useSettings } from '../stores/settings'
import { useUi } from '../stores/ui'
import { TopBar } from './TopBar'
import styles from './Shell.module.css'

/** Main layout: sidebar (fixed or auto-hide) + top bar + content card (DESIGN.md §2). */
export function Shell() {
  const { activeSessionId, view } = useUi()
  const { settings, update } = useSettings()
  const autoHide = settings?.sidebarAutoHide ?? false
  const [peek, setPeek] = useState(false)
  const found = findSession(activeSessionId)

  // Mod+S toggles auto-hide.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        setPeek(false)
        void update({ sidebarAutoHide: !autoHide })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [autoHide, update])

  return (
    <div className={styles.shell} data-autohide={autoHide} data-peek={autoHide && peek}>
      {autoHide && (
        <div className={styles.hotzone} onMouseEnter={() => setPeek(true)} aria-hidden />
      )}
      <div className={styles.sidebarSlot} onMouseLeave={() => setPeek(false)}>
        <Sidebar />
      </div>

      <div className={styles.column}>
        <TopBar />
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
