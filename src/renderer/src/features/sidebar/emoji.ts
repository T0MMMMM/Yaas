/** The emojis the space icon card offers in one row (EmojiField). */
export const COMMON_EMOJIS: readonly string[] = [
  '🏠',
  '💼',
  '🚀',
  '⭐',
  '❤️',
  '🔥',
  '🌱',
  '🎨',
  '📚',
  '🎵',
  '🎮',
  '✈️',
  '💡',
  '🛒',
  '🧪',
  '☕',
]

const EMOJI_START = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator})/u

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/** The first character as the user sees it (a joined emoji or a flag is one), spaces skipped. */
export function firstGrapheme(text: string): string | null {
  for (const { segment } of graphemes.segment(text.trim())) return segment
  return null
}

/** Longest icon the contract takes (`browser.setSpaceIcon`, `browser.setFolderIcon`). */
export const ICON_MAX = 16

/** The first character, if it is an emoji (a pictograph or a flag): letters and digits are not. */
export function emojiGrapheme(text: string): string | null {
  const first = firstGrapheme(text)
  return first !== null && EMOJI_START.test(first) ? first : null
}

/**
 * Fallback emoji for a space whose stored icon is null, so every space still shows an emoji in its
 * header (and in emoji switcher mode) regardless of the footer switcher setting.
 */
export function spaceEmoji(icon: string | null, label: string): string {
  if (icon) return icon
  const key = label.trim().toLowerCase()
  if (key === 'personal') return '🏠'
  if (key === 'work') return '💼'
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return COMMON_EMOJIS[hash % COMMON_EMOJIS.length] ?? '🏠'
}
