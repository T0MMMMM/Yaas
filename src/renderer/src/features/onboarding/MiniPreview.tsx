import { Briefcase, House } from 'lucide-react'
import styles from './MiniPreview.module.css'

/** Tiny live replica of the app frame, driven by the same tokens. */
export function MiniPreview({ switcher }: { switcher: 'icons' | 'dots' }) {
  return (
    <div className={styles.frame} aria-hidden>
      <div className={styles.sidebar}>
        <div className={styles.search} />
        <div className={styles.tiles}>
          <span />
          <span />
        </div>
        <div className={styles.group} />
        <div className={styles.tab} data-active="true" />
        <div className={styles.tab} />
        <div className={styles.group} />
        <div className={styles.tab} />
        <div className={styles.spacer} />
        <div className={styles.switcher}>
          {switcher === 'icons' ? (
            <>
              <Briefcase size={11} data-active="true" />
              <House size={11} />
            </>
          ) : (
            <>
              <i data-active="true" />
              <i />
              <i />
            </>
          )}
        </div>
      </div>
      <div className={styles.main}>
        <div className={styles.line} style={{ width: '70%' }} />
        <div className={styles.line} style={{ width: '45%' }} />
        <div className={styles.bubble} />
      </div>
    </div>
  )
}
