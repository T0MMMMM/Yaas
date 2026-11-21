import { useState } from 'react'
import { COMMON_EMOJIS, ICON_MAX, emojiGrapheme } from './emoji'
import styles from './EmojiField.module.css'

/**
 * Picks an emoji: a text field that takes the first emoji typed or pasted (the system emoji
 * picker types into it too; anything else is refused with a hint), a row of common emojis, and
 * a button for `null` ("No icon", or `noneLabel`). Choosing the current emoji picks it again.
 */
export function EmojiField({
  value,
  onPick,
  noneLabel = 'No icon',
  noneActive = value === null,
}: {
  value: string | null
  onPick: (emoji: string | null) => void
  noneLabel?: string
  /** Whether the `null` button shows as the current choice. */
  noneActive?: boolean
}) {
  const [draft, setDraft] = useState(value ?? '')
  const [refused, setRefused] = useState(false)
  return (
    <div className={styles.field}>
      <input
        className={styles.input}
        aria-label="Emoji"
        aria-invalid={refused || undefined}
        placeholder="Type or paste an emoji"
        value={draft}
        autoFocus
        spellCheck={false}
        onFocus={(e) => e.currentTarget.select()}
        // onInput, not onChange: typing the current emoji over itself changes no value, and
        // React's onChange would stay silent (the card must still close).
        onChange={() => undefined}
        onInput={(e) => {
          const typed = e.currentTarget.value.trim()
          const emoji = emojiGrapheme(typed)
          if (typed === '') {
            setDraft('')
            setRefused(false)
          } else if (emoji === null || emoji.length > ICON_MAX) {
            // Not an emoji (or too long to store): keep what was there and say so.
            setRefused(true)
          } else {
            setDraft(emoji)
            setRefused(false)
            onPick(emoji)
          }
        }}
      />
      {refused && (
        <p className={styles.hint} role="alert">
          Only emojis work here.
        </p>
      )}
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
      <button className={styles.none} aria-pressed={noneActive} onClick={() => onPick(null)}>
        {noneLabel}
      </button>
    </div>
  )
}
