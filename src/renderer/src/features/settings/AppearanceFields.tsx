import { Monitor, Moon, Sun } from 'lucide-react'
import type { Settings } from '@shared/ipc/contract'
import { useSettings } from '../../stores/settings'
import { Segmented } from '../../ui/Segmented'
import styles from './Fields.module.css'

const ACCENTS = ['#7C5CFF', '#FF5C8A', '#FF8A3D', '#2BB673', '#2D9CDB', '#111111']
const ON_OFF = [
  { value: 'on' as const, label: 'On' },
  { value: 'off' as const, label: 'Off' },
]

/** Color, scheme, glass, grain — used by onboarding and Settings. Applies live. */
export function AppearanceFields() {
  const { settings, info, update } = useSettings()
  if (!settings) return null
  const set = (patch: Partial<Settings>) => void update(patch)

  return (
    <>
      <div className={styles.field}>
        <span className={styles.label}>Color</span>
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
        <span className={styles.label}>Appearance</span>
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
        <span className={styles.label}>Glass</span>
        <Segmented
          label="Glass"
          value={settings.glass && info?.glassSupported ? 'on' : 'off'}
          disabled={!info?.glassSupported}
          options={ON_OFF}
          onChange={(v) => set({ glass: v === 'on' })}
        />
        {!info?.glassSupported && <p className={styles.hint}>Needs macOS or Windows 11.</p>}
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Grain</span>
        <div className={styles.row}>
          <Segmented
            label="Grain"
            value={settings.grain ? 'on' : 'off'}
            options={ON_OFF}
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
    </>
  )
}

/** Account switcher style — also shown in onboarding. */
export function SwitcherField() {
  const { settings, update } = useSettings()
  if (!settings) return null
  return (
    <div className={styles.field}>
      <span className={styles.label}>Account switcher</span>
      <Segmented
        label="Account switcher"
        value={settings.spaceSwitcherStyle}
        options={[
          { value: 'emoji', label: 'Emoji' },
          { value: 'letter', label: 'First letter' },
          { value: 'dots', label: 'Dots' },
        ]}
        onChange={(spaceSwitcherStyle) => void update({ spaceSwitcherStyle })}
      />
    </div>
  )
}
