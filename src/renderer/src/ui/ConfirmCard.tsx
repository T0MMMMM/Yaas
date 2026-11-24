import type { PageBounds } from '@shared/ipc/contract'
import { AnchoredCard } from './AnchoredCard'
import styles from './ConfirmCard.module.css'

interface ConfirmCardProps {
  anchor: PageBounds
  message: string
  confirmLabel: string
  closing: boolean
  onConfirm(): void
  onClose(): void
}

/**
 * A question asked before something that can't be undone (Delete Space…), opened from the button
 * that asked: Cancel (focused, so Enter never destroys anything by accident) and the action.
 */
export function ConfirmCard({
  anchor,
  message,
  confirmLabel,
  closing,
  onConfirm,
  onClose,
}: ConfirmCardProps) {
  return (
    <AnchoredCard
      anchor={anchor}
      label="Confirm"
      testId="confirm"
      tier="occasional"
      closing={closing}
      onClose={onClose}
    >
      <p className={styles.message}>{message}</p>
      <div className={styles.buttons}>
        <button className={styles.button} autoFocus onClick={onClose}>
          Cancel
        </button>
        <button
          className={`${styles.button} ${styles.danger}`}
          onClick={() => {
            if (closing) return
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </AnchoredCard>
  )
}
