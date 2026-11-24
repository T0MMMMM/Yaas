import { useState, type CSSProperties } from 'react'
import { nextBackdropLayers, settleBackdropLayers, type BackdropLayer } from './backdropLayers'
import { frameGradient, type ColorScheme } from './windowTint'
import styles from './FrameBackdrop.module.css'

interface FrameBackdropProps {
  spaceId: string | null
  /** Active space hex color, or null before workspace hydrates (shows warm `--frame-base`). */
  color: string | null
  scheme: ColorScheme
}

/**
 * Full-window tinted frame gradient + grain, stacked for a 400 ms ease crossfade whenever the
 * active space changes (redesign direction §1–§2, §5). Color scheme flips in place so the frame
 * stays in sync with the rest of the UI tokens.
 */
export function FrameBackdrop({ spaceId, color, scheme }: FrameBackdropProps) {
  const gradient = color ? frameGradient(color, scheme) : null
  const [layers, setLayers] = useState<BackdropLayer[]>(() =>
    gradient ? [{ id: 0, spaceId, scheme, ...gradient, entering: false }] : [],
  )

  const next = nextBackdropLayers(
    layers,
    gradient ? { spaceId, scheme, top: gradient.top, bottom: gradient.bottom } : null,
  )
  if (next !== layers) setLayers(next)

  const settle = (finishedId: number) => {
    setLayers((current) => settleBackdropLayers(current, finishedId))
  }

  return (
    <div
      className={styles.backdrop}
      data-testid="frame-backdrop"
      data-frame-top={gradient?.top}
      data-frame-bottom={gradient?.bottom}
      aria-hidden="true"
    >
      {layers.map((layer) => (
        <div
          key={layer.id}
          className={layer.entering ? `${styles.layer} ${styles.entering}` : styles.layer}
          data-testid="frame-backdrop-layer"
          style={
            {
              '--layer-top': layer.top,
              '--layer-bottom': layer.bottom,
            } as CSSProperties
          }
          onAnimationEnd={layer.entering ? () => settle(layer.id) : undefined}
        />
      ))}
    </div>
  )
}
