import { useEffect, useReducer, useState } from 'react'
import { CopySimple, Minus, Square, X } from '@phosphor-icons/react'
import { controlsDelay, controlsReducer } from './controlsReveal'
import styles from './WindowControls.module.css'

/**
 * Windows: the window's top margin, holding minimize / maximize / close. The buttons are hidden;
 * resting the pointer on the margin opens it (it grows, the buttons slide in at the right) and it
 * closes a moment after the pointer leaves. `floating` lays it over the content (the onboarding,
 * which has no page under it) instead of pushing the content down.
 */
export function WindowControls({ floating = false }: { floating?: boolean }) {
  const [state, dispatch] = useReducer(controlsReducer, 'hidden')
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void window.bigBrowser.invoke('window.isMaximized').then(setMaximized)
    return window.bigBrowser.on('window.maximized', setMaximized)
  }, [])

  useEffect(() => {
    const delay = controlsDelay(state)
    if (delay === null) return
    const timer = window.setTimeout(() => dispatch('elapsed'), delay)
    return () => window.clearTimeout(timer)
  }, [state])

  const open = state === 'shown' || state === 'hiding'

  return (
    <div
      className={styles.strip}
      data-open={open}
      data-floating={floating || undefined}
      data-testid="window-controls"
      onPointerEnter={() => dispatch('enter')}
      onPointerLeave={() => dispatch('leave')}
    >
      {/* Hidden buttons take no focus or clicks. */}
      <div className={styles.buttons} inert={!open}>
        <button
          className={styles.button}
          aria-label="Minimize"
          onClick={() => void window.bigBrowser.invoke('window.minimize')}
        >
          <Minus weight="regular" />
        </button>
        <button
          className={styles.button}
          aria-label={maximized ? 'Restore' : 'Maximize'}
          onClick={() => void window.bigBrowser.invoke('window.toggleMaximize')}
        >
          {maximized ? (
            <CopySimple weight="regular" size={14} />
          ) : (
            <Square weight="regular" size={13} />
          )}
        </button>
        <button
          className={`${styles.button} ${styles.close}`}
          aria-label="Close"
          onClick={() => void window.bigBrowser.invoke('window.close')}
        >
          <X weight="regular" />
        </button>
      </div>
    </div>
  )
}
