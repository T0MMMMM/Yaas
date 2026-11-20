import { describe, expect, it } from 'vitest'
import { withPresence, type Present } from './presence'

const key = (s: string): string => s
const live = (...items: string[]): Present<string>[] =>
  items.map((item) => ({ item, exiting: false }))
const view = (list: Present<string>[]): string[] =>
  list.map((e) => (e.exiting ? `~${e.item}` : e.item))

describe('withPresence', () => {
  it('keeps a removed item at its place, exiting', () => {
    expect(view(withPresence(live('a', 'b', 'c'), ['a', 'c'], key))).toEqual(['a', '~b', 'c'])
  })

  it('keeps two removals at once, in order', () => {
    expect(view(withPresence(live('a', 'b', 'c', 'd'), ['a', 'd'], key))).toEqual([
      'a',
      '~b',
      '~c',
      'd',
    ])
  })

  it('keeps a removed first item first', () => {
    expect(view(withPresence(live('a', 'b'), ['b'], key))).toEqual(['~a', 'b'])
  })

  it('does not duplicate an item that comes back, nor keep it exiting', () => {
    const gone = withPresence(live('a', 'b', 'c'), ['a', 'c'], key)
    expect(view(withPresence(gone, ['a', 'b', 'c'], key))).toEqual(['a', 'b', 'c'])
  })

  it('lists additions in the order of next', () => {
    expect(view(withPresence(live('a', 'c'), ['a', 'b', 'c', 'd'], key))).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
  })

  it('keeps an already exiting item once across calls', () => {
    const once = withPresence(live('a', 'b', 'c'), ['a', 'c'], key)
    const twice = withPresence(once, ['a', 'c'], key)
    expect(view(twice)).toEqual(['a', '~b', 'c'])
  })

  it('closing several rows one after another never duplicates or reorders the rest', () => {
    let drawn = live('a', 'b', 'c', 'd', 'e')
    drawn = withPresence(drawn, ['a', 'b', 'c', 'd'], key) // e closes
    drawn = withPresence(drawn, ['a', 'b', 'd'], key) // c closes
    drawn = withPresence(drawn, ['a', 'd'], key) // b closes
    expect(view(drawn)).toEqual(['a', '~b', '~c', 'd', '~e'])
    // Each exit ends: the remaining rows keep their order.
    drawn = drawn.filter((e) => !(e.exiting && e.item === 'c'))
    expect(view(withPresence(drawn, ['a', 'd'], key))).toEqual(['a', '~b', 'd', '~e'])
    expect(
      withPresence(drawn, ['a', 'd'], key)
        .filter((e) => !e.exiting)
        .map((e) => e.item),
    ).toEqual(['a', 'd'])
  })

  it('drops at once an item that moved elsewhere instead of closing', () => {
    const closed = (s: string): boolean => s !== 'b'
    expect(view(withPresence(live('a', 'b', 'c'), ['a', 'c'], key, closed))).toEqual(['a', 'c'])
  })

  it('keeps only the closed items when several leave at once (a space switch, then a close)', () => {
    const closed = (s: string): boolean => s === 'c'
    expect(view(withPresence(live('a', 'b', 'c'), [], key, closed))).toEqual(['~c'])
  })

  it('drops an exiting item that turns out to live elsewhere', () => {
    const gone = withPresence(live('a', 'b'), ['a'], key)
    expect(view(withPresence(gone, ['a'], key, () => false))).toEqual(['a'])
  })
})
