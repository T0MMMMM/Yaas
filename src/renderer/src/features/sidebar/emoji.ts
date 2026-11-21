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
