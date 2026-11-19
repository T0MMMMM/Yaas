import { describe, expect, it } from 'vitest'
import { SIDEBAR_MAX, SIDEBAR_MIN } from '@shared/ipc/contract'
import { clampSidebar } from './useSidebarResize'

describe('clampSidebar', () => {
  it('keeps the width between the min and max', () => {
    expect(clampSidebar(50)).toBe(SIDEBAR_MIN)
    expect(clampSidebar(900)).toBe(SIDEBAR_MAX)
    expect(clampSidebar(300.4)).toBe(300)
  })
})
