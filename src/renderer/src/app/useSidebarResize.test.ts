import { describe, expect, it } from 'vitest'
import { SIDEBAR_COMPACT, SIDEBAR_MAX, SIDEBAR_MIN } from '@shared/ipc/contract'
import { clampSidebar, snapWidth } from './useSidebarResize'

describe('clampSidebar', () => {
  it('keeps the width between the min and max', () => {
    expect(clampSidebar(50)).toBe(SIDEBAR_MIN)
    expect(clampSidebar(900)).toBe(SIDEBAR_MAX)
    expect(clampSidebar(300.4)).toBe(300)
  })
})

describe('snapWidth', () => {
  it('snaps to the icon-only width under 160', () => {
    expect(snapWidth(100)).toBe(SIDEBAR_COMPACT)
    expect(snapWidth(159)).toBe(SIDEBAR_COMPACT)
    expect(snapWidth(0)).toBe(SIDEBAR_COMPACT)
  })
  it('clamps to 160…max otherwise', () => {
    expect(snapWidth(160)).toBe(160)
    expect(snapWidth(300.4)).toBe(300)
    expect(snapWidth(10_000)).toBe(SIDEBAR_MAX)
  })
})
