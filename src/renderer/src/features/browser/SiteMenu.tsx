import { useRef } from 'react'
import type { PageBounds } from '@shared/ipc/contract'
import { useDismiss } from '../../ui/useDismiss'
import styles from './SiteMenu.module.css'

interface SiteMenuProps {
  /** Rect of the address bar button it opens from; the card opens below it. */
  anchor: PageBounds
  onClose(): void
}

/** The address bar's site menu, shown in the overlay. A placeholder card until it gets controls. */
export function SiteMenu({ anchor, onClose }: SiteMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, onClose)
  return (
    <div
      ref={ref}
      className={styles.card}
      style={{ top: anchor.y + anchor.height, left: anchor.x }}
      data-testid="site-menu"
    />
  )
}
