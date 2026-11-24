import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import styles from './SplitDivider.module.css'

const MIN_RATIO = 0.25
const MAX_RATIO = 0.75
const DEFAULT_RATIO = 0.5
/** How far one arrow key press moves the divider. */
const KEY_STEP = 0.05

const clamp = (ratio: number): number => Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio))

interface Props {
  /** The split's first tab: it stores the ratio. */
  tabId: string
  ratio: number
}

/**
 * Invisible divider in the 8 px frame trough between a split's two pages, revealing a 3×28 px pill
 * on hover, focus or drag (redesign direction §4). A drag is run by main (`browser.splitDrag`):
 * the pointer soon leaves this strip for a page, so the overlay catches it while main moves the
 * pages and tells the UI the ratio (`browser.splitPreview`), so the header bars follow too.
 * Double-click resets to 50/50; arrow keys adjust by 5 %.
 */
export function SplitDivider({ tabId, ratio }: Props) {
  /** Ends the drag in progress (drops its window listeners), or null. */
  const stopRef = useRef<(() => void) | null>(null)
  const [dragging, setDragging] = useState(false)

  // A split that goes away mid-drag (its tab closed) lets go of the window.
  useEffect(() => () => stopRef.current?.(), [])

  // The UI's own pointer events are followed on the window rather than through pointer capture
  // alone: the bars and the divider move under the pointer as main previews the ratio, and a
  // reflow under a pointer may drop the capture.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || stopRef.current) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const onMove = (e: globalThis.PointerEvent) =>
      void window.bigBrowser.invoke('browser.splitDrag', { phase: 'move', x: e.clientX })
    const onUp = (e: globalThis.PointerEvent) => {
      stop()
      void window.bigBrowser.invoke('browser.splitDrag', { phase: 'end', x: e.clientX })
    }
    const onCancel = () => {
      stop()
      void window.bigBrowser.invoke('browser.splitDrag', { phase: 'cancel' })
    }
    const stop = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      stopRef.current = null
      setDragging(false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    stopRef.current = stop
    setDragging(true)
    void window.bigBrowser.invoke('browser.splitDrag', { phase: 'start', tabId })
  }

  const reset = () => {
    void window.bigBrowser.invoke('browser.setSplitRatio', { tabId, ratio: DEFAULT_RATIO })
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
      data-dragging={dragging || undefined}
      data-testid="split-divider"
      onPointerDown={onPointerDown}
      onDoubleClick={reset}
      onKeyDown={onKeyDown}
    />
  )
}
