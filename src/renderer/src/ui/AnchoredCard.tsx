import { useRef, type CSSProperties, type ReactNode } from 'react'
import type { PageBounds } from '@shared/ipc/contract'
import { POPOVER_GAP } from './anchor'
import { PopoverNeck } from './PopoverNeck'
import { useConnector } from './connector'
import { useDismiss } from './useDismiss'
import popover from './Popover.module.css'
import styles from './AnchoredCard.module.css'

interface AnchoredCardProps {
  /** Rect of the button it opens from (window DIP): the card opens below it, joined by the funnel. */
  anchor: PageBounds
  label: string
  testId: string
  /** Plays the exit animation (the overlay hides it once done). */
  closing: boolean
  onClose(): void
  children: ReactNode
}

/**
 * A card of the overlay opened from a sidebar button (a space's icon, its colour, a confirmation):
 * the shared opaque popover below the button, grown out of the funnel. Escape or a press outside
 * closes it.
 */
export function AnchoredCard({
  anchor,
  label,
  testId,
  closing,
  onClose,
  children,
}: AnchoredCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, onClose)
  const connector = useConnector(anchor)
  const place: CSSProperties & { '--anchor-mid': string } = {
    '--anchor-mid': `${anchor.x + anchor.width / 2}px`,
    top: anchor.y + anchor.height + POPOVER_GAP,
  }
  return (
    <div
      ref={ref}
      className={`${styles.card} ${popover.alignLeft} no-drag`}
      style={place}
      data-placement="below"
      data-state={closing ? 'closing' : 'open'}
      // While it animates out it takes no focus, keys or clicks.
      inert={closing}
      role="dialog"
      aria-label={label}
      data-testid={testId}
    >
      <PopoverNeck ref={connector} side="top" />
      {children}
    </div>
  )
}
