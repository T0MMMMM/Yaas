import { useState } from 'react'
import { COMMON_EMOJIS, firstGrapheme } from './emoji'
import styles from './EmojiField.module.css'

/** Longest icon the contract takes (`browser.setSpaceIcon`). */
const ICON_MAX = 16

/**
 * Picks an emoji: a text field that keeps the first character typed or pasted (the system emoji
 * picker types into it too), a row of common emojis, and "No icon" (`null`).
 */
export function EmojiField({
  value,
  onPick,
}: {
  value: string | null
  onPick: (emoji: string | null) => void
}) {
  const [draft, setDraft] = useState(value ?? '')
  return (
    <div className={styles.field}>
      <input
        className={styles.input}
        aria-label="Emoji"
        placeholder="Type or paste an emoji"
        value={draft}
        autoFocus
        spellCheck={false}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const emoji = firstGrapheme(e.target.value)
          setDraft(emoji ?? '')
          if (emoji && emoji !== value && emoji.length <= ICON_MAX) onPick(emoji)
        }}
      />
      <div className={styles.grid}>
        {COMMON_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            className={styles.emoji}
            aria-label={`Use ${emoji}`}
            aria-pressed={emoji === value}
            onClick={() => onPick(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
      <button className={styles.none} aria-pressed={value === null} onClick={() => onPick(null)}>
        No icon
      </button>
    </div>
  )
}
