import { X } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useUi } from '../../stores/ui'
import { SECTIONS } from './catalog'
import styles from './SettingsView.module.css'

/** Length of the exit animation (`--dur-fast`): the view is unmounted once it has played. */
const EXIT_MS = 120

/**
 * Settings as a modal dialog with a left navigation (DESIGN.md §7).
 * Esc, the close button or a click on the backdrop closes it, after an exit animation.
 */
export function SettingsView() {
  const unmount = useUi((s) => s.closeSettings)
  const [closing, setClosing] = useState(false)
  /** The pending unmount while the exit animation plays; a repeated close is ignored. */
  const exit = useRef<number | null>(null)
  const closeSettings = useCallback(() => {
    if (exit.current !== null) return
    setClosing(true)
    exit.current = window.setTimeout(unmount, EXIT_MS)
  }, [unmount])
  useEffect(
    () => () => {
      if (exit.current !== null) window.clearTimeout(exit.current)
    },
    [],
  )
  const [sectionId, setSectionId] = useState(SECTIONS[0]?.id)
  const section = SECTIONS.find((s) => s.id === sectionId) ?? SECTIONS[0]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeSettings()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeSettings])

  if (!section) return null

  return (
    <div
      className={`${styles.backdrop} no-drag`}
      data-state={closing ? 'closing' : undefined}
      onMouseDown={(e) => e.target === e.currentTarget && closeSettings()}
    >
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        data-testid="settings"
      >
        <nav className={styles.nav} aria-label="Settings sections">
          <h1 className={styles.navTitle}>Settings</h1>
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={styles.navItem}
              aria-current={id === section.id ? 'page' : undefined}
              onClick={() => setSectionId(id)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        <div className={styles.pane}>
          <header className={styles.paneHeader}>
            <h2>{section.label}</h2>
            <button className={styles.close} onClick={closeSettings} aria-label="Close settings">
              <X size={16} />
            </button>
          </header>
          <div className={styles.paneBody} key={section.id}>
            {section.render()}
          </div>
        </div>
      </div>
    </div>
  )
}
