import { useState } from 'react'
import { Globe } from '@phosphor-icons/react'
import type { Tooltip } from '@shared/ipc/contract'
import styles from './OverlayTooltip.module.css'

let mounts = 0

/**
 * A sidebar row's tooltip in the overlay (tooltip mode: the view is a strip from the sidebar's
 * edge): the row's favicon and title, its site below. One card for the whole hover: moving to
 * another row swaps position and content in place (warm state); it enters from scale 0.97 on mount
 * and fades out while `closing`.
 */
export function OverlayTooltip({ tooltip, closing }: { tooltip: Tooltip; closing: boolean }) {
  // Set once at mount: the same card slides from row to row instead of being replaced.
  const [key] = useState(() => String(++mounts))
  const [brokenIcon, setBrokenIcon] = useState<string | null>(null)
  const { anchor, title, detail, icon } = tooltip
  return (
    <div
      role="tooltip"
      className={styles.tooltip}
      style={{ top: anchor.y + anchor.height / 2 }}
      data-testid="tooltip"
      data-key={key}
      data-state={closing ? 'closing' : 'open'}
    >
      <span className={styles.icon} aria-hidden>
        {icon && icon !== brokenIcon ? (
          <img src={icon} alt="" onError={() => setBrokenIcon(icon)} />
        ) : (
          <Globe weight="regular" />
        )}
      </span>
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {detail && <span className={styles.detail}>{detail}</span>}
      </span>
    </div>
  )
}
