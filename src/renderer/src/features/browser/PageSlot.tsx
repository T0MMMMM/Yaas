import { useEffect, useRef, type CSSProperties } from 'react'
import { useUi } from '../../stores/ui'
import { normalizeHexColor } from '../../theme/color'
import { useWorkspace } from '../workspace/useWorkspace'
import styles from './PageSlot.module.css'

/**
 * Where the active tab's page goes. The page is a native view drawn above the UI by main: this
 * box only reports its bounds, and hides the page while settings are open (they would sit under
 * it). With no tab it shows the empty state; in a split, two card backings flank the 8 px frame
 * trough (the Shell draws the divider in it, header bars included).
 */
export function PageSlot() {
  const ref = useRef<HTMLDivElement>(null)
  const workspace = useWorkspace()
  const activeTab = workspace?.activeTab ?? null
  const hasTab = Boolean(activeTab)
  const split = workspace?.activeSplit ?? null
  const settingsOpen = useUi((s) => s.view === 'settings')
  const singleTopTint =
    !split && activeTab?.themeColor ? normalizeHexColor(activeTab.themeColor) : null
  const firstTopTint = split?.first.themeColor ? normalizeHexColor(split.first.themeColor) : null
  const secondTopTint = split?.second.themeColor ? normalizeHexColor(split.second.themeColor) : null

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
    <div
      ref={ref}
      className={styles.slot}
      data-testid="page-slot"
      data-tinted={singleTopTint ? true : undefined}
      style={singleTopTint ? ({ '--page-top-tint': singleTopTint } as CSSProperties) : undefined}
    >
      {!hasTab && (
        <section className={styles.empty} data-testid="empty-state">
          <p className={styles.emptyTitle}>No tab open</p>
          <p className={styles.emptyHint}>
            Press <kbd>⌘T</kbd> to open one
          </p>
        </section>
      )}
      {split && (
        <>
          <div
            className={`${styles.splitPane} ${styles.splitFirst}`}
            style={
              {
                '--split-ratio': split.ratio,
                ...(firstTopTint ? { '--page-top-tint': firstTopTint } : {}),
              } as CSSProperties
            }
            aria-hidden="true"
          />
          <div
            className={`${styles.splitPane} ${styles.splitSecond}`}
            style={
              {
                '--split-ratio': split.ratio,
                ...(secondTopTint ? { '--page-top-tint': secondTopTint } : {}),
              } as CSSProperties
            }
            aria-hidden="true"
          />
        </>
      )}
    </div>
  )
}
