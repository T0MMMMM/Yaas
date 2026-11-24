import { describe, expect, it } from 'vitest'
import type { SidebarNode, TabView } from '../workspace/workspace'
import { enteringAfter, exitsWhenGone, newlyOpenedTabIds, ROW_EXIT_MS } from './rows'

const tab = (id: string): SidebarNode => ({ kind: 'tab', tab: { id } as TabView, depth: 0 })

describe('exitsWhenGone', () => {
  const exits = exitsWhenGone(new Set(['open']))

  it('animates out the row of a closed tab', () => {
    expect(exits(tab('closed'))).toBe(true)
  })

  it('drops at once the row of a tab still open elsewhere (moved, or another space)', () => {
    expect(exits(tab('open'))).toBe(false)
  })

  it('drops a folder at once', () => {
    expect(exits({ kind: 'auto-folder', host: 'example.com', children: [] })).toBe(false)
  })

  it('keeps exiting rows mounted for fade (180 ms) plus height collapse (250 ms)', () => {
    expect(ROW_EXIT_MS).toBe(430)
  })
})

describe('newlyOpenedTabIds', () => {
  it('returns empty on initial mount', () => {
    expect(newlyOpenedTabIds(null, 'space-1', null, new Set(['a', 'b']))).toEqual(new Set())
  })

  it('returns empty when switching spaces', () => {
    expect(newlyOpenedTabIds('space-1', 'space-2', new Set(['a']), new Set(['b', 'c']))).toEqual(
      new Set(),
    )
  })

  it('returns only newly added tab ids in the same space', () => {
    expect(
      newlyOpenedTabIds('space-1', 'space-1', new Set(['a', 'b']), new Set(['a', 'b', 'c'])),
    ).toEqual(new Set(['c']))
  })
})

describe('enteringAfter', () => {
  const none: ReadonlySet<string> = new Set()

  it('keeps the same set when nothing opened or closed (a page load must not restart the enter)', () => {
    const entering = new Set(['a'])
    expect(enteringAfter(entering, none, new Set(['a', 'b']))).toBe(entering)
  })

  it('adds a new batch to the rows still entering', () => {
    expect(enteringAfter(new Set(['a']), new Set(['c']), new Set(['a', 'c']))).toEqual(
      new Set(['a', 'c']),
    )
  })

  it('drops closed tabs and the batch whose enter ended, leaving a later batch', () => {
    expect(
      enteringAfter(new Set(['a', 'b', 'c']), none, new Set(['a', 'c']), new Set(['a'])),
    ).toEqual(new Set(['c']))
  })
})
