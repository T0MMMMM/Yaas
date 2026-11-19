import type { CSSProperties } from 'react'
import { SettingsView } from '../features/settings/SettingsView'
import { Sidebar } from '../features/sidebar/Sidebar'
import { useWorkspace } from '../features/workspace/useWorkspace'
import { useUi } from '../stores/ui'
import { ContextBar } from './ContextBar'
import { useSidebarResize } from './useSidebarResize'
import styles from './Shell.module.css'

/** Main layout: sidebar + context bar (in a session) + content card (DESIGN.md §2). */
export function Shell() {
  const view = useUi((s) => s.view)
  const { open } = useWorkspace()
  const resize = useSidebarResize()

  return (
    <div
      className={styles.shell}
      data-resizing={resize.resizing}
      style={{ '--sidebar-w': `${resize.width}px` } as CSSProperties}
    >
      <div className={styles.sidebarSlot}>
        <Sidebar />
        <div
          className={styles.resizer}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-valuenow={resize.width}
          title="Drag to resize · double-click to reset"
          onPointerDown={resize.onPointerDown}
          onDoubleClick={resize.reset}
          data-testid="sidebar-resizer"
        />
      </div>

      <div className={styles.column} data-has-contextbar={open !== null}>
        <main className={styles.card}>
          <ContextBar />
          <section className={styles.empty} data-testid="empty-state">
            {open ? (
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
