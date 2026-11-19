import { useState, type ReactNode } from 'react'
import type { Settings } from '@shared/ipc/contract'
import { useSettings } from '../../stores/settings'
import styles from './Onboarding.module.css'

const ACCENTS = ['#7C5CFF', '#FF5C8A', '#FF8A3D', '#2BB673', '#2D9CDB', '#111111']
const STEPS = ['welcome', 'accent', 'appearance', 'glass', 'grain', 'account', 'done'] as const
type Step = (typeof STEPS)[number]

/**
 * First-launch onboarding (DESIGN.md §6). Theme choices apply live through settings.update;
 * the account step is a placeholder (not wired yet).
 */
export function Onboarding() {
  const { settings, info, update } = useSettings()
  const [index, setIndex] = useState(0)
  if (!settings) return null

  const step: Step = STEPS[index] ?? 'welcome'
  const next = () => setIndex((i) => Math.min(i + 1, STEPS.length - 1))
  const back = () => setIndex((i) => Math.max(i - 1, 0))
  const set = (patch: Partial<Settings>) => void update(patch)

  return (
    <div className={`${styles.backdrop} drag`}>
      <div className={`${styles.card} no-drag`} data-testid="onboarding" data-step={step}>
        <ol className={styles.dots} aria-label={`Step ${index + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <li key={s} data-current={i === index} data-past={i < index} />
          ))}
        </ol>

        {step === 'welcome' && (
          <Section
            title="Yeah, An Account Switcher."
            subtitle="All your Claude accounts, one window."
          >
            <p className={styles.text}>
              Run Claude Code sessions on your work and personal accounts side by side, hand a
              session over when an account runs dry, and let them work together.
            </p>
          </Section>
        )}

        {step === 'accent' && (
          <Section title="Pick your color" subtitle="Tints the sidebar and highlights.">
            <div className={styles.swatches}>
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
          </Section>
        )}

        {step === 'appearance' && (
          <Section title="Appearance" subtitle="You can change this anytime in Settings.">
            <Segmented
              value={settings.colorScheme}
              options={[
                ['light', 'Light'],
                ['dark', 'Dark'],
                ['system', 'System'],
              ]}
              onChange={(colorScheme) => set({ colorScheme })}
            />
          </Section>
        )}

        {step === 'glass' && (
          <Section
            title="Glass"
            subtitle={
              info?.glassSupported
                ? 'Let the desktop show through the sidebar.'
                : 'Not available on this system (needs macOS or Windows 11).'
            }
          >
            <Segmented
              value={settings.glass && info?.glassSupported ? 'on' : 'off'}
              disabled={!info?.glassSupported}
              options={[
                ['on', 'On'],
                ['off', 'Off'],
              ]}
              onChange={(v) => set({ glass: v === 'on' })}
            />
          </Section>
        )}

        {step === 'grain' && (
          <Section title="Grain" subtitle="A subtle film texture over the window.">
            <Segmented
              value={settings.grain ? 'on' : 'off'}
              options={[
                ['on', 'On'],
                ['off', 'Off'],
              ]}
              onChange={(v) => set({ grain: v === 'on' })}
            />
            <label className={styles.slider}>
              <span>Intensity</span>
              <input
                type="range"
                min={0}
                max={0.2}
                step={0.01}
                disabled={!settings.grain}
                value={settings.grainOpacity}
                onChange={(e) => set({ grainOpacity: Number(e.target.value) })}
              />
            </label>
          </Section>
        )}

        {step === 'account' && (
          <Section title="Add your first account" subtitle="Each account becomes a space.">
            <div className={styles.options}>
              <button className={styles.option} disabled>
                <strong>Import existing Claude Code</strong>
                <span>Use the account already signed in on this computer (~/.claude)</span>
              </button>
              <button className={styles.option} disabled>
                <strong>Sign in a new account</strong>
                <span>Opens your browser to sign in</span>
              </button>
            </div>
            <p className={styles.note}>Coming soon — you can continue without an account.</p>
          </Section>
        )}

        {step === 'done' && (
          <Section title="You're all set" subtitle="Press ⌘T to start your first session." />
        )}

        <footer className={styles.footer}>
          {index > 0 && step !== 'done' ? (
            <button className={styles.secondary} onClick={back}>
              Back
            </button>
          ) : (
            <span />
          )}
          {step === 'done' ? (
            <button className={styles.primary} onClick={() => set({ onboardingDone: true })}>
              Open YAAS
            </button>
          ) : (
            <button className={styles.primary} onClick={next} autoFocus>
              {step === 'welcome' ? 'Get started' : 'Continue'}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children?: ReactNode
}) {
  return (
    <section className={styles.section}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.subtitle}>{subtitle}</p>
      {children}
    </section>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
}: {
  value: T
  options: Array<[T, string]>
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <div className={styles.segmented} role="radiogroup">
      {options.map(([key, label]) => (
        <button
          key={key}
          role="radio"
          aria-checked={value === key}
          disabled={disabled}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
