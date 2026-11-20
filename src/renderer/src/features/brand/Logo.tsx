import styles from './Logo.module.css'

/**
 * Placeholder logo until the art-direction pass (DESIGN.md §3.0): two overlapping spaces,
 * one handing over to the other, tinted with the accent.
 */
export function Logo({ withWordmark = true }: { withWordmark?: boolean }) {
  return (
    <span className={styles.logo}>
      <svg className={styles.mark} viewBox="0 0 48 48" aria-hidden>
        <rect x="4" y="10" width="26" height="26" rx="8" className={styles.back} />
        <rect x="18" y="12" width="26" height="26" rx="8" className={styles.front} />
      </svg>
      {withWordmark && <span className={styles.wordmark}>acab</span>}
    </span>
  )
}
