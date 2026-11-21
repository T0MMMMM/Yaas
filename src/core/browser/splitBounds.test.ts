import { describe, expect, it } from 'vitest'
import type { BrowserTab } from '@shared/model'
import { shownSplit, splitBounds, splitRatioAt } from './splitBounds'

describe('splitBounds', () => {
  const box = { x: 100, y: 40, width: 1000, height: 600 }

  it('shares the width around the gap', () => {
    const { first, second } = splitBounds(box, 0.5, 5)
    expect([497, 498]).toContain(first.width)
    expect(first.x).toBe(100)
    expect(second.x).toBe(first.x + first.width + 5)
    expect(second.x + second.width).toBe(1100)
    expect(first.height).toBe(600)
    expect(second.height).toBe(600)
    expect(first.y).toBe(40)
    expect(second.y).toBe(40)
  })

  it('rounds to integers and never goes negative', () => {
    const odd = splitBounds({ x: 0.4, y: 0, width: 333.3, height: 10 }, 0.37, 5)
    for (const r of [odd.first, odd.second]) {
      expect(Number.isInteger(r.x) && Number.isInteger(r.width)).toBe(true)
    }
    const tiny = splitBounds({ x: 0, y: 0, width: 3, height: 10 }, 0.5, 5)
    expect(tiny.first.width).toBeGreaterThanOrEqual(0)
    expect(tiny.second.width).toBeGreaterThanOrEqual(0)
  })
})

describe('shownSplit', () => {
  const tab = (id: string, splitOf: string | null = null, splitRatio: number | null = null) =>
    ({ id, splitOf, splitRatio }) as BrowserTab

  it('finds the pair from either half', () => {
    const tabs = [tab('a', null, 0.6), tab('b', 'a'), tab('c')]
    expect(shownSplit(tabs, 'a')).toEqual({ firstId: 'a', secondId: 'b', ratio: 0.6 })
    expect(shownSplit(tabs, 'b')).toEqual({ firstId: 'a', secondId: 'b', ratio: 0.6 })
    expect(shownSplit(tabs, 'c')).toBeNull()
  })

  it('defaults the ratio to one half', () => {
    expect(shownSplit([tab('a'), tab('b', 'a')], 'b')?.ratio).toBe(0.5)
  })
})

describe('splitRatioAt', () => {
  const box = { x: 100, y: 40, width: 1005, height: 600 }

  it('puts the gap centre under the pointer', () => {
    expect(splitRatioAt(box, 100 + 502.5, 5)).toBeCloseTo(0.5)
    expect(splitRatioAt(box, 100 + 2.5 + 400, 5)).toBeCloseTo(0.4)
  })

  it('clamps to 0.25–0.75', () => {
    expect(splitRatioAt(box, 0, 5)).toBe(0.25)
    expect(splitRatioAt(box, 5000, 5)).toBe(0.75)
    expect(splitRatioAt({ ...box, width: 0 }, 300, 5)).toBe(0.5)
  })
})
