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

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/** The first character as the user sees it (a joined emoji or a flag is one), spaces skipped. */
export function firstGrapheme(text: string): string | null {
  for (const { segment } of graphemes.segment(text.trim())) return segment
  return null
}
