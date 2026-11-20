import { describe, expect, it } from 'vitest'
import { placeCard } from './menuPlacement'

const viewport = { width: 800, height: 600 }
const size = { width: 200, height: 150 }

describe('placeCard', () => {
  it('opens right of and below the point when it fits, growing from that corner', () => {
    expect(placeCard({ x: 100, y: 120 }, size, viewport)).toEqual({
      left: 100,
      top: 120,
      origin: 'left top',
    })
  })

  it('flips left of the point near the right edge and above it near the bottom', () => {
    expect(placeCard({ x: 700, y: 550 }, size, viewport)).toEqual({
      left: 500,
      top: 400,
      origin: 'right bottom',
    })
  })

  it('flips to the other edge when given one (a submenu beside its row)', () => {
    const row = { x: 720, y: 100 }
    expect(placeCard(row, size, viewport, { x: 520, y: 130 })).toEqual({
      left: 320,
      top: 100,
      origin: 'right top',
    })
  })

  it('stays inside the window when neither side fits', () => {
    expect(placeCard({ x: 150, y: 100 }, { width: 200, height: 700 }, viewport)).toEqual({
      left: 150,
      top: 10,
      origin: 'left top',
    })
    expect(placeCard({ x: 5, y: 5 }, size, { width: 150, height: 600 })).toMatchObject({
      left: 10,
    })
  })
})
