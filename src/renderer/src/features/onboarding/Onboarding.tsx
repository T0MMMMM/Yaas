import { useEffect, useState } from 'react'
import { Logo } from '../brand/Logo'
import { VisualSetup } from './VisualSetup'
import styles from './Onboarding.module.css'

type Stage = 'intro' | 'visual'

const INTRO_MS = 1200

/**
 * First-launch onboarding as a full-window page (DESIGN.md §6):
 * logo intro → (animated) visual setup, which opens the browser.
 */
export function Onboarding() {
  const [stage, setStage] = useState<Stage>('intro')

  // The intro moves on by itself, or on click / Enter.
  useEffect(() => {
    if (stage !== 'intro') return
    const timer = setTimeout(() => setStage('visual'), INTRO_MS)
    return () => clearTimeout(timer)
  }, [stage])

  // Enter skips the intro (not while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (stage === 'intro' && e.key === 'Enter') setStage('visual')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stage])

  return (
    <div className={`${styles.page} grainy`} data-stage={stage} data-testid="onboarding">
      <div className={`${styles.titlebar} drag`} />

      <button
        className={`${styles.logo} no-drag`}
        onClick={() => stage === 'intro' && setStage('visual')}
        aria-label="Big Browser"
        tabIndex={stage === 'intro' ? 0 : -1}
      >
        <Logo />
      </button>

      <p className={styles.tagline}>A web browser you customize with your own AI.</p>

      <div className={styles.content}>{stage === 'visual' && <VisualSetup />}</div>
    </div>
  )
}
