import { X } from 'lucide-react'
import { useEffect } from 'react'
import { useSettings } from '../../stores/settings'
import { useUi } from '../../stores/ui'
import { Segmented } from '../../ui/Segmented'
import { AppearanceFields, SwitcherField } from './AppearanceFields'
import fields from './Fields.module.css'
import styles from './SettingsView.module.css'

const ARCHIVE_DAYS = [1, 3, 7, 14, 30]

/** Settings as a modal dialog (DESIGN.md §7). Esc or a click on the backdrop closes it. */
export function SettingsView() {
  const { settings, update } = useSettings()
  const closeSettings = useUi((s) => s.closeSettings)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeSettings()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeSettings])

  if (!settings) return null

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
        <header className={styles.header}>
          <h1>Settings</h1>
          <button className={styles.close} onClick={closeSettings} aria-label="Close settings">
            <X size={16} />
          </button>
        </header>
        <div className={styles.body}>
          <section className={styles.section}>
            <h2>Appearance</h2>
            <div className={fields.fields}>
              <AppearanceFields />
            </div>
          </section>

          <section className={styles.section}>
            <h2>Layout</h2>
            <div className={fields.fields}>
              <SwitcherField />
              <div className={fields.field}>
                <span className={fields.label}>Context and usage meters</span>
                <Segmented
                  label="Meters placement"
                  value={settings.metersPlacement}
                  options={[
                    { value: 'topbar', label: 'Top bar' },
                    { value: 'sidebar', label: 'Sidebar' },
                  ]}
                  onChange={(metersPlacement) => void update({ metersPlacement })}
                />
              </div>
              <div className={fields.field}>
                <span className={fields.label}>Auto-hide sidebar</span>
                <Segmented
                  label="Auto-hide sidebar"
                  value={settings.sidebarAutoHide ? 'on' : 'off'}
                  options={[
                    { value: 'on', label: 'On' },
                    { value: 'off', label: 'Off' },
                  ]}
                  onChange={(v) => void update({ sidebarAutoHide: v === 'on' })}
                />
                <p className={fields.hint}>
                  Shows when the pointer touches the left edge. ⌘S toggles.
                </p>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h2>Sessions</h2>
            <div className={fields.fields}>
              <div className={fields.field}>
                <span className={fields.label}>Auto-archive inactive sessions</span>
                <div className={fields.row}>
                  <Segmented
                    label="Auto-archive"
                    value={settings.autoArchive.enabled ? 'on' : 'off'}
                    options={[
                      { value: 'on', label: 'On' },
                      { value: 'off', label: 'Off' },
                    ]}
                    onChange={(v) =>
                      void update({ autoArchive: { ...settings.autoArchive, enabled: v === 'on' } })
                    }
                  />
                  <select
                    className={fields.select}
                    aria-label="Archive after"
                    disabled={!settings.autoArchive.enabled}
                    value={settings.autoArchive.afterDays}
                    onChange={(e) =>
                      void update({
                        autoArchive: { ...settings.autoArchive, afterDays: Number(e.target.value) },
                      })
                    }
                  >
                    {ARCHIVE_DAYS.map((d) => (
                      <option key={d} value={d}>
                        after {d} {d === 1 ? 'day' : 'days'} without activity
                      </option>
                    ))}
                  </select>
                </div>
                <p className={fields.hint}>
                  Archived sessions stay searchable and can be restored. Pinned sessions are never
                  archived. (Not wired yet.)
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
