import { useEffect, useState } from 'react'
import { Logo } from '../brand/Logo'
import { TechnicalSetup } from './TechnicalSetup'
import { VisualSetup } from './VisualSetup'
import styles from './Onboarding.module.css'

type Stage = 'intro' | 'visual' | 'technical'

const INTRO_MS = 1200

/**
 * First-launch onboarding as a full-window page (DESIGN.md §6):
 * logo intro → (animated) visual setup → technical setup.
 */
export function Onboarding() {
  const [stage, setStage] = useState<Stage>('intro')

  // The intro moves on by itself, or on click / Enter.
  useEffect(() => {
    if (stage !== 'intro') return
    const timer = setTimeout(() => setStage('visual'), INTRO_MS)
    return () => clearTimeout(timer)
  }, [stage])

  // ← / → between the two setup pages (not while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (stage === 'intro' && e.key === 'Enter') setStage('visual')
      if (stage === 'visual' && e.key === 'ArrowRight') setStage('technical')
      if (stage === 'technical' && e.key === 'ArrowLeft') setStage('visual')
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
        aria-label="YAAS"
        tabIndex={stage === 'intro' ? 0 : -1}
      >
        <Logo />
      </button>

      <p className={styles.tagline}>Yeah, An Account Switcher.</p>

      <div className={styles.content}>
        {stage === 'visual' && <VisualSetup onNext={() => setStage('technical')} />}
        {stage === 'technical' && <TechnicalSetup onBack={() => setStage('visual')} />}
      </div>
    </div>
  )
}
