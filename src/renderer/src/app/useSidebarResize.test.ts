import { describe, expect, it } from 'vitest'
import { SIDEBAR_COMPACT, SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN } from '@shared/ipc/contract'
import { clampSidebar, snapWidth, toggledSidebar } from './useSidebarResize'

describe('clampSidebar', () => {
  it('keeps the width between the min and max', () => {
    expect(clampSidebar(10)).toBe(SIDEBAR_MIN)
    expect(clampSidebar(900)).toBe(SIDEBAR_MAX)
    expect(clampSidebar(300.4)).toBe(300)
  })
})

describe('snapWidth', () => {
  it('keeps normal widths from the compact threshold up', () => {
    expect(snapWidth(200)).toBe(200)
    expect(snapWidth(121)).toBe(121)
    expect(snapWidth(120)).toBe(120)
    expect(snapWidth(160)).toBe(160)
    expect(snapWidth(300.4)).toBe(300)
    expect(snapWidth(500)).toBe(SIDEBAR_MAX)
  })
  it('clamps icon-only widths to 48…72, not to one width', () => {
    expect(snapWidth(119)).toBe(72)
    expect(snapWidth(90)).toBe(72)
    expect(snapWidth(60)).toBe(60)
    expect(snapWidth(40)).toBe(48)
    expect(snapWidth(0)).toBe(48)
  })
})

describe('toggledSidebar', () => {
  it('goes to icons only and remembers the width it leaves', () => {
    expect(toggledSidebar(300, SIDEBAR_DEFAULT)).toEqual({
      sidebarWidth: SIDEBAR_COMPACT,
      sidebarExpandedWidth: 300,
    })
  })

  it('comes back to the remembered width', () => {
    expect(toggledSidebar(56, 300)).toEqual({ sidebarWidth: 300, sidebarExpandedWidth: 300 })
    expect(toggledSidebar(72, SIDEBAR_DEFAULT)).toEqual({
      sidebarWidth: SIDEBAR_DEFAULT,
      sidebarExpandedWidth: SIDEBAR_DEFAULT,
    })
  })

  it('never comes back half-compact', () => {
    expect(toggledSidebar(56, 90)).toEqual({ sidebarWidth: 120, sidebarExpandedWidth: 90 })
  })
})
