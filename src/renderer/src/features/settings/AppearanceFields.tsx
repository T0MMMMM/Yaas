import { Desktop, Drop, Moon, Square, Sun } from '@phosphor-icons/react'
import type { Settings } from '@shared/ipc/contract'
import { useSettings } from '../../stores/settings'
import { LIQUID_FROM } from '../../theme/applyTheme'
import { ColorPicker } from '../../ui/ColorPicker'
import { Segmented } from '../../ui/Segmented'
import { Slider } from '../../ui/Slider'
import styles from './Fields.module.css'

/** Color, scheme, transparency, grain — used by onboarding and Settings. Applies live. */
export function AppearanceFields() {
  const { settings, info, update } = useSettings()
  if (!settings) return null
  const set = (patch: Partial<Settings>) => void update(patch)
  const glassSupported = info?.glassSupported ?? false
  const liquid = glassSupported && settings.transparency >= LIQUID_FROM

  return (
    <>
      <div className={styles.field}>
        <span className={styles.label}>Color</span>
        <ColorPicker value={settings.accent} onChange={(accent) => set({ accent })} />
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Appearance</span>
        <Segmented
          label="Appearance"
          value={settings.colorScheme}
          options={[
            { value: 'light', label: 'Light', icon: <Sun size={15} /> },
            { value: 'dark', label: 'Dark', icon: <Moon size={15} /> },
            { value: 'system', label: 'System', icon: <Desktop size={15} /> },
          ]}
          onChange={(colorScheme) => set({ colorScheme })}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.label}>
          Transparency
          {liquid && <span className={styles.badge}>Liquid glass</span>}
        </span>
        <Slider
          label="Transparency"
          variant="wave"
          value={glassSupported ? settings.transparency : 0}
          disabled={!glassSupported}
          onChange={(transparency) => set({ transparency })}
          start={<Square size={15} />}
          end={<Drop size={15} />}
        />
        <p className={styles.hint}>
          {glassSupported
            ? 'Lets your desktop show through. All the way right turns the window to liquid glass.'
            : 'Needs macOS or Windows 11.'}
        </p>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Grain</span>
        <Slider
          label="Grain"
          variant="speckle"
          value={settings.grain}
          onChange={(grain) => set({ grain })}
        />
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
