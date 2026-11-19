import { Desktop, Drop, Moon, Square, Sun } from '@phosphor-icons/react'
import type { Settings } from '@shared/ipc/contract'
import { useSettings } from '../../stores/settings'
import { LIQUID_FROM } from '../../theme/applyTheme'
import { ColorPicker } from '../../ui/ColorPicker'
import { Segmented } from '../../ui/Segmented'
import { Slider } from '../../ui/Slider'
import styles from './Fields.module.css'

/** The slider covers the frosted range; liquid glass is its own cell at the end. */
const FROSTED_MAX = LIQUID_FROM - 0.01

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
        <span className={styles.label}>Transparency</span>
        <div className={styles.row}>
          <Slider
            label="Transparency"
            variant="wave"
            value={glassSupported ? Math.min(settings.transparency, FROSTED_MAX) / FROSTED_MAX : 0}
            disabled={!glassSupported}
            onChange={(v) => set({ transparency: v * FROSTED_MAX })}
            start={<Square size={15} />}
          />
          <button
            className={styles.liquid}
            aria-pressed={liquid}
            disabled={!glassSupported}
            onClick={() => set({ transparency: liquid ? FROSTED_MAX : 1 })}
            title="Liquid glass: the desktop shows through and the panels float on it"
          >
            <Drop size={16} weight={liquid ? 'fill' : 'duotone'} />
            Liquid glass
          </button>
        </div>
        <p className={styles.hint}>
          {glassSupported
            ? 'Slide to frost the desktop through the window, or go all the way to liquid glass.'
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
