import { ArrowRight, Monitor, Moon, Sun } from 'lucide-react'
import type { Settings } from '@shared/ipc/contract'
import { useSettings } from '../../stores/settings'
import { Segmented } from '../../ui/Segmented'
import { MiniPreview } from './MiniPreview'
import styles from './Onboarding.module.css'

const ACCENTS = ['#7C5CFF', '#FF5C8A', '#FF8A3D', '#2BB673', '#2D9CDB', '#111111']
const onOff = [
  { value: 'on' as const, label: 'On' },
  { value: 'off' as const, label: 'Off' },
]

/** Onboarding screen 2 — every choice applies live (DESIGN.md §6). */
export function VisualSetup({ onNext }: { onNext: () => void }) {
  const { settings, info, update } = useSettings()
  if (!settings) return null
  const set = (patch: Partial<Settings>) => void update(patch)

  return (
    <section className={styles.setup} data-testid="visual-setup">
      <header className={styles.header}>
        <h1>Make it yours</h1>
        <p>Pick a look. You can change all of this later in Settings.</p>
      </header>

      <div className={styles.columns}>
        <div className={styles.fields}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Color</span>
            <div className={styles.row}>
              {ACCENTS.map((color) => (
                <button
                  key={color}
                  className={styles.swatch}
                  style={{ background: color }}
                  aria-label={color}
                  aria-pressed={settings.accent.toLowerCase() === color.toLowerCase()}
                  onClick={() => set({ accent: color })}
                />
              ))}
              <label className={styles.custom} title="Custom color">
                <input
                  type="color"
                  value={settings.accent}
                  onChange={(e) => set({ accent: e.target.value })}
                />
              </label>
            </div>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Appearance</span>
            <Segmented
              label="Appearance"
              value={settings.colorScheme}
              options={[
                { value: 'light', label: 'Light', icon: <Sun size={14} /> },
                { value: 'dark', label: 'Dark', icon: <Moon size={14} /> },
                { value: 'system', label: 'System', icon: <Monitor size={14} /> },
              ]}
              onChange={(colorScheme) => set({ colorScheme })}
            />
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Glass</span>
            <Segmented
              label="Glass"
              value={settings.glass && info?.glassSupported ? 'on' : 'off'}
              disabled={!info?.glassSupported}
              options={onOff}
              onChange={(v) => set({ glass: v === 'on' })}
            />
            {!info?.glassSupported && (
              <p className={styles.fieldHint}>Needs macOS or Windows 11.</p>
            )}
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Grain</span>
            <div className={styles.row}>
              <Segmented
                label="Grain"
                value={settings.grain ? 'on' : 'off'}
                options={onOff}
                onChange={(v) => set({ grain: v === 'on' })}
              />
              <input
                className={styles.slider}
                type="range"
                aria-label="Grain intensity"
                min={0}
                max={0.2}
                step={0.01}
                disabled={!settings.grain}
                value={settings.grainOpacity}
                onChange={(e) => set({ grainOpacity: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Space switcher</span>
            <Segmented
              label="Space switcher"
              value={settings.spaceSwitcherStyle}
              options={[
                { value: 'icons', label: 'Icons' },
                { value: 'dots', label: 'Dots' },
              ]}
              onChange={(spaceSwitcherStyle) => set({ spaceSwitcherStyle })}
            />
          </div>
        </div>

        <MiniPreview switcher={settings.spaceSwitcherStyle} />
      </div>

      <footer className={styles.footer}>
        <span />
        <button className={styles.primary} onClick={onNext}>
          Continue <ArrowRight size={16} />
        </button>
      </footer>
    </section>
  )
}
