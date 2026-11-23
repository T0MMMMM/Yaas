import { useEffect, useReducer, useState } from 'react'
import { CopySimple, Minus, Square, X } from '@phosphor-icons/react'
import { controlsDelay, controlsReducer } from './controlsReveal'
import styles from './WindowControls.module.css'

interface WindowControlsProps {
  /** Platform flag kept for callers; both macOS and Windows draw the top-right buttons here. */
  platform: 'mac' | 'windows'
  /** Lays the margin over the content (the onboarding, with no page under it). */
  floating?: boolean
}

/**
 * The window's top margin, across the whole window. The window buttons are hidden; resting the
 * pointer on the margin opens it (it grows, the top-right buttons come) and it closes a moment
 * after the pointer leaves. Once open it drags the window. A drag region gets no pointer events,
 * so once it is open main reports when the pointer leaves the top band (`window.topHover`).
 */
export function WindowControls({ floating = false }: WindowControlsProps) {
  const [state, dispatch] = useReducer(controlsReducer, 'hidden')
  const [maximized, setMaximized] = useState(false)
  const open = state === 'shown' || state === 'hiding'

  useEffect(() => {
    void window.bigBrowser.invoke('window.isMaximized').then(setMaximized)
    return window.bigBrowser.on('window.maximized', setMaximized)
  }, [])

  // Starts/stops main watching the pointer while the top strip is open.
  useEffect(() => {
    void window.bigBrowser.invoke('window.setControlsVisible', { visible: open })
  }, [open])

  useEffect(
    () => window.bigBrowser.on('window.topHover', (inside) => dispatch(inside ? 'enter' : 'leave')),
    [],
  )

  useEffect(() => {
    const delay = controlsDelay(state)
    if (delay === null) return
    const timer = window.setTimeout(() => dispatch('elapsed'), delay)
    return () => window.clearTimeout(timer)
  }, [state])

  return (
    <div
      className={styles.strip}
      data-open={open}
      data-floating={floating || undefined}
      data-testid="window-controls"
      onPointerEnter={() => dispatch('enter')}
      // Once open, main decides when the pointer has left (see above).
      onPointerLeave={() => {
        if (state === 'revealing') dispatch('leave')
      }}
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
