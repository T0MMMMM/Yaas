import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useUi } from '../../stores/ui'
import { SECTIONS } from './catalog'
import styles from './SettingsView.module.css'

/**
 * Settings as a modal dialog with a left navigation (DESIGN.md §7).
 * Esc, the close button or a click on the backdrop closes it.
 */
export function SettingsView() {
  const closeSettings = useUi((s) => s.closeSettings)
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
          {SECTIONS.map(({ id, label }, index) => (
            <button
              key={id}
              className={styles.navItem}
              aria-current={id === section.id ? 'page' : undefined}
              onClick={() => setSectionId(id)}
            >
              <span className={styles.navIndex}>{String(index + 1).padStart(2, '0')}</span>
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
