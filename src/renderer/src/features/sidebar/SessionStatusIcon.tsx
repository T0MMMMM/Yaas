import type { SessionStatus } from '@shared/model'
import styles from './Sidebar.module.css'

const LABELS: Record<SessionStatus, string> = {
  idle: 'Idle',
  running: 'Running',
  'needs-approval': 'Waiting for your action',
  done: 'Finished',
  error: 'Error',
  limited: 'Account limited',
}

/** Status dot of a session, like the Claude apps (DESIGN.md §2). Always labelled. */
export function SessionStatusIcon({ status }: { status: SessionStatus }) {
  if (status === 'idle') return null
  return (
    <span
      className={styles.status}
      data-status={status}
      title={LABELS[status]}
      aria-label={LABELS[status]}
      role="img"
    />
  )
}
