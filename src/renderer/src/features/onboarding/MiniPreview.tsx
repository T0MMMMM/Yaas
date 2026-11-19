import type { Settings } from '@shared/ipc/contract'
import styles from './MiniPreview.module.css'

const ACCOUNTS = [
  { emoji: '💼', letter: 'W' },
  { emoji: '🏠', letter: 'P' },
]

/** Tiny live replica of the app frame, driven by the same tokens. */
export function MiniPreview({ switcher }: { switcher: Settings['spaceSwitcherStyle'] }) {
  return (
    <div className={styles.frame} aria-hidden>
      <div className={styles.sidebar}>
        <div className={styles.search} />
        <div className={styles.group} />
        <div className={styles.tab} data-active="true" />
        <div className={styles.tab} />
        <div className={styles.rule} />
        <div className={styles.group} />
        <div className={styles.tab} />
        <div className={styles.spacer} />
        <div className={styles.switcher}>
          {ACCOUNTS.map((a, i) => (
            <span key={a.letter} data-active={i === 0}>
              {switcher === 'emoji' && a.emoji}
              {switcher === 'letter' && a.letter}
              {switcher === 'dots' && <i />}
            </span>
          ))}
        </div>
      </div>
      <div className={styles.column}>
        <div className={styles.topbar} />
        <div className={styles.main}>
          <div className={styles.line} style={{ width: '70%' }} />
          <div className={styles.line} style={{ width: '45%' }} />
          <div className={styles.bubble} />
        </div>
      </div>
    </div>
  )
}
