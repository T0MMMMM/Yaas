import { useEffect, useReducer, useState } from 'react'
import { CopySimple, Minus, Square, X } from '@phosphor-icons/react'
import { controlsDelay, controlsReducer } from './controlsReveal'
import styles from './WindowControls.module.css'

interface WindowControlsProps {
  /** macOS shows its own traffic lights in the margin; Windows gets buttons drawn here. */
  platform: 'mac' | 'windows'
  /** Lays the margin over the content (the onboarding, with no page under it). */
  floating?: boolean
}

/**
 * The window's top margin, across the whole window. The window buttons are hidden; resting the
 * pointer on the margin opens it (it grows, the buttons come) and it closes a moment after the
 * pointer leaves. Once open it drags the window. On Windows the buttons are drawn here; on macOS
 * the traffic lights are shown in it. A drag region (and the traffic lights) gets no pointer
 * events, so once it is open main reports when the pointer leaves the top band
 * (`window.topHover`).
 */
export function WindowControls({ platform, floating = false }: WindowControlsProps) {
  const [state, dispatch] = useReducer(controlsReducer, 'hidden')
  const [maximized, setMaximized] = useState(false)
  const open = state === 'shown' || state === 'hiding'
  const mac = platform === 'mac'

  useEffect(() => {
    if (mac) return
    void window.bigBrowser.invoke('window.isMaximized').then(setMaximized)
    return window.bigBrowser.on('window.maximized', setMaximized)
  }, [mac])

  // Shows the traffic lights (macOS) and starts main watching the pointer while open.
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
      {!mac && (
        // Hidden buttons take no focus or clicks.
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
      )}
    </div>
  )
}
