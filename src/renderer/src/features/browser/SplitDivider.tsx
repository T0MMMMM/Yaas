import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import styles from './SplitDivider.module.css'

const MIN_RATIO = 0.25
const MAX_RATIO = 0.75
/** How far one arrow key press moves the divider. */
const KEY_STEP = 0.05

const clamp = (ratio: number): number => Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio))

interface Props {
  /** The split's first tab: it stores the ratio. */
  tabId: string
  ratio: number
}

/**
 * The bar between a split's two pages, drawn in the gap main leaves between their views. A drag is
 * run by main (`browser.splitDrag`): the pointer soon leaves this strip for a page, which the UI
 * cannot see, so the overlay catches it while main moves the pages. The strip also captures the
 * pointer and forwards it, as the press's own events may stay with the UI: whichever view gets
 * them, main ends the drag once. Arrow keys store at once.
 */
export function SplitDivider({ tabId, ratio }: Props) {
  const dragging = useRef(false)
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragging.current = true
    void window.bigBrowser.invoke('browser.splitDrag', { phase: 'start', tabId })
  }
  const forward = (phase: 'move' | 'end', event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    if (phase === 'end') dragging.current = false
    void window.bigBrowser.invoke('browser.splitDrag', { phase, x: event.clientX })
  }
  const cancel = () => {
    if (!dragging.current) return
    dragging.current = false
    void window.bigBrowser.invoke('browser.splitDrag', { phase: 'cancel' })
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowLeft' ? -KEY_STEP : event.key === 'ArrowRight' ? KEY_STEP : 0
    if (step === 0) return
    event.preventDefault()
    void window.bigBrowser.invoke('browser.setSplitRatio', { tabId, ratio: clamp(ratio + step) })
  }

  return (
    <div
      className={styles.divider}
      style={{ '--split-ratio': ratio } as CSSProperties}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize split"
      aria-valuemin={MIN_RATIO * 100}
      aria-valuemax={MAX_RATIO * 100}
      aria-valuenow={Math.round(ratio * 100)}
      tabIndex={0}
      data-testid="split-divider"
      onPointerDown={onPointerDown}
      onPointerMove={(event) => forward('move', event)}
      onPointerUp={(event) => forward('end', event)}
      onPointerCancel={cancel}
      onKeyDown={onKeyDown}
    />
  )
}
