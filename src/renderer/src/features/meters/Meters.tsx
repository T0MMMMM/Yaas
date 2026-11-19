import { CONTEXT_LIMIT } from '../sidebar/demoData'
import { formatReset } from './formatReset'
import styles from './Meters.module.css'

const k = (n: number) => `${Math.round(n / 1000)}k`
const pct = (n: number) => `${Math.round(n * 100)}%`

function Ring({ ratio, warn }: { ratio: number; warn: boolean }) {
  const r = 6
  const circumference = 2 * Math.PI * r
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      className={styles.ring}
      data-warn={warn}
      aria-hidden
    >
      <circle cx="8" cy="8" r={r} className={styles.ringTrack} />
      <circle
        cx="8"
        cy="8"
        r={r}
        className={styles.ringFill}
        strokeDasharray={`${Math.min(ratio, 1) * circumference} ${circumference}`}
      />
    </svg>
  )
}

/** Context window of the open session (DESIGN.md §2). Demo values for now. */
export function ContextMeter({ tokens }: { tokens: number }) {
  const ratio = tokens / CONTEXT_LIMIT
  return (
    <div
      className={styles.meter}
      data-testid="context-indicator"
      title={`Context window: ${tokens.toLocaleString()} / ${CONTEXT_LIMIT.toLocaleString()} tokens`}
    >
      <Ring ratio={ratio} warn={ratio > 0.8} />
      <span className={styles.value}>
        {k(tokens)} / {k(CONTEXT_LIMIT)}
      </span>
    </div>
  )
}

export interface UsageWindowView {
  utilization: number
  resetsAt: Date
}

/** Account usage: Session (5 h) and Week (7 d) rings with reset time and time left. */
export function UsageMeter({
  session,
  week,
  layout,
}: {
  session: UsageWindowView
  week: UsageWindowView
  layout: 'inline' | 'stacked'
}) {
  return (
    <div className={styles.usage} data-layout={layout} data-testid="usage">
      <UsageItem label="Session" window={session} />
      <UsageItem label="Week" window={week} />
    </div>
  )
}

function UsageItem({ label, window: w }: { label: string; window: UsageWindowView }) {
  const { clock, left } = formatReset(w.resetsAt, new Date())
  return (
    <div className={styles.meter} title={`${label} usage resets ${clock}`}>
      <Ring ratio={w.utilization} warn={w.utilization > 0.8} />
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{pct(w.utilization)}</span>
      <span className={styles.reset}>
        {clock} ({left})
      </span>
    </div>
  )
}
