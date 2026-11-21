import { useEffect } from 'react'
import styles from './SplitDragLayer.module.css'

const drag = (input: { phase: 'move' | 'end'; x: number } | { phase: 'cancel' }) =>
  void window.bigBrowser.invoke('browser.splitDrag', input)

/**
 * Drawn by the overlay during a split divider drag: a transparent layer over the whole window
 * (pages included), so the pointer keeps reaching the UI. Main lays the pages out as it moves and
 * stores the ratio on release; Escape puts the stored ratio back.
 */
export function SplitDragLayer() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') drag({ phase: 'cancel' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      className={styles.layer}
      data-testid="split-drag-layer"
      onPointerMove={(event) => drag({ phase: 'move', x: event.clientX })}
      onPointerUp={(event) => drag({ phase: 'end', x: event.clientX })}
    />
  )
}
