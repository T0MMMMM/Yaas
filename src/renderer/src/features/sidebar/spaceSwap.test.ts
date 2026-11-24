import { describe, expect, it } from 'vitest'
import type { SidebarSections, SpaceSummary } from '../workspace/workspace'
import { finishSpaceSwap, INITIAL_SWAP, markSwapVisible, nextSpaceSwap } from './spaceSwap'

const emptySections: SidebarSections = {
  favorites: [],
  favoriteSeconds: new Map(),
  pinned: [],
  today: [],
  todayOrder: [],
}

const space = (id: string): SpaceSummary => ({
  id,
  label: id,
  color: '#7c5cff',
  icon: null,
  sectionCollapsed: false,
})

describe('spaceSwap', () => {
  it('mounts the first space with no outgoing snapshot', () => {
    const s1 = nextSpaceSwap(INITIAL_SWAP, {
      space: space('a'),
      sections: emptySections,
      activeId: null,
    })
    expect(s1.current?.space.id).toBe('a')
    expect(s1.outgoing).toBeNull()
    expect(s1.swapCount).toBe(0)
    expect(s1.incomingVisible).toBe(true)
  })

  it('captures the previous space as outgoing on switch and clears it on finish', () => {
    const s1 = nextSpaceSwap(INITIAL_SWAP, {
      space: space('a'),
      sections: emptySections,
      activeId: null,
    })
    const s2 = nextSpaceSwap(s1, { space: space('b'), sections: emptySections, activeId: null })
    expect(s2.current?.space.id).toBe('b')
    expect(s2.outgoing?.space.id).toBe('a')
    expect(s2.swapCount).toBe(1)
    expect(s2.incomingVisible).toBe(false)

    const settled = finishSpaceSwap(s2, s2.outgoing?.gen ?? -1)
    expect(settled.outgoing).toBeNull()
    expect(settled.current?.space.id).toBe('b')
  })

  it('keeps the visible outgoing snapshot when interrupted during the 75 ms enter delay', () => {
    const s1 = nextSpaceSwap(INITIAL_SWAP, {
      space: space('a'),
      sections: emptySections,
      activeId: null,
    })
    const s2 = nextSpaceSwap(s1, { space: space('b'), sections: emptySections, activeId: null })
    const s3 = nextSpaceSwap(s2, { space: space('c'), sections: emptySections, activeId: null })
    expect(s3.current?.space.id).toBe('c')
    expect(s3.outgoing?.space.id).toBe('a')
    expect(s3.swapCount).toBe(2)
  })

  it('replaces outgoing with the intermediate space once it became visible', () => {
    const s1 = nextSpaceSwap(INITIAL_SWAP, {
      space: space('a'),
      sections: emptySections,
      activeId: null,
    })
    const s2 = markSwapVisible(
      nextSpaceSwap(s1, { space: space('b'), sections: emptySections, activeId: null }),
      1,
    )
    expect(s2.incomingVisible).toBe(true)
    const s3 = nextSpaceSwap(s2, { space: space('c'), sections: emptySections, activeId: null })
    expect(s3.current?.space.id).toBe('c')
    expect(s3.outgoing?.space.id).toBe('b')
    // Stale completion from space a does not clear space b's outgoing snapshot.
    expect(finishSpaceSwap(s3, s1.current?.gen ?? -1).outgoing?.space.id).toBe('b')
  })
})
