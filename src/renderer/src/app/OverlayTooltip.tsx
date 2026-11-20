import { useState } from 'react'
import type { Tooltip } from '@shared/ipc/contract'
import styles from './OverlayTooltip.module.css'

let mounts = 0

/**
 * A sidebar row's tooltip in the overlay (tooltip mode: the view is a strip from the sidebar's
 * edge). One card for the whole hover: moving to another row slides it there (`top` follows the
 * anchor's vertical centre); it fades in when mounted and out while `closing`.
 */
export function OverlayTooltip({ tooltip, closing }: { tooltip: Tooltip; closing: boolean }) {
  // Set once at mount: the same card slides from row to row instead of being replaced.
  const [key] = useState(() => String(++mounts))
  const { anchor, title, detail } = tooltip
  return (
    <div
      role="tooltip"
      className={styles.tooltip}
      style={{ top: anchor.y + anchor.height / 2 }}
      data-testid="tooltip"
      data-key={key}
      data-state={closing ? 'closing' : 'open'}
    >
      <span className={styles.title}>{title}</span>
      {detail && <span className={styles.detail}>{detail}</span>}
    </div>
  )
}
