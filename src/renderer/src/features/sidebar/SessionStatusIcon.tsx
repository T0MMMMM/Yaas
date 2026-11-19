import { Check, CircleAlert, LoaderCircle, Pause, X } from 'lucide-react'
import type { SessionStatus } from '@shared/model'
import styles from './Sidebar.module.css'

const LABELS: Record<SessionStatus, string> = {
  idle: 'Idle',
  running: 'Running',
  'needs-approval': 'Needs your approval',
  done: 'Done',
  error: 'Error',
  limited: 'Account limited',
}

/** Status glyph of a session tab (DESIGN.md §2). Always labelled, never color alone. */
export function SessionStatusIcon({ status }: { status: SessionStatus }) {
  const Icon = {
    idle: null,
    running: LoaderCircle,
    'needs-approval': CircleAlert,
    done: Check,
    error: X,
    limited: Pause,
  }[status]
  if (!Icon) return null
  return (
    <span className={styles.status} data-status={status} title={LABELS[status]}>
      <Icon size={14} strokeWidth={2} aria-label={LABELS[status]} />
    </span>
  )
}
