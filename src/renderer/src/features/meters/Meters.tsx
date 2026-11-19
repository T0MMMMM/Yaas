import { CONTEXT_LIMIT } from '../sidebar/demoData'
import styles from './Meters.module.css'

const k = (n: number) => `${Math.round(n / 1000)}k`
const pct = (n: number) => `${Math.round(n * 100)}%`

/** Context window of the open session (DESIGN.md §2). Demo values for now. */
export function ContextMeter({ tokens }: { tokens: number }) {
  const ratio = Math.min(tokens / CONTEXT_LIMIT, 1)
  const r = 6
  const circumference = 2 * Math.PI * r
  return (
    <div
      className={styles.context}
      data-warn={ratio > 0.8}
      data-testid="context-indicator"
      title={`Context window: ${tokens.toLocaleString()} / ${CONTEXT_LIMIT.toLocaleString()} tokens`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r={r} className={styles.ringTrack} />
        <circle
          cx="8"
          cy="8"
          r={r}
          className={styles.ringFill}
          strokeDasharray={`${ratio * circumference} ${circumference}`}
        />
      </svg>
      <span className={styles.value}>
        {k(tokens)} / {k(CONTEXT_LIMIT)}
      </span>
    </div>
  )
}

/** Account usage: 5 h session window and 7 d week window. */
export function UsageMeter({
  fiveHour,
  sevenDay,
  layout,
}: {
  fiveHour: number
  sevenDay: number
  layout: 'inline' | 'stacked'
}) {
  return (
    <div className={styles.usage} data-layout={layout} title="Account usage (demo values)">
      <Bar label="5h" value={fiveHour} />
      <Bar label="7d" value={sevenDay} />
    </div>
  )
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.bar} data-warn={value > 0.8}>
      <span className={styles.label}>{label}</span>
      <span className={styles.track}>
        <span className={styles.fill} style={{ width: pct(value) }} />
      </span>
      <span className={styles.value}>{pct(value)}</span>
    </div>
  )
}
