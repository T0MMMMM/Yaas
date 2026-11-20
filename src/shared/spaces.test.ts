import { describe, expect, it } from 'vitest'
import { spacePartition } from './spaces'

describe('spacePartition', () => {
  it('names a persistent partition per space', () => {
    expect(spacePartition('abc')).toBe('persist:space-abc')
  })
})
