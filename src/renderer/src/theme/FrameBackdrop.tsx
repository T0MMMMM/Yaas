import { useState, type CSSProperties } from 'react'
import { nextBackdropLayers, type BackdropLayer } from './backdropLayers'
import { frameGradient, type ColorScheme } from './windowTint'
import styles from './FrameBackdrop.module.css'

interface FrameBackdropProps {
  spaceId: string | null
  color: string
  scheme: ColorScheme
}

/**
 * Full-window tinted frame gradient + grain, stacked for a 400 ms ease crossfade whenever the
 * active space or color scheme changes (redesign direction §1–§2, §5).
 */
export function FrameBackdrop({ spaceId, color, scheme }: FrameBackdropProps) {
  const { top, bottom } = frameGradient(color, scheme)
  const [layers, setLayers] = useState<BackdropLayer[]>(() => [
    { id: 0, spaceId, scheme, top, bottom },
  ])

  const next = nextBackdropLayers(layers, { spaceId, scheme, top, bottom })
  if (next !== layers) setLayers(next)

  const settle = (finishedId: number) => {
    setLayers((current) => {
      const latest = current[current.length - 1]
      if (!latest || latest.id !== finishedId || current.length <= 1) return current
      return [latest]
    })
  }

  return (
    <div
      className={styles.backdrop}
      data-testid="frame-backdrop"
      data-frame-top={top}
      data-frame-bottom={bottom}
      aria-hidden="true"
    >
      {layers.map((layer, index) => {
        const entering = index > 0
        return (
          <div
            key={layer.id}
            className={entering ? `${styles.layer} ${styles.entering}` : styles.layer}
            style={
              {
                '--layer-top': layer.top,
                '--layer-bottom': layer.bottom,
              } as CSSProperties
            }
            onAnimationEnd={entering ? () => settle(layer.id) : undefined}
          />
        )
      })}
    </div>
  )
}
