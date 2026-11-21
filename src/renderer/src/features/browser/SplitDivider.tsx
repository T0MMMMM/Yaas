import { useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
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
 * The bar between a split's two pages, drawn in the gap main leaves between their views. Dragging
 * previews the ratio locally and stores it once on release; arrow keys store it at once.
 */
export function SplitDivider({ tabId, ratio }: Props) {
  const [preview, setPreview] = useState<number | null>(null)
  const shown = preview ?? ratio

  // The stored ratio comes back with the next browser state: the preview holds until then.
  const store = (next: number): Promise<void> =>
    window.bigBrowser
      .invoke('browser.setSplitRatio', { tabId, ratio: clamp(next) })
      .catch(() => undefined)

  const ratioAt = (event: PointerEvent<HTMLDivElement>): number => {
    const box = event.currentTarget.parentElement?.getBoundingClientRect()
    if (!box || box.width <= 0) return shown
    return clamp((event.clientX - box.left) / box.width)
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    setPreview(shown)
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (preview !== null) setPreview(ratioAt(event))
  }
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (preview === null) return
    const next = ratioAt(event)
    setPreview(next)
    void store(next).then(() => setPreview(null))
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowLeft' ? -KEY_STEP : event.key === 'ArrowRight' ? KEY_STEP : 0
    if (step === 0) return
    event.preventDefault()
    void store(shown + step)
  }

  return (
    <div
      className={styles.divider}
      style={{ '--split-ratio': shown } as CSSProperties}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize split"
      aria-valuemin={MIN_RATIO * 100}
      aria-valuemax={MAX_RATIO * 100}
      aria-valuenow={Math.round(shown * 100)}
      tabIndex={0}
      data-testid="split-divider"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setPreview(null)}
      onKeyDown={onKeyDown}
    />
  )
}
