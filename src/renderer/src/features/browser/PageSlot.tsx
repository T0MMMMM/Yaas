import { useEffect, useRef } from 'react'
import { useUi } from '../../stores/ui'
import { useWorkspace } from '../workspace/useWorkspace'
import styles from './PageSlot.module.css'

/**
 * Where the active tab's page goes. The page is a native view drawn above the UI by main: this
 * box only reports its bounds, and hides the page while settings are open (they would sit under
 * it). With no tab it shows the empty state.
 */
export function PageSlot() {
  const ref = useRef<HTMLDivElement>(null)
  const hasTab = Boolean(useWorkspace()?.activeTab)
  const settingsOpen = useUi((s) => s.view === 'settings')

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const send = () => {
      const box = el.getBoundingClientRect()
      void window.bigBrowser.invoke('browser.setPageBounds', {
        x: Math.max(0, Math.round(box.left)),
        y: Math.max(0, Math.round(box.top)),
        width: Math.max(0, Math.round(box.width)),
        height: Math.max(0, Math.round(box.height)),
      })
    }
    send()
    const observer = new ResizeObserver(send)
    observer.observe(el)
    window.addEventListener('resize', send)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', send)
    }
  }, [])

  useEffect(() => {
    void window.bigBrowser.invoke('browser.setPageVisible', { visible: !settingsOpen })
  }, [settingsOpen])

  return (
    <div ref={ref} className={styles.slot} data-testid="page-slot">
      {!hasTab && (
        <section className={styles.empty} data-testid="empty-state">
          <p className={styles.emptyTitle}>No tab open</p>
          <p className={styles.emptyHint}>
            Press <kbd>⌘T</kbd> to open one
          </p>
        </section>
      )}
    </div>
  )
}
