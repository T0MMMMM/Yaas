import { describe, expect, it } from 'vitest'
import type { SidebarNode, TabView } from '../workspace/workspace'
import { exitsWhenGone } from './rows'

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
})
