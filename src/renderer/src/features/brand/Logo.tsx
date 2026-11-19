import styles from './Logo.module.css'

/**
 * Placeholder logo until the art-direction pass (DESIGN.md §3.0): two overlapping spaces,
 * one handing over to the other, tinted with the accent.
 */
export function Logo({ withWordmark = true }: { withWordmark?: boolean }) {
  return (
    <span className={styles.logo}>
      <svg className={styles.mark} viewBox="0 0 48 48" aria-hidden>
        <rect x="16" y="14" width="28" height="28" rx="7" className={styles.front} />
        <rect x="5" y="6" width="28" height="28" rx="7" className={styles.back} />
      </svg>
      {withWordmark && <span className={styles.wordmark}>yaas</span>}
    </span>
  )
}
