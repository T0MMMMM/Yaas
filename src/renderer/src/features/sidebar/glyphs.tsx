// Illustrated glyphs for the sidebar: colored folders for environments, a tiny chat bubble for
// sessions. A folder's hue is its chosen one, or comes from its name (hash.ts).
import type { CSSProperties } from 'react'
import styles from './glyphs.module.css'

/** The folder glyph in `hue` (degrees). Opening plays: the flap swings up, the paper rises. */
export function FolderGlyph({ hue, open }: { hue: number; open: boolean }) {
  return (
    <svg
      className={styles.folder}
      viewBox="0 0 20 16"
      style={{ '--hue': hue } as CSSProperties}
      data-open={open}
      data-testid="folder-glyph"
      aria-hidden
    >
      {/* back + tab */}
      <path
        className={styles.back}
        d="M1.5 3.2c0-.9.7-1.7 1.7-1.7h4l1.6 1.8h7.9c.9 0 1.7.7 1.7 1.7v8.3c0 .9-.8 1.7-1.7 1.7H3.2c-1 0-1.7-.8-1.7-1.7Z"
      />
      {/* paper peeking out when open */}
      <rect className={styles.paper} x="4" y="4.6" width="12" height="7" rx="1" />
      {/* front flap: always the closed shape; opening swings it (CSS) from its bottom edge */}
      <path
        className={styles.front}
        d="M1.5 5.6c0-.9.7-1.6 1.6-1.6h13.8c.9 0 1.6.7 1.6 1.6v7.6c0 .9-.7 1.6-1.6 1.6H3.1c-.9 0-1.6-.7-1.6-1.6Z"
      />
      <path className={styles.shine} d="M3.2 5.4h13.6" />
    </svg>
  )
}

export function SessionGlyph() {
  return (
    <svg className={styles.session} viewBox="0 0 16 16" aria-hidden>
      <path
        className={styles.bubble}
        d="M3 3.5h10a1.5 1.5 0 0 1 1.5 1.5v5.2A1.5 1.5 0 0 1 13 11.7H8.4l-2.9 2.1c-.3.2-.7 0-.7-.4v-1.7H3A1.5 1.5 0 0 1 1.5 10.2V5A1.5 1.5 0 0 1 3 3.5Z"
      />
      <circle className={styles.dot} cx="5.4" cy="7.6" r=".9" />
      <circle className={styles.dot} cx="8" cy="7.6" r=".9" />
      <circle className={styles.dot} cx="10.6" cy="7.6" r=".9" />
    </svg>
  )
}
