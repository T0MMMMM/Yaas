import { ArrowRight } from 'lucide-react'
import { useSettings } from '../../stores/settings'
import { AppearanceFields, SwitcherField } from '../settings/AppearanceFields'
import fields from '../settings/Fields.module.css'
import { MiniPreview } from './MiniPreview'
import styles from './Onboarding.module.css'

/** Onboarding screen 2 — every choice applies live (DESIGN.md §6). */
export function VisualSetup({ onNext }: { onNext: () => void }) {
  const settings = useSettings((s) => s.settings)
  if (!settings) return null

  return (
    <section className={styles.setup} data-testid="visual-setup">
      <header className={styles.header}>
        <h1>Make it yours</h1>
        <p>Pick a look. You can change all of this later in Settings.</p>
      </header>

      <div className={styles.columns}>
        <div className={fields.fields}>
          <AppearanceFields />
          <SwitcherField />
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
