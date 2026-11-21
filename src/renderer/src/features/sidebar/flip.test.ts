import { describe, expect, it } from 'vitest'
import { gapOffsets, slotShifts } from './flip'

/** Four 10 px rows, stacked. */
const rows = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, top: i * 10, height: 10 }))

describe('gapOffsets', () => {
  it('moves the rows the dragged row passes up when it goes down', () => {
    expect(gapOffsets(rows, 'a', 2)).toEqual({ b: -10, c: -10, d: 0 })
  })

  it('moves the rows the dragged row passes down when it goes up', () => {
    expect(gapOffsets(rows, 'd', 1)).toEqual({ a: 0, b: 10, c: 10 })
  })

  it('moves nothing when the dragged row stays where it is', () => {
    expect(gapOffsets(rows, 'b', 1)).toEqual({ a: 0, c: 0, d: 0 })
  })

  it('opens a gap of the dragged row height (a row coming from another list is last)', () => {
    const others = [...rows.slice(0, 3), { id: 'x', top: 100, height: 24 }]
    expect(gapOffsets(others, 'x', 1)).toEqual({ a: 0, b: 24, c: 24 })
  })
})

describe('slotShifts', () => {
  // A grid of two tiles per row: a b / c d.
  const slots = [
    { id: 'a', left: 0, top: 0 },
    { id: 'b', left: 50, top: 0 },
    { id: 'c', left: 0, top: 30 },
    { id: 'd', left: 50, top: 30 },
  ]

  it('moves each tile into the slot of its new place, wrapping between rows', () => {
    expect(slotShifts(slots, 'a', 2)).toEqual({
      b: { x: -50, y: 0 },
      c: { x: 50, y: -30 },
      d: { x: 0, y: 0 },
    })
    expect(slotShifts(slots, 'd', 0)).toEqual({
      a: { x: 50, y: 0 },
      b: { x: -50, y: 30 },
      c: { x: 50, y: 0 },
    })
  })

  it('moves nothing when the dragged tile stays where it is', () => {
    expect(slotShifts(slots, 'c', 2)).toEqual({
      a: { x: 0, y: 0 },
      b: { x: 0, y: 0 },
      d: { x: 0, y: 0 },
    })
  })
})
