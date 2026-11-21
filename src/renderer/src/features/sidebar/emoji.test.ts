import { describe, expect, it } from 'vitest'
import { COMMON_EMOJIS, firstGrapheme } from './emoji'

describe('firstGrapheme', () => {
  it('keeps the first character as the user sees it', () => {
    expect(firstGrapheme('🌱🌵')).toBe('🌱')
    expect(firstGrapheme('ab')).toBe('a')
    // One family emoji (joined code points) and a flag (two regional indicators).
    expect(firstGrapheme('👨‍👩‍👧x')).toBe('👨‍👩‍👧')
    expect(firstGrapheme('🇫🇷🇩🇪')).toBe('🇫🇷')
  })

  it('ignores leading spaces and gives null for nothing', () => {
    expect(firstGrapheme('  🚀')).toBe('🚀')
    expect(firstGrapheme('   ')).toBeNull()
    expect(firstGrapheme('')).toBeNull()
  })
})

describe('COMMON_EMOJIS', () => {
  it('holds 16 distinct emojis, each one grapheme', () => {
    expect(COMMON_EMOJIS).toHaveLength(16)
    expect(new Set(COMMON_EMOJIS).size).toBe(16)
    for (const emoji of COMMON_EMOJIS) expect(firstGrapheme(emoji)).toBe(emoji)
  })
})
